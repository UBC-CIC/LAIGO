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
from helpers.chat import get_bedrock_llm, generate_lawyer_summary, retrieve_dynamodb_history

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

def update_summaries(case_id, summary):
    """
    Adds a new summary for a given case.
    Each case can have multiple summaries differentiated by timestamps.
    
    Args:
        case_id (str): The ID of the case to update.
        summary (str): The new summary for the case.
    
    Returns:
        bool: True if successful, False otherwise.
    """
    logger.info(f"Adding new summary for case_id {case_id}")
    connection = connect_to_db()
    if connection is None:
        logger.error("No database connection available.")
        return False
    
    try:
        cur = connection.cursor()
        logger.info("Connected to RDS instance!")
        
        # Always insert a new summary with current timestamp
        cur.execute("""
            INSERT INTO summaries (case_id, content, time_created)
            VALUES (%s, %s, CURRENT_TIMESTAMP)
        """, (case_id, summary))
            
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
        "case_id": "unique_case_id",
        "dynamodb_table": "chat_history_table_name",
        "case_type": "optional_case_type",
        "case_description": "optional_case_description",
        "jurisdiction": "optional_jurisdiction"
    }
    """
    logger.info("Title Generation Lambda function is called!")
    initialize_constants()

    query_params = event.get("queryStringParameters", {})
    case_id = query_params.get("case_id", "")

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

    try:
        logger.info("Retrieving dynamo history")
        messages = retrieve_dynamodb_history(TABLE_NAME, case_id)
        print("messages: ", messages)
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
        logger.info("Updating case summary.")
        update_summaries(case_id, response)
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