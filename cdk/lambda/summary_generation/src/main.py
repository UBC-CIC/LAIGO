import os
import json
import boto3
import logging
import hashlib
import uuid
from datetime import datetime
import psycopg
import boto3
from botocore.exceptions import ClientError
from langchain_aws import ChatBedrockConverse
from langchain_core.prompts import ChatPromptTemplate
from helpers.chat import get_bedrock_llm, generate_lawyer_summary, retrieve_dynamodb_history, generate_full_case_summary

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
DB_SECRET_NAME = os.environ["SM_DB_CREDENTIALS"]
REGION = os.environ["REGION"]
RDS_PROXY_ENDPOINT = os.environ["RDS_PROXY_ENDPOINT"]
BEDROCK_LLM_PARAM = os.environ["BEDROCK_LLM_PARAM"]
TABLE_NAME_PARAM = os.environ["TABLE_NAME_PARAM"]
TABLE_NAME = os.environ["TABLE_NAME"]
# AWS Clients
secrets_manager_client = boto3.client("secretsmanager")
ssm_client = boto3.client("ssm", region_name=REGION)
bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)

# Cached resources
connection = None
db_secret = None
BEDROCK_LLM_ID = None




def get_secret(secret_name, expect_json=True):
    global db_secret
    if db_secret is None:
        try:
            response = secrets_manager_client.get_secret_value(SecretId=secret_name)["SecretString"]
            db_secret = json.loads(response) if expect_json else response
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode JSON for DB secret: {e}")
            raise ValueError(f"DB Secret is not properly formatted as JSON.")
        except Exception as e:
            logger.error(f"Error fetching DB secret: {e}")
            raise
    return db_secret


def get_parameter(param_name, cached_var):
    """
    Fetch a parameter value from Systems Manager Parameter Store.
    """
    if cached_var is None:
        try:
            response = ssm_client.get_parameter(Name=param_name, WithDecryption=True)
            cached_var = response["Parameter"]["Value"]
        except Exception as e:
            logger.error(f"Error fetching parameter {param_name}: {e}")
            raise
    return cached_var

def initialize_constants():
    global BEDROCK_LLM_ID
    BEDROCK_LLM_ID = get_parameter(BEDROCK_LLM_PARAM, BEDROCK_LLM_ID)


    

def connect_to_db():
    global connection
    if connection is None or connection.closed:
        try:
            secret = get_secret(DB_SECRET_NAME)
            connection_params = {
                'dbname': secret["dbname"],
                'user': secret["username"],
                'password': secret["password"],
                'host': RDS_PROXY_ENDPOINT,
                'port': secret["port"]
            }
            connection_string = " ".join([f"{key}={value}" for key, value in connection_params.items()])
            connection = psycopg.connect(connection_string)
            logger.info("Connected to the database!")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            if connection:
                connection.rollback()
                connection.close()
            raise
    return connection


def get_case_details(case_id):
    connection = connect_to_db()
    if connection is None:
        logger.error("No database connection available.")
        return {
            "statusCode": 500,
            "body": json.dumps("Database connection failed.")
        }
    
    try:
        cur = connection.cursor()
        logger.info("Connected to RDS instance!")
        cur.execute("""
            SELECT case_title, case_type, jurisdiction, case_description
            FROM "cases"
            WHERE case_id = %s;
        """, (case_id,))

        result = cur.fetchone()
        logger.info(f"Query result: {result}")

        cur.close()

        if result:
            case_title, case_type, jurisdiction, case_description = result
            
            # Handle jurisdiction list
            if isinstance(jurisdiction, list):
                jurisdiction = ", ".join(jurisdiction)

            logger.info(f"client details found for case_id {case_id}: "
                        f"Title: {case_title} \n Case type: {case_type} \n Jurisdiction: {jurisdiction} \n Case description: {case_description}")
            return case_type, jurisdiction, case_description
        else:
            logger.warning(f"No details found for case_id {case_id}")
            return None, None, None, None

    except Exception as e:
        logger.error(f"Error fetching case details: {e}")
        if cur:
            cur.close()
        connection.rollback()
        return None, None, None, None

