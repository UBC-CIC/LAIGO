import os
import json
import logging
import hashlib
import base64
import uuid
import time
import boto3
import psycopg
from botocore.exceptions import ClientError

from helpers.chat import get_bedrock_llm, get_response

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
DB_SECRET_NAME = os.environ["SM_DB_CREDENTIALS"]
REGION = os.environ["REGION"]
RDS_PROXY_ENDPOINT = os.environ["RDS_PROXY_ENDPOINT"]
BEDROCK_LLM_PARAM = os.environ["BEDROCK_LLM_PARAM"]
TABLE_NAME_PARAM = os.environ["TABLE_NAME_PARAM"]

# AWS clients
secrets_manager_client = boto3.client("secretsmanager")
ssm_client = boto3.client("ssm", region_name=REGION)
bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)

# Globals
connection = None
db_secret = None
BEDROCK_LLM_ID = None
TABLE_NAME = None

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return super().default(obj)


def get_secret(secret_name, expect_json=True):
    global db_secret
    if db_secret is None:
        try:
            response = secrets_manager_client.get_secret_value(SecretId=secret_name)["SecretString"]
            db_secret = json.loads(response) if expect_json else response
        except Exception as e:
            logger.error(f"Failed to fetch secret {secret_name}: {e}")
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
        secret = get_secret(DB_SECRET_NAME)
        conn_str = f"host={RDS_PROXY_ENDPOINT} dbname={secret['dbname']} user={secret['username']} password={secret['password']} port={secret['port']}"
        try:
            connection = psycopg.connect(conn_str)
            logger.info("Connected to RDS via proxy")
        except Exception as e:
            logger.error(f"Database connection error: {e}")
            raise
    return connection


def hash_uuid(uuid_str):
    sha = hashlib.sha256(uuid_str.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(sha).decode("utf-8")[:6]


def capitalize_title(s):
    return ' '.join(word.capitalize() for word in s.split())


def get_case_details(case_id):
    conn = connect_to_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT case_type, jurisdiction, case_description, statute, province FROM "cases" WHERE case_id = %s;
        """, (case_id,))
        row = cur.fetchone()
        cur.close()
        return row if row else (None, None, None, None, None)
    except Exception as e:
        logger.error(f"Error fetching case details: {e}")
        return None, None, None, None, None


def update_title(case_id, title):
    conn = connect_to_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE "cases" SET case_title = %s WHERE case_id = %s;
        """, (title, case_id))
        conn.commit()
        cur.close()
    except Exception as e:
        logger.error(f"Error updating title: {e}")
        conn.rollback()


def setup_guardrail(guardrail_name):
    bedrock_client = boto3.client("bedrock", region_name=REGION)
    paginator = bedrock_client.get_paginator('list_guardrails')
    guardrail_id = guardrail_version = None

    for page in paginator.paginate():
        for gr in page.get('guardrails', []):
            if gr['name'] == guardrail_name:
                guardrail_id = gr['id']
                guardrail_version = gr.get('version')
                break
        if guardrail_id:
            break

    if not guardrail_id:
        resp = bedrock_client.create_guardrail(
            name=guardrail_name,
            description='Block financial advice',
            topicPolicyConfig={
                'topicsConfig': [
                    {'name': 'FinancialAdvice', 'definition': '...', 'examples': ['...'], 'type': 'DENY'},
                ]
            },
            sensitiveInformationPolicyConfig={
                'piiEntitiesConfig': [
                    {'type': 'EMAIL', 'action': 'BLOCK'},
                    {'type': 'PHONE', 'action': 'BLOCK'},
                    {'type': 'NAME', 'action': 'BLOCK'}
                ]
            },
            blockedInputMessaging='Sorry, I cannot process that content.',
            blockedOutputsMessaging='Sorry, I cannot process that content.'
        )
        guardrail_id = resp['guardrailId']
        time.sleep(5)
        ver_resp = bedrock_client.create_guardrail_version(
            guardrailIdentifier=guardrail_id,
            description='Initial version',
            clientRequestToken=str(uuid.uuid4())
        )
        guardrail_version = ver_resp['version']

    return guardrail_id, guardrail_version


