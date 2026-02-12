import os
import json
import boto3
import logging
import uuid
from langchain_aws import BedrockEmbeddings

from helpers.chat import get_bedrock_llm, get_playground_streaming_response
from helpers.vectorstore import get_noop_history_aware_retriever

# Set up logging
logger = logging.getLogger()
if len(logger.handlers) > 0:
    logger.setLevel(logging.INFO)
else:
    logging.basicConfig(level=logging.INFO)

# Environment variables
DB_SECRET_NAME = os.environ["SM_DB_CREDENTIALS"]
REGION = os.environ["REGION"]
# RDS_PROXY_ENDPOINT is availble but maybe not needed if we don't connect to Postgres for cases
RDS_PROXY_ENDPOINT = os.environ.get("RDS_PROXY_ENDPOINT") 
BEDROCK_LLM_PARAM = os.environ["BEDROCK_LLM_PARAM"]
EMBEDDING_MODEL_PARAM = os.environ["EMBEDDING_MODEL_PARAM"]
TABLE_NAME_PARAM = os.environ["TABLE_NAME_PARAM"]
BEDROCK_TEMP_PARAM = os.environ.get("BEDROCK_TEMP_PARAM")
BEDROCK_TOP_P_PARAM = os.environ.get("BEDROCK_TOP_P_PARAM")
BEDROCK_MAX_TOKENS_PARAM = os.environ.get("BEDROCK_MAX_TOKENS_PARAM")

# AWS Clients
secrets_manager_client = boto3.client("secretsmanager")
ssm_client = boto3.client("ssm", region_name=REGION)
bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)

# Cached resources
BEDROCK_LLM_ID = None
EMBEDDING_MODEL_ID = None
TABLE_NAME = None
BEDROCK_TEMP = 0.5
BEDROCK_TOP_P = 0.9
BEDROCK_MAX_TOKENS = 2048
embeddings = None

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
    global BEDROCK_LLM_ID, EMBEDDING_MODEL_ID, TABLE_NAME, embeddings, BEDROCK_TEMP, BEDROCK_TOP_P, BEDROCK_MAX_TOKENS
    BEDROCK_LLM_ID = get_parameter(BEDROCK_LLM_PARAM, BEDROCK_LLM_ID)
    EMBEDDING_MODEL_ID = get_parameter(EMBEDDING_MODEL_PARAM, EMBEDDING_MODEL_ID)
    # TABLE_NAME might be passed as env var directly for playground to point to specific table
    # But current code tries to fetch from param. 
    # Logic change: Use env var TABLE_NAME directly if available (set in CDK), otherwise param.
    TABLE_NAME = os.environ.get("TABLE_NAME")
    if not TABLE_NAME:
         TABLE_NAME = get_parameter(TABLE_NAME_PARAM, TABLE_NAME)
    
    if BEDROCK_TEMP_PARAM:
        temp_val = get_parameter(BEDROCK_TEMP_PARAM, None)
        if temp_val:
            BEDROCK_TEMP = float(temp_val)
            
    if BEDROCK_TOP_P_PARAM:
        top_p_val = get_parameter(BEDROCK_TOP_P_PARAM, None)
        if top_p_val:
            BEDROCK_TOP_P = float(top_p_val)
            
    if BEDROCK_MAX_TOKENS_PARAM:
        max_tokens_val = get_parameter(BEDROCK_MAX_TOKENS_PARAM, None)
        if max_tokens_val:
            BEDROCK_MAX_TOKENS = int(max_tokens_val)

    if embeddings is None:
        embeddings = BedrockEmbeddings(
            model_id=EMBEDDING_MODEL_ID,
            client=bedrock_runtime,
            region_name=REGION,
        )

def get_default_system_prompt():
    return '''You are a helpful assistant to me, a law student, who answers with kindness while being concise, so that it is easy to read your responses quickly yet still get valuable information from them. No need to be conversational, just skip to talking about the content. Refer to me, the law student, in the second person. I will provide you with context to a legal case I am interviewing my client about, and you exist to help provide legal context and analysis, relevant issues, possible strategies to defend the client, and other important details in a structured natural language response.

To me, the law student, when I provide you with context on certain client cases, and you should provide possible follow-up questions for me, the law student, to ask the client to help progress the case more after your initial (concise and easy to read) analysis. These are NOT for the client to ask a lawyer; this is to help me, the law student, learn what kind of questions to ask my client, so in your analysis you should provide follow-up questions for me, the law student, to ask the client as if I were a lawyer.

Initially, also break down the case and analyze it from a detailed but concise legal perspective. You should also mention certain legal information and implications that I, the law student, may have missed, and mention which part of Canadian law it is applicable to if possible or helpful (as well as cite where I can find that relevant info).

You are NOT allowed to hallucinate, informational accuracy and being up-to-date is important. If you are asked something for which you do not know, either say "I don't know" or ask for further information if applicable and not an invasion of privacy.

Do not indent your text.'''