def get_unlocked_blocks(case_id):
    """
    Retrieve list of unlocked blocks for a case.
    """
    connection = connect_to_db()
    if connection is None:
        return []

    try:
        cur = connection.cursor()
        cur.execute("""
            SELECT unlocked_blocks FROM cases WHERE case_id = %s;
        """, (case_id,))
        result = cur.fetchone()
        cur.close()
        
        if result and result[0]:
            return result[0]
        return []
    except Exception as e:
        logger.error(f"Error fetching unlocked blocks: {e}")
        if cur:
            cur.close()
        connection.rollback()
        return []

def get_latest_block_summaries(case_id, unlocked_blocks):
    """
    Retrieve the most recent summary for each unlocked block.
    """
    connection = connect_to_db()
    if connection is None or not unlocked_blocks:
        return []
    
    summaries = []
    try:
        cur = connection.cursor()
        # Fetch latest summary for each block type in unlocked_blocks
        # We process them one by one or via IN clause. 
        # Using specific query to get latest per block type.
        
        query = """
            SELECT DISTINCT ON (block_context) 
                block_context, content, title
            FROM summaries
            WHERE case_id = %s 
                AND scope = 'block'
                AND block_context = ANY(%s)
            ORDER BY block_context, time_created DESC;
        """
        
        cur.execute(query, (case_id, unlocked_blocks))
        rows = cur.fetchall()
        cur.close()
        
        for row in rows:
            summaries.append({
                "block_type": row[0],
                "content": row[1],
                "title": row[2]
            })
            
        return sorted(summaries, key=lambda x: unlocked_blocks.index(x['block_type']) if x['block_type'] in unlocked_blocks else 999)

    except Exception as e:
        logger.error(f"Error fetching block summaries: {e}")
        if cur:
            cur.close()
        connection.rollback()
        return []

def update_summaries(case_id, summary, block_type, scope='block'):
    """
    Adds a new summary for a given case.
    
    Args:
        case_id (str): The ID of the case to update.
        summary (str): The new summary for the case.
        block_type (str): The block type (intake, issues, etc.). None if full-case.
        scope (str): 'block' or 'full_case'
    
    Returns:
        bool: True if successful, False otherwise.
    """
    logger.info(f"Adding new summary for case_id {case_id}, scope {scope}, block {block_type}")
    connection = connect_to_db()
    if connection is None:
        logger.error("No database connection available.")
        return False
    
    # Map block_type to human-readable titles
    block_titles = {
        "intake": "Intake Facts Summary",
        "issues": "Issue Identification Summary",
        "research": "Research Strategy Summary",
        "argument": "Argument Construction Summary",
        "contrarian": "Contrarian Analysis Summary",
        "policy": "Policy Context Summary"
    }
    
    if scope == 'full_case':
        title = "Full Case Summary"
        block_context = None
    else:
        title = block_titles.get(block_type, "Block Summary")
        block_context = block_type
    
    try:
        cur = connection.cursor()
        logger.info("Connected to RDS instance!")
        
        # Insert a new summary
        cur.execute("""
            INSERT INTO summaries (case_id, content, scope, block_context, title, time_created)
            VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        """, (case_id, summary, scope, block_context, title))
            
        connection.commit()
        cur.close()
        logger.info(f"Successfully added new summary for case_id {case_id}")
        return True

    except Exception as e:
        logger.error(f"Error adding summary: {e}")
        if cur:
            cur.close()
        connection.rollback()
        return False

