import os
import json
import boto3
import logging
import psycopg
import time
from langchain_aws import BedrockLLM
from langchain_community.chat_message_histories import DynamoDBChatMessageHistory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()

# Environment variables
DB_SECRET_NAME = os.environ["SM_DB_CREDENTIALS"]
REGION = os.environ["REGION"]
RDS_PROXY_ENDPOINT = os.environ["RDS_PROXY_ENDPOINT"]
BEDROCK_LLM_PARAM = os.environ["BEDROCK_LLM_PARAM"]
TABLE_NAME_PARAM = os.environ["TABLE_NAME_PARAM"]

# AWS Clients
secrets_manager_client = boto3.client("secretsmanager")
ssm_client = boto3.client("ssm", region_name=REGION)
dynamodb_client = boto3.client("dynamodb")

# Cached resources
connection = None
db_secret = None
BEDROCK_LLM_ID = None
TABLE_NAME = None

def get_secret(secret_name, expect_json=True):
    global db_secret
    if db_secret is None:
        try:
            response = secrets_manager_client.get_secret_value(SecretId=secret_name)["SecretString"]
            db_secret = json.loads(response) if expect_json else response
        except Exception as e:
            logger.error(f"Failed to fetch or decode secret: {e}")
            raise
    return db_secret

def get_parameter(param_name, cached_var):
    if cached_var is None:
        try:
            response = ssm_client.get_parameter(Name=param_name, WithDecryption=True)
            cached_var = response["Parameter"]["Value"]
        except Exception as e:
            logger.error(f"Error fetching parameter {param_name}: {e}")
            raise
    return cached_var

def initialize_constants():
    global BEDROCK_LLM_ID, TABLE_NAME
    BEDROCK_LLM_ID = get_parameter(BEDROCK_LLM_PARAM, BEDROCK_LLM_ID)
    TABLE_NAME = get_parameter(TABLE_NAME_PARAM, TABLE_NAME)

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

def get_assessment_prompt_template(block_type):
    connection = connect_to_db()
    if connection is None:
        return None

    try:
        cur = connection.cursor()
        # Fetch prompt with category 'assessment'
        cur.execute("""
            SELECT prompt_text
            FROM prompt_versions
            WHERE block_type = %s
              AND category = 'assessment'
              AND is_active = true
            ORDER BY version_number DESC
            LIMIT 1;
        """, (block_type,))
        
        result = cur.fetchone()
        cur.close()

        if result:
            return result[0]
        else:
            logger.warning(f"No active assessment prompt found for block_type: {block_type}")
            return None
    except Exception as e:
        logger.error(f"Error fetching assessment prompt: {e}")
        connection.rollback()
        return None


def fetch_chat_history(session_id):
    if not TABLE_NAME:
        logger.error("TABLE_NAME not initialized")
        return ""
        
    try:
        history = DynamoDBChatMessageHistory(
            table_name=TABLE_NAME,
            session_id=session_id
        )
        
        # Get messages
        messages = history.messages
        
        formatted_messages = []
        for msg in messages:
            msg_type = msg.type.upper()
            content = msg.content
            formatted_messages.append(f"{msg_type}: {content}")
            
        return "\n\n".join(formatted_messages)
    except Exception as e:
        logger.error(f"Error fetching chat history from DynamoDB: {e}")
        return ""

def unlock_next_block(case_id, next_block):
    connection = connect_to_db()
    if connection is None:
        return False
        
    try:
        cur = connection.cursor()
        # Append next_block to unlocked_blocks array if not already present
        cur.execute("""
            UPDATE cases
            SET unlocked_blocks = array_append(unlocked_blocks, %s)
            WHERE case_id = %s
              AND NOT (%s = ANY(unlocked_blocks));
        """, (next_block, case_id, next_block))
        
        connection.commit()
        cur.close()
        logger.info(f"Unlocked block {next_block} for case {case_id}")
        return True
    except Exception as e:
        logger.error(f"Error unlocking block: {e}")
        connection.rollback()
        output = str(e)
        return False