def handler(event, context):
    logger.info("Playground Generation Lambda function is called!")
    initialize_constants()
    
    # Extract request context
    is_websocket = event.get("isWebSocket", False)
    request_context = event.get("requestContext", {})
    connection_id = request_context.get("connectionId")
    domain_name = request_context.get("domainName")
    stage = request_context.get("stage")
    request_id = event.get("requestId")
    
    # In playground, we largely rely on body params
    body = {} if event.get("body") is None else json.loads(event.get("body"))
    
    if not is_websocket or not connection_id:
        # Fallback for HTTP/Test invoke - mostly simplified for now
        return {'statusCode': 400, 'body': "Playground only supports WebSocket interactions currently."}

    logger.info("Playground mode processing...")
    
    # Extract playground parameters
    custom_prompt = body.get("custom_prompt", get_default_system_prompt())
    test_message = body.get("message_content", "")
    
    playground_block_type = body.get("block_type", "intake") # Default
    
    # Construct unique session ID based on playground marker, session_id and block_type
    session_id = body.get("session_id", str(uuid.uuid4())[:8])
    playground_session_id = f"playground-{session_id}-{playground_block_type}"
    
    # Custom model configuration (override defaults)
    custom_model_id = body.get("model_id", BEDROCK_LLM_ID)
    try:
        custom_temperature = float(body.get("temperature", BEDROCK_TEMP))
    except (ValueError, TypeError):
        custom_temperature = BEDROCK_TEMP
        
    try:
        custom_top_p = float(body.get("top_p", BEDROCK_TOP_P))
    except (ValueError, TypeError):
        custom_top_p = BEDROCK_TOP_P
        
    try:
        custom_max_tokens = int(body.get("max_tokens", BEDROCK_MAX_TOKENS))
    except (ValueError, TypeError):
        custom_max_tokens = BEDROCK_MAX_TOKENS
    
    if not test_message:
        logger.error("Playground mode requires message_content")
        return {'statusCode': 400, 'body': json.dumps("Missing message_content for playground")}
    
    try:
        # Create LLM with custom configuration
        logger.info(f"Playground: Creating LLM with model={custom_model_id}, temp={custom_temperature}, top_p={custom_top_p}, max_tokens={custom_max_tokens}")
        llm = get_bedrock_llm(
            bedrock_llm_id=custom_model_id,
            temperature=custom_temperature,
            top_p=custom_top_p,
            max_tokens=custom_max_tokens
        )
        
        websocket_endpoint = os.environ.get("WEBSOCKET_API_ENDPOINT")
        if not websocket_endpoint:
            websocket_endpoint = f"https://{domain_name}/{stage}"
        
        # Extract mock case context for playground
        mock_case_context = body.get("case_context", {})
        
        # Create a no-op history-aware retriever
        history_aware_retriever = get_noop_history_aware_retriever(llm)
        
        # Use playground streaming response
        get_playground_streaming_response(
            query=test_message,
            llm=llm,
            history_aware_retriever=history_aware_retriever,
            table_name=TABLE_NAME,
            session_id=playground_session_id,
            system_prompt=custom_prompt,
            connection_id=connection_id,
            websocket_endpoint=websocket_endpoint,
            request_id=request_id,
            case_context=mock_case_context
        )
        
        logger.info("Playground streaming response completed.")
        return {"statusCode": 200}
        
    except Exception as e:
        logger.error(f"Playground error: {e}")
        try:
            websocket_endpoint = os.environ.get("WEBSOCKET_API_ENDPOINT", f"https://{domain_name}/{stage}")
            apigw_client = boto3.client('apigatewaymanagementapi', endpoint_url=websocket_endpoint)
            apigw_client.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps({"type": "error", "content": str(e)}).encode('utf-8')
            )
        except Exception as ws_error:
            logger.error(f"Failed to send playground error to WebSocket: {ws_error}")
        return {"statusCode": 500}