def handler(event, context):
    """
    Lambda function handler for generating conversation summaries.
    
    Expected event structure:
    {
        "queryStringParameters": {
            "case_id": "unique_case_id",
            "sub_route": "intake-facts" | "issue-identification" | "full-case" | etc.
        }
    }
    """
    logger.info("Summary Generation Lambda function is called!")
    initialize_constants()

    query_params = event.get("queryStringParameters", {})
    case_id = query_params.get("case_id", "")
    sub_route = query_params.get("sub_route", "intake-facts") 

    if not case_id:
        return {
            'statusCode': 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps("Missing required parameters: case_id")
        }

    case_type, jurisdiction, case_description = get_case_details(case_id)
    if case_type is None or jurisdiction is None or case_description is None:
        logger.error(f"Error fetching case details for case_id: {case_id}")
        return {
            'statusCode': 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Error fetching summary details')
        }

    try:
        logger.info("Creating Bedrock LLM instance.")
        llm = get_bedrock_llm(BEDROCK_LLM_ID)
    except Exception as e:
        logger.error(f"Error getting LLM from Bedrock: {e}")
        return {
            'statusCode': 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            'body': json.dumps('Error getting LLM from Bedrock')
        }

    # --- Full Case Summary Logic ---
    if sub_route == "full-case":
        logger.info(f"Generating full case summary for case_id: {case_id}")
        
        # 1. Get unlocked blocks
        unlocked_blocks = get_unlocked_blocks(case_id)
        if not unlocked_blocks:
            return {
                'statusCode': 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                'body': json.dumps("No blocks have been unlocked yet for this case.")
            }
        
        logger.info(f"Unlocked blocks: {unlocked_blocks}")

        # 2. Get latest summaries for unlocked blocks
        block_summaries = get_latest_block_summaries(case_id, unlocked_blocks)
        if not block_summaries:
             return {
                'statusCode': 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                'body': json.dumps("No block summaries found to synthesize. Please generate summaries for individual blocks first.")
            }
        
        logger.info(f"Found {len(block_summaries)} block summaries to synthesize.")

        # 3. Generate full case summary
        try:
            response = generate_full_case_summary(
                block_summaries=block_summaries,
                llm=llm,
                case_type=case_type,
                case_description=case_description,
                jurisdiction=jurisdiction
            )
        except Exception as e:
            logger.error(f"Error generating full case summary: {e}")
            return {
                'statusCode': 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                'body': json.dumps('Error generating full case summary')
            }

        # 4. Save summary
        try:
            update_summaries(case_id, response, None, scope='full_case')
        except Exception as e:
            logger.error(f"Error saving full case summary: {e}")
             # We don't fail the request if save fails, just log it, but here we return error to be safe
            return {
                'statusCode': 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                'body': json.dumps('Error saving full case summary')
            }
            
        return {
            "statusCode": 200,
            "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
            "body": json.dumps({
                "llm_output": response
            })
        }

    # --- Block Specific Summary Logic (Existing) ---
    else:
        # Map sub_route to block_type enum
        subroute_map = {
            "intake-facts": "intake",
            "issue-identification": "issues",
            "research-strategy": "research",
            "argument-construction": "argument",
            "contrarian-analysis": "contrarian",
            "policy-context": "policy"
        }
        
        block_type = subroute_map.get(sub_route, "intake")  # Default to intake
        
        # Construct unique session ID based on case and block type
        session_id = f"{case_id}-{block_type}"
        
        try:
            logger.info(f"Retrieving dynamo history for session_id: {session_id}")
            messages = retrieve_dynamodb_history(TABLE_NAME, session_id)
        except Exception as e:
            logger.error(f"Error retrieving dynamo history: {e}")
            return {
                'statusCode': 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                'body': json.dumps('Error retrieving dynamo history')
            }
        
        try:
            logger.info("Generating response from the LLM.")
            response = generate_lawyer_summary(
                messages=messages,
                llm=llm,
                case_type=case_type,
                case_description=case_description,
                jurisdiction=jurisdiction,
                block_type=block_type
            )
        except Exception as e:
            logger.error(f"Error getting response: {e}")
            return {
                'statusCode': 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                'body': json.dumps('Error getting response')
            }
            
        try:
            logger.info(f"Updating case summary for block_type: {block_type}")
            # Note: scope defaults to 'block'
            update_summaries(case_id, response, block_type, scope='block')
        except Exception as e:
            logger.error(f"Error updating case summary: {e}")
            return {
                'statusCode': 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
                'body': json.dumps('Error updating case summary')
            }
            
        return {
            "statusCode": 200,
            "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*",
                },
            "body": json.dumps({
                "llm_output": response
            })
        }