def _response(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': '*',
        },
        'body': json.dumps(body, cls=CustomJSONEncoder)
    }


def _handle_guardrail_error(resp):
    message = 'Input blocked by content guardrails.'
    for assessment in resp.get('assessments', []):
        if 'sensitiveInformationPolicy' in assessment:
            message = 'Please remove personal information.'
            break
    return _response(400, {'error': message})


# def handler(event, context):
#     logger.info("Lambda function called!")
#     action = event.get("queryStringParameters", {}).get("action")

#     if action == "new_case":
#         return handle_new_case(event)
#     elif action == "generate_title":
#         return handle_generate_title(event)
#     else:
#         return _response(400, {"error": "Missing or invalid 'action' query parameter"})


def handler(event, context):
    try:
        cognito_id = event.get('queryStringParameters', {}).get('user_id')
        if not cognito_id:
            return _response(400, {'error': 'Missing user_id'})

        body = json.loads(event.get('body', '{}'))
        case_title = body.get('case_title')
        case_type = body.get('case_type')
        jurisdiction = body.get('jurisdiction')
        case_desc = body.get('case_description')
        province = body.get('province')
        statute = body.get('statute')

        combined = f"{case_title} {case_type} {jurisdiction} {case_desc}"
        guardrail_id, guardrail_version = setup_guardrail('comprehensive-guardrails')
        guard_resp = bedrock_runtime.apply_guardrail(
            guardrailIdentifier=guardrail_id,
            guardrailVersion=guardrail_version,
            source='INPUT',
            content=[{'text': {'text': combined, 'qualifiers': ['guard_content']}}]
        )
        if guard_resp.get('action') == 'GUARDRAIL_INTERVENED':
            return _handle_guardrail_error(guard_resp)

        conn = connect_to_db()
        cur = conn.cursor()
        cur.execute('SELECT user_id FROM "users" WHERE cognito_id=%s', (cognito_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            return _response(404, {'error': 'User not found'})
        user_id = row[0]

        cur.execute('''INSERT INTO "cases"(user_id, case_title, case_type, jurisdiction, case_description, province, statute, status, last_updated)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,'In Progress',CURRENT_TIMESTAMP) RETURNING case_id''',
                    (user_id, case_title, case_type, jurisdiction, case_desc, province, statute))
        case_id = cur.fetchone()[0]

        case_hash = hash_uuid(str(case_id))
        cur.execute('UPDATE "cases" SET case_hash=%s WHERE case_id=%s', (case_hash, case_id))
        conn.commit()
        cur.close()

        try:
            case_title = handle_generate_title(case_id, case_type, jurisdiction, case_desc, province)
            return _response(200, {'case_id': str(case_id), 'case_hash': case_hash, 'case_title': capitalize_title(case_title)})
        except Exception as e:
            logger.warning(f"Title generation failed: {e}", exc_info=True)
            return _response(200, {
                'case_id': str(case_id),
                'case_hash': case_hash,
                'warning': 'Case created but title generation failed.'
            })

    except Exception as err:
        logger.error(f"Error in new_case: {err}", exc_info=True)
        return _response(500, {'error': 'Internal server error'})


def handle_generate_title(case_id: str, case_type: str, jurisdiction: str, case_description: str, province: str) -> str:
    initialize_constants()

    try:
        llm = get_bedrock_llm(BEDROCK_LLM_ID)
        response = get_response(
            case_type=case_type,
            jurisdiction=jurisdiction,
            case_description=case_description,
            province=province,
            llm=llm
        )
        update_title(case_id, capitalize_title(response))
        return response
    except Exception as e:
        logger.error(f"Error generating or updating title: {e}", exc_info=True)
        raise RuntimeError("LLM processing or DB update failed")