def handler(event, context):
    logger.info("Assess Progress Lambda function called")
    initialize_constants()
    
    # Parse body
    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'body': json.dumps('Invalid JSON body')
        }
        
    case_id = body.get("case_id")
    block_type = body.get("block_type")
    
    if not case_id or not block_type:
        return {
            'statusCode': 400,
            'body': json.dumps('Missing required parameters: case_id, block_type')
        }

    # Determine progression map
    # Intake -> Issues -> Research -> (Argument, Contrarian, Policy)
    progression_map = {
        "intake": "issues",
        "issues": "research",
        "research": ["argument", "contrarian", "policy"] # Unlocks all three
    }
    
    next_step = progression_map.get(block_type)
    if not next_step:
        logger.info(f"No next step defined for block {block_type} or end of chain.")
        return {
            'statusCode': 200,
            'body': json.dumps({'unlocked': False, 'reasoning': 'End of progression chain.'})
        }
    
    session_id = f"{case_id}-{block_type}"
    chat_history = fetch_chat_history(session_id)
    
    if not chat_history:
        return {
            'statusCode': 200,
            'body': json.dumps({'unlocked': False, 'reasoning': 'Insufficient chat history.'})
        }
        
    prompt_template = get_assessment_prompt_template(block_type)
    if not prompt_template:
        logger.error(f"Assessment prompt not found for {block_type}")
        # Fallback or strict fail
        return {
            'statusCode': 500,
            'body': json.dumps('Configuration error: No assessment prompt found.')
        }

    # Construct complete prompt
    system_instruction = f"""
    You are an expert legal instruction assistant. Your goal is to assess whether the student has sufficiently completed the objectives of the current '${block_type}' phase based on the conversation history.
    
    PROMPT CRITERIA:
    {prompt_template}
    
    CONVERSATION HISTORY:
    {chat_history}
    
    INSTRUCTIONS:
    - Analyze the detailed history against the criteria.
    - Result MUST be a JSON object: {{ "progress": int, "reasoning": "brief explanation" }}
    - "progress": A number between 0 and 5, returning 0 if they have not met the main goals and are not ready to move on. Returning 5 if they have met the main goals and are ready to move on.
    - "reasoning": 3-4 sentences explaining why they are ready or what is missing.
    - Output ONLY the JSON object.
    """
    
    try:
        # Invoke Bedrock
        llm = BedrockLLM(
            model_id=BEDROCK_LLM_ID,
            model_kwargs={"temperature": 0.0, "max_tokens": 512}
        )
        
        response_text = llm.invoke(system_instruction)
        logger.info(f"LLM Assessment Response: {response_text}")
        
        # Parse response 
        # Find start and end of JSON
        try:
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            json_str = response_text[start:end]
            result = json.loads(json_str)
        except Exception:
            logger.error(f"Failed to parse LLM response as JSON: {response_text}")
            return {
                'statusCode': 200,
                'body': json.dumps({'unlocked': False, 'reasoning': 'Error parsing assessment result.'})
            }
            
        progress = result.get("progress", 0)
        reasoning = result.get("reasoning", "No reasoning provided.")
        
        response_data = {
            "unlocked": False,
            "reasoning": reasoning
        }
        
        if progress == 5:
            # Unlock next block(s)
            targets = next_step if isinstance(next_step, list) else [next_step]
            unlocked_any = False
            for target in targets:
                if unlock_next_block(case_id, target):
                    unlocked_any = True
            
            response_data["unlocked"] = True
            response_data["next_block"] = targets if isinstance(next_step, list) else next_step
            
        return {
            'statusCode': 200,
            'headers': {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "*"
            },
            'body': json.dumps(response_data)
        }
        
    except Exception as e:
        logger.error(f"Error during assessment execution: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"Internal server error: {str(e)}")
        }
