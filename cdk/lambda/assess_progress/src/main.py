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
            logger.info(f"Fetching secret: {secret_name}")
            response = secrets_manager_client.get_secret_value(SecretId=secret_name)["SecretString"]
            db_secret = json.loads(response) if expect_json else response
        except Exception as e:
            logger.exception(f"Failed to fetch or decode secret '{secret_name}': {e}")
            raise
    return db_secret

def get_parameter(param_name, cached_var):
    if cached_var is None:
        try:
            logger.info(f"Fetching SSM parameter: {param_name}")
            response = ssm_client.get_parameter(Name=param_name, WithDecryption=True)
            cached_var = response["Parameter"]["Value"]
        except Exception as e:
            logger.exception(f"Error fetching parameter '{param_name}': {e}")
            raise
    return cached_var

def initialize_constants():
    global BEDROCK_LLM_ID, TABLE_NAME
    try:
        BEDROCK_LLM_ID = get_parameter(BEDROCK_LLM_PARAM, BEDROCK_LLM_ID)
        TABLE_NAME = get_parameter(TABLE_NAME_PARAM, TABLE_NAME)
    except Exception as e:
        logger.exception("Failed to initialize constants")
        raise

def connect_to_db():
    global connection
    if connection is None or connection.closed:
        try:
            logger.info("Connecting to database...")
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
            logger.info("Successfully connected to the database!")
        except Exception as e:
            logger.exception(f"Failed to connect to database: {e}")
            if connection:
                try:
                    connection.rollback()
                    connection.close()
                except Exception as close_err:
                    logger.error(f"Error closing connection after failure: {close_err}")
            raise
    return connection

def get_assessment_prompt_template(block_type):
    connection = connect_to_db()
    if connection is None:
        logger.error("DB connection is None when trying to fetch prompt")
        return None

    try:
        cur = connection.cursor()
        # Fetch prompt with category 'assessment'
        logger.info(f"Fetching assessment prompt for block_type: {block_type}")
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
        logger.exception(f"Error fetching assessment prompt for block_type '{block_type}': {e}")
        try:
            connection.rollback()
        except:
            pass
        return None


def fetch_chat_history(session_id):
    if not TABLE_NAME:
        logger.error("TABLE_NAME not initialized, cannot fetch chat history")
        return ""
        
    try:
        logger.info(f"Fetching chat history for session_id: {session_id}")
        history = DynamoDBChatMessageHistory(
            table_name=TABLE_NAME,
            session_id=session_id
        )
        
        # Get messages
        messages = history.messages
        logger.info(f"Retrieved {len(messages)} messages from history")
        
        formatted_messages = []
        for msg in messages:
            msg_type = msg.type.upper()
            content = msg.content
            formatted_messages.append(f"{msg_type}: {content}")
            
        return "\n\n".join(formatted_messages)
    except Exception as e:
        logger.exception(f"Error fetching chat history from DynamoDB for session '{session_id}': {e}")
        return ""

def unlock_next_block(case_id, next_block):
    connection = connect_to_db()
    if connection is None:
        return False
        
    try:
        cur = connection.cursor()
        # Append next_block to unlocked_blocks array if not already present
        logger.info(f"Attempting to unlock block '{next_block}' for case '{case_id}'")
        cur.execute("""
            UPDATE cases
            SET unlocked_blocks = array_append(unlocked_blocks, %s)
            WHERE case_id = %s
              AND NOT (%s = ANY(unlocked_blocks));
        """, (next_block, case_id, next_block))
        
        connection.commit()
        row_count = cur.rowcount
        cur.close()
        
        if row_count > 0:
            logger.info(f"Successfully unlocked block '{next_block}' for case '{case_id}'")
        else:
            logger.info(f"Block '{next_block}' was already unlocked or case '{case_id}' not found.")
            
        return True
    except Exception as e:
        logger.exception(f"Error unlocking block '{next_block}' for case '{case_id}': {e}")
        try:
            connection.rollback()
        except:
            pass
        return False
        
def _response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*"
        },
        'body': json.dumps(body)
    }

def send_to_websocket(connection_id, endpoint, request_id, msg_type, content=None, data=None):
    """Send a message to a WebSocket connection with request correlation."""
    client = boto3.client('apigatewaymanagementapi', endpoint_url=endpoint)
    message = {
        "requestId": request_id,
        "action": "assess_progress",
        "type": msg_type,
    }
    if content is not None:
        message["content"] = content
    if data is not None:
        message["data"] = data
    try:
        client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(message).encode('utf-8')
        )
    except Exception as e:
        logger.error(f"Error sending to WebSocket: {e}")

def handler(event, context):
    logger.info("Assess Progress Lambda function started")
    
    # Check if this is a WebSocket invocation
    is_websocket = event.get("isWebSocket", False)
    request_id = event.get("requestId")
    request_context = event.get("requestContext", {})
    connection_id = request_context.get("connectionId")
    domain_name = request_context.get("domainName")
    stage = request_context.get("stage")
    
    # Determine WebSocket endpoint
    ws_endpoint = None
    if is_websocket and connection_id:
        ws_endpoint = os.environ.get("WEBSOCKET_API_ENDPOINT")
        if not ws_endpoint:
            ws_endpoint = f"https://{domain_name}/{stage}"
        logger.info(f"WebSocket mode - connectionId: {connection_id}, requestId: {request_id}")
        send_to_websocket(connection_id, ws_endpoint, request_id, "start")
    
    try:
        initialize_constants()
    except Exception:
        if is_websocket and connection_id:
            send_to_websocket(connection_id, ws_endpoint, request_id, "error", content="Internal server error during initialization")
            return {"statusCode": 500}
        return _response(500, 'Internal server error during initialization')
    
    # Parse body
    try:
        body = json.loads(event.get("body", "{}"))
        logger.debug(f"Request body: {body}")
    except json.JSONDecodeError:
        logger.error("Failed to decode JSON body")
        return _response(400, 'Invalid JSON body')
        
    case_id = body.get("case_id")
    block_type = body.get("block_type")
    
    logger.info(f"Processing assessment for Case ID: {case_id}, Block Type: {block_type}")
    
    if not case_id or not block_type:
        logger.warning("Missing required parameters: case_id or block_type")
        return _response(400, 'Missing required parameters: case_id, block_type')

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
        return _response(200, {'unlocked': False, 'progress': 0, 'reasoning': 'End of progression chain.'})
    
    session_id = f"{case_id}-{block_type}"
    chat_history = fetch_chat_history(session_id)
    
    if not chat_history:
        logger.info(f"No chat history found for session {session_id}")
        return _response(200, {'unlocked': False, 'progress': 0, 'reasoning': 'Insufficient chat history.'})
        
    prompt_template = get_assessment_prompt_template(block_type)
    if not prompt_template:
        logger.error(f"Assessment prompt not found for {block_type}")
        return _response(500, 'Configuration error: No assessment prompt found.')

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
        logger.info(f"Invoking Bedrock model: {BEDROCK_LLM_ID}")
        start_time = time.time()
        
        # Invoke Bedrock
        llm = BedrockLLM(
            model_id=BEDROCK_LLM_ID,
            model_kwargs={"temperature": 0.0, "max_tokens": 512}
        )
        
        response_text = llm.invoke(system_instruction)
        duration = time.time() - start_time
        logger.info(f"Bedrock invocation took {duration:.2f}s")
        logger.info(f"LLM Assessment Response: {response_text}")
        
        # Parse response 
        # Find start and end of JSON
        try:
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            if start == -1 or end == 0:
                 raise ValueError("No JSON found in response")
            json_str = response_text[start:end]
            result = json.loads(json_str)
        except Exception as e:
            logger.error(f"Failed to parse LLM response as JSON: {response_text}. Error: {e}")
            error_data = {'unlocked': False, 'progress': 0, 'reasoning': 'Error parsing assessment result.'}
            if is_websocket and connection_id:
                send_to_websocket(connection_id, ws_endpoint, request_id, "complete", data=error_data)
                return {"statusCode": 200}
            return _response(200, error_data)
            
        progress = int(result.get("progress", 0))
        reasoning = result.get("reasoning", "No reasoning provided.")
        
        response_data = {
            "unlocked": False,
            "progress": progress,
            "reasoning": reasoning
        }
        
        if progress == 5:
            logger.info(f"Progress is 5/5. Unlocking next steps: {next_step}")
            # Unlock next block(s)
            targets = next_step if isinstance(next_step, list) else [next_step]
            unlocked_any = False
            for target in targets:
                if unlock_next_block(case_id, target):
                    unlocked_any = True
            
            response_data["unlocked"] = unlocked_any
            
        if is_websocket and connection_id:
            send_to_websocket(connection_id, ws_endpoint, request_id, "complete", data=response_data)
            return {"statusCode": 200}
        return _response(200, response_data)
        
    except Exception as e:
        logger.exception(f"Unexpected error during assessment execution: {e}")
        if is_websocket and connection_id:
            send_to_websocket(connection_id, ws_endpoint, request_id, "error", content=str(e))
            return {"statusCode": 500}
        return _response(500, f"Internal server error: {str(e)}")
