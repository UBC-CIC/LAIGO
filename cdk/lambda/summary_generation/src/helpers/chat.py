import os
import json
import boto3
import logging

from botocore.exceptions import ClientError

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# AWS Clients
dynamodb = boto3.client('dynamodb')
bedrock_runtime = boto3.client('bedrock-runtime')


def _build_invoke_request(llm: dict, system_prompt: str, user_prompt: str) -> dict:
    model_id = llm["model_id"]

    if model_id.startswith("anthropic."):
        return {
            "anthropic_version": "bedrock-2023-05-31",
            "system": system_prompt,
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": user_prompt}],
                }
            ],
            "max_tokens": llm["max_tokens"],
            "temperature": llm["temperature"],
            "top_p": llm["top_p"],
        }

    if model_id.startswith("meta."):
        return {
            "prompt": f"{system_prompt}\n\n{user_prompt}",
            "max_gen_len": llm["max_tokens"],
            "temperature": llm["temperature"],
            "top_p": llm["top_p"],
        }

    raise ValueError(f"Unsupported Bedrock model for InvokeModel: {model_id}")


def _extract_response_text(model_id: str, response_payload: dict) -> str:
    if model_id.startswith("anthropic."):
        content_blocks = response_payload.get("content", [])
        return "".join(block.get("text", "") for block in content_blocks if block.get("type") == "text")

    if model_id.startswith("meta."):
        return response_payload.get("generation") or response_payload.get("output_text") or ""

    return response_payload.get("outputText") or ""


def _invoke_model_text(llm: dict, system_prompt: str, user_prompt: str) -> str:
    request_body = _build_invoke_request(llm, system_prompt, user_prompt)
    response = bedrock_runtime.invoke_model(
        modelId=llm["model_id"],
        contentType="application/json",
        accept="application/json",
        body=json.dumps(request_body),
    )
    payload = json.loads(response["body"].read())
    return _extract_response_text(llm["model_id"], payload)


def _stream_invoke_model_text(llm: dict, system_prompt: str, user_prompt: str, send_chunk_callback=None) -> str:
    request_body = _build_invoke_request(llm, system_prompt, user_prompt)
    stream = bedrock_runtime.invoke_model_with_response_stream(
        modelId=llm["model_id"],
        contentType="application/json",
        accept="application/json",
        body=json.dumps(request_body),
    )

    full_response = ""
    for event in stream.get("body", []):
        chunk = event.get("chunk")
        if not chunk:
            continue

        try:
            event_payload = json.loads(chunk["bytes"].decode("utf-8"))
        except Exception:
            continue

        chunk_text = ""
        if llm["model_id"].startswith("anthropic."):
            event_type = event_payload.get("type")
            if event_type == "content_block_delta":
                chunk_text = event_payload.get("delta", {}).get("text", "")
        elif llm["model_id"].startswith("meta."):
            chunk_text = event_payload.get("generation") or event_payload.get("output_text") or ""

        if chunk_text:
            full_response += chunk_text
            if send_chunk_callback:
                send_chunk_callback(chunk_text)

    return full_response

def get_bedrock_llm(
    bedrock_llm_id: str,
    temperature: float = 0.3,
    max_tokens: int = 2048,
    top_p: float = 0.9,
) -> dict:
    """
    Build a Bedrock InvokeModel configuration with specified parameters.
    
    Args:
        bedrock_llm_id (str): The model ID for the Bedrock LLM.
        temperature (float): Controls the randomness of the output.
        max_tokens (int, optional): The maximum number of tokens to generate. Defaults to 2048.
        top_p (float, optional): The top_p parameter for the LLM. Defaults to 0.9.
    
    Returns:
        dict: Configured Bedrock invoke settings.
    """
    return {
        "model_id": bedrock_llm_id,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "top_p": top_p,
    }

def retrieve_dynamodb_history(table_name: str, session_id: str) -> str:
    """
    Retrieve conversation history from DynamoDB for a specific session.
    
    Args:
        table_name (str): Name of the DynamoDB table storing chat history.
        session_id (str): Unique identifier for the conversation session.
    
    Returns:
        str: Formatted conversation history as a string.
    """
    try:
        response = dynamodb.get_item(
            TableName=table_name,
            Key={
                'SessionId': {'S': session_id}
            }
        )
        
        # Extract history from the item if it exists
        if 'Item' in response and 'History' in response['Item']:
            history_list = response['Item']['History']['L']
            formatted_messages = []
            
            # Process each message in the history
            for msg_wrapper in history_list:
                msg = msg_wrapper.get('M', {})
                data = msg.get('data', {}).get('M', {})
                msg_type = data.get('type', {}).get('S', '')
                content = data.get('content', {}).get('S', '')
                
                # Format as "HUMAN: ..." or "AI: ..."
                if msg_type and content:
                    formatted_messages.append(f"{msg_type.upper()}: {content}")
            
            return "\n\n".join(formatted_messages)
        else:
            logger.warning(f"No history found for session_id {session_id}")
            return ""
    
    except ClientError as e:
        logger.error(f"Error retrieving conversation history: {e}")
        raise

def generate_lawyer_summary(
    conversation_history: str, 
    llm: dict, 
    case_type: str = None, 
    case_description: str = None, 
    jurisdiction: str = None,
    block_type: str = "intake"
) -> str:
    """
    Generate a concise, professional summary of the conversation for lawyers.
    
    Args:
        conversation_history (str): Formatted conversation history string.
        llm (dict): Bedrock InvokeModel configuration.
        case_type (str, optional): Type of legal case.
        case_description (str, optional): Brief description of the case.
        jurisdiction (str, optional): Legal jurisdiction for the case.
        block_type (str, optional): The type of block to summarize (e.g. intake, issues).
    
    Returns:
        str: Formatted lawyer-friendly summary.
    """

    prompts = {
        "intake": """
You are a legal summarization assistant helping organize the factual record of a case.

Summarize ONLY information explicitly discussed in the conversation. Do NOT invent or infer facts.

Structure your summary with these sections:

## Established Facts
- Facts confirmed with supporting evidence or documentation.

## Facts Requiring Further Evidence
- Facts stated but not yet substantiated.

## Weak Points in Evidence
- Facts where evidence is contested, incomplete, or missing.

## Parties & Relationships
- Key parties and their roles/relationships as discussed.

## Client Objectives & Concerns
- The client's stated goals and worries.

## Critical Gaps
- Important information not yet obtained.

Use markdown formatting. Only include sections where content was discussed.
        """,
        "issues": """
You are a legal summarization assistant helping identify legal issues in a case.

Summarize ONLY the issues explicitly identified in the conversation. Do NOT add your own analysis or spot new issues.

Structure your summary with these sections:

## Primary Legal Issues
- The main legal questions identified in the discussion.

## Applicable Legal Tests or Standards
- Canadian common law tests or statutory standards mentioned.

## Relevant Statutes or Legislation
- Specific statutes, regulations, or sections referenced.

## Factual vs. Legal Disputes
- Distinctions made between questions of fact and questions of law.

## Elements to Establish
- Key elements that must be proven for each cause of action or defense.

Use markdown formatting. Only include sections where content was discussed.
        """,
        "research": """
You are a legal summarization assistant helping document a legal research strategy.

Summarize ONLY the research approach and findings discussed in the conversation. Do NOT add new cases, statutes, or search terms.

Structure your summary with these sections:

## Research Questions
- The specific legal questions guiding the research.

## Search Strategy
- Keywords, search terms, and databases discussed (e.g., CanLII, Westlaw).

## Statutes & Regulations Identified
- Specific legislative provisions found or referenced.

## Case Law Identified
- Key cases discussed with their relevance noted.

## Secondary Sources
- Textbooks, articles, or commentary mentioned.

## Outstanding Research
- Areas requiring further investigation.

Use markdown formatting. Only include sections where content was discussed.
        """,
        "argument": """
You are a legal summarization assistant helping document legal argument construction.

Summarize ONLY the arguments developed in the conversation. Do NOT improve, extend, or fill gaps in the reasoning.

Structure your summary with these sections:

## Core Legal Arguments
- The main arguments constructed, each with:
  - Legal principle or authority
  - Application to the facts
  - Why the position should succeed

## Supporting Evidence
- How specific evidence supports each argument element.

## Argument Structure
- The logical flow and organization of the argumentation.

## Anticipated Strengths
- Identified strong points in the client's position.

Use markdown formatting. Only include sections where content was discussed.
        """,
        "contrarian": """
You are a legal summarization assistant helping document contrarian analysis.

Summarize ONLY the weaknesses and counterarguments identified in the conversation. Do NOT invent new vulnerabilities.

Structure your summary with these sections:

## Identified Weaknesses
- Vulnerabilities in the legal position as discussed.

## Counterarguments from Opposing Party
- Arguments the other side is likely to make.

## Evidence Gaps or Risks
- Evidentiary problems that could undermine the case.

## Authority Challenges
- Potential distinctions or limitations of relied-upon cases/statutes.

## Hidden Assumptions
- Unstated premises that may be challenged.

## Mitigation Strategies
- Approaches discussed for addressing these concerns.

Use markdown formatting. Only include sections where content was discussed.
        """,
        "policy": """
You are a legal summarization assistant helping document policy context analysis.

Summarize ONLY the policy considerations discussed in the conversation. Do NOT add external policy analysis.

Structure your summary with these sections:

## Policy Rationales
- Underlying policy purposes of relevant laws or doctrines.

## Competing Values
- Tensions between different policy objectives discussed.

## Charter Implications
- Any Charter of Rights and Freedoms considerations mentioned.

## Rule of Law / Duty of Fairness
- Procedural fairness or rule of law concerns raised.

## Administrative Law Considerations
- Relevant administrative law principles discussed.

## Comparative Approaches
- References to other jurisdictions or international law.

## Systemic Issues
- Broader social, economic, or institutional factors noted.

Use markdown formatting. Only include sections where content was discussed.
        """
    }

    # Fallback for unknown block types
    default_prompt = """
        You are a professional legal summarization assistant. 
        Create a concise, objective 1-page summary of the conversation.
        Focus on:
        1. Legal Analysis
        2. Key facts and timeline
        3. Critical details and potential legal implications
        4. Actionable items or recommendations
    """

    selected_prompt_instruction = prompts.get(block_type, default_prompt)

    system_prompt = f"""
{selected_prompt_instruction}

CRITICAL OUTPUT INSTRUCTIONS:
- Respond with ONLY the summary content in markdown format
- Do NOT include any preamble like "Here's your summary..." or "Based on the conversation..."
- Do NOT include any outro like "Let me know if this is correct..." or "Please review..."
- Start directly with the first section heading
- End with the last content point

Respond in a proper, readable, markdown format.
Use a clear, professional tone. Organize the summary with clear headings.
Avoid personal opinions and stick to the observable facts from the conversation.

Case Metadata:
- Case Type: {case_type or 'Not Specified'}
- Case Description: {case_description or 'No additional description provided'}
- Jurisdiction: {jurisdiction or 'Not Specified'}
    """.strip()

    user_prompt = f"Here is the conversation to summarize:\n{conversation_history}"
    return _invoke_model_text(llm, system_prompt, user_prompt)

def generate_lawyer_summary_streaming(
    conversation_history: str, 
    llm: dict, 
    case_type: str = None, 
    case_description: str = None, 
    jurisdiction: str = None,
    block_type: str = "intake",
    send_chunk_callback = None
) -> str:
    """
    Generate a streaming summary of the conversation for lawyers.
    
    Args:
        conversation_history (str): Formatted conversation history string.
        llm (dict): Bedrock InvokeModel configuration.
        case_type (str, optional): Type of legal case.
        case_description (str, optional): Brief description of the case.
        jurisdiction (str, optional): Legal jurisdiction for the case.
        block_type (str, optional): The type of block to summarize.
        send_chunk_callback: Callback function to send chunks to WebSocket.
    
    Returns:
        str: Formatted lawyer-friendly summary.
    """

    prompts = {
        "intake": """
You are a legal summarization assistant helping organize the factual record of a case.

Summarize ONLY information explicitly discussed in the conversation. Do NOT invent or infer facts.

Structure your summary with these sections:

## Established Facts
- Facts confirmed with supporting evidence or documentation.

## Facts Requiring Further Evidence
- Facts stated but not yet substantiated.

## Weak Points in Evidence
- Facts where evidence is contested, incomplete, or missing.

## Parties & Relationships
- Key parties and their roles/relationships as discussed.

## Client Objectives & Concerns
- The client's stated goals and worries.

## Critical Gaps
- Important information not yet obtained.

Use markdown formatting. Only include sections where content was discussed.
        """,
        "issues": """
You are a legal summarization assistant helping identify legal issues in a case.

Summarize ONLY the issues explicitly identified in the conversation. Do NOT add your own analysis or spot new issues.

Structure your summary with these sections:

## Primary Legal Issues
- The main legal questions identified in the discussion.

## Applicable Legal Tests or Standards
- Canadian common law tests or statutory standards mentioned.

## Relevant Statutes or Legislation
- Specific statutes, regulations, or sections referenced.

## Factual vs. Legal Disputes
- Distinctions made between questions of fact and questions of law.

## Elements to Establish
- Key elements that must be proven for each cause of action or defense.

Use markdown formatting. Only include sections where content was discussed.
        """,
        "research": """
You are a legal summarization assistant helping document a legal research strategy.

Summarize ONLY the research approach and findings discussed in the conversation. Do NOT add new cases, statutes, or search terms.

Structure your summary with these sections:

## Research Questions
- The specific legal questions guiding the research.

## Search Strategy
- Keywords, search terms, and databases discussed (e.g., CanLII, Westlaw).

## Statutes & Regulations Identified
- Specific legislative provisions found or referenced.

## Case Law Identified
- Key cases discussed with their relevance noted.

## Secondary Sources
- Textbooks, articles, or commentary mentioned.

## Outstanding Research
- Areas requiring further investigation.

Use markdown formatting. Only include sections where content was discussed.
        """,
        "argument": """
You are a legal summarization assistant helping document legal argument construction.

Summarize ONLY the arguments developed in the conversation. Do NOT improve, extend, or fill gaps in the reasoning.

Structure your summary with these sections:

## Core Legal Arguments
- The main arguments constructed, each with:
  - Legal principle or authority
  - Application to the facts
  - Why the position should succeed

## Supporting Evidence
- How specific evidence supports each argument element.

## Argument Structure
- The logical flow and organization of the argumentation.

## Anticipated Strengths
- Identified strong points in the client's position.

Use markdown formatting. Only include sections where content was discussed.
        """,
        "contrarian": """
You are a legal summarization assistant helping document contrarian analysis.

Summarize ONLY the weaknesses and counterarguments identified in the conversation. Do NOT invent new vulnerabilities.

Structure your summary with these sections:

## Identified Weaknesses
- Vulnerabilities in the legal position as discussed.

## Counterarguments from Opposing Party
- Arguments the other side is likely to make.

## Evidence Gaps or Risks
- Evidentiary problems that could undermine the case.

## Authority Challenges
- Potential distinctions or limitations of relied-upon cases/statutes.

## Hidden Assumptions
- Unstated premises that may be challenged.

## Mitigation Strategies
- Approaches discussed for addressing these concerns.

Use markdown formatting. Only include sections where content was discussed.
        """,
        "policy": """
You are a legal summarization assistant helping document policy context analysis.

Summarize ONLY the policy considerations discussed in the conversation. Do NOT add external policy analysis.

Structure your summary with these sections:

## Policy Rationales
- Underlying policy purposes of relevant laws or doctrines.

## Competing Values
- Tensions between different policy objectives discussed.

## Charter Implications
- Any Charter of Rights and Freedoms considerations mentioned.

## Rule of Law / Duty of Fairness
- Procedural fairness or rule of law concerns raised.

## Administrative Law Considerations
- Relevant administrative law principles discussed.

## Comparative Approaches
- References to other jurisdictions or international law.

## Systemic Issues
- Broader social, economic, or institutional factors noted.

Use markdown formatting. Only include sections where content was discussed.
        """
    }

    # Fallback for unknown block types
    default_prompt = """
        You are a professional legal summarization assistant. 
        Create a concise, objective 1-page summary of the conversation.
        Focus on:
        1. Legal Analysis
        2. Key facts and timeline
        3. Critical details and potential legal implications
        4. Actionable items or recommendations
    """

    selected_prompt_instruction = prompts.get(block_type, default_prompt)

    system_prompt = f"""
{selected_prompt_instruction}

CRITICAL OUTPUT INSTRUCTIONS:
- Respond with ONLY the summary content in markdown format
- Do NOT include any preamble like "Here's your summary..." or "Based on the conversation..."
- Do NOT include any outro like "Let me know if this is correct..." or "Please review..."
- Start directly with the first section heading
- End with the last content point

Respond in a proper, readable, markdown format.
Use a clear, professional tone. Organize the summary with clear headings.
Avoid personal opinions and stick to the observable facts from the conversation.

Case Metadata:
- Case Type: {case_type or 'Not Specified'}
- Case Description: {case_description or 'No additional description provided'}
- Jurisdiction: {jurisdiction or 'Not Specified'}
    """.strip()

    user_prompt = f"Here is the conversation to summarize:\n{conversation_history}"

    try:
        return _stream_invoke_model_text(llm, system_prompt, user_prompt, send_chunk_callback)
    except Exception as e:
        logger.error(f"Error during streaming summary generation: {e}")
        raise

def generate_full_case_summary(
    block_summaries: list,  # [{block_type, content, title}, ...]
    llm: dict,
    case_type: str = None,
    case_description: str = None,
    jurisdiction: str = None
) -> str:
    """
    Synthesize multiple block summaries into a cohesive full-case summary.
    
    Args:
        block_summaries (list): List of dictionaries containing block summaries.
        llm (dict): Bedrock InvokeModel configuration.
        case_type (str, optional): Type of legal case.
        case_description (str, optional): Brief description of the case.
        jurisdiction (str, optional): Legal jurisdiction.
        
    Returns:
        str: Synthesized full-case summary.
    """
    # Format the input summaries for the prompt
    summaries_text = "\\n\\n".join([
        f"--- SECTION: {item['title']} ({item['block_type']}) ---\\n{item['content']}"
        for item in block_summaries
    ])

    prompt_instruction = """
You are a legal case analyst. Your task is to synthesize the provided block summaries into a cohesive, comprehensive case summary.

YOUR VALUE-ADD:
1. IDENTIFY CONNECTIONS between blocks - how do the facts inform the issues? How does the research support the arguments? How do contrarian concerns relate to evidence weaknesses?
2. ADD TRANSITIONAL ANALYSIS - explain how insights from one block relate to or build upon another
3. CREATE NARRATIVE FLOW - help the reader understand the overall legal strategy and how the pieces fit together
4. HIGHLIGHT CROSS-BLOCK THEMES - if a concern appears in multiple blocks (e.g., a weak fact affecting both arguments and contrarian analysis), note this relationship

WHAT YOU MUST PRESERVE:
- ALL specific details from each block (facts, cases, statutes, arguments, etc.)
- ALL bullet points and analytical elements
- The substantive findings and conclusions from each block

STRUCTURE:
- Begin with a 3-4 sentence Executive Summary of the overall case approach
- Organize content by block in order: Intake → Issues → Research → Arguments → Contrarian → Policy
- Use block titles as section headers
- Include transitional paragraphs between sections explaining how blocks connect
- Only include blocks that are provided - do NOT create content for missing blocks

OUTPUT: Respond with ONLY the case summary in markdown format. No preamble.
    """

    system_prompt = f"""
{prompt_instruction}

IMPORTANT: Respond with ONLY the synthesized summary content in markdown format.
Do not include any preamble, explanation, or meta-commentary.
Start directly with the summary content.
    """.strip()
    user_prompt = f"Here are the summaries from different stages of the case:\n{summaries_text}"
    return _invoke_model_text(llm, system_prompt, user_prompt)

def generate_full_case_summary_streaming(
    block_summaries: list,  # [{block_type, content, title}, ...]
    llm: dict,
    case_type: str = None,
    case_description: str = None,
    jurisdiction: str = None,
    send_chunk_callback = None
) -> str:
    """
    Synthesize multiple block summaries into a cohesive full-case summary with streaming.
    
    Args:
        block_summaries (list): List of dictionaries containing block summaries.
        llm (dict): Bedrock InvokeModel configuration.
        case_type (str, optional): Type of legal case.
        case_description (str, optional): Brief description of the case.
        jurisdiction (str, optional): Legal jurisdiction.
        send_chunk_callback: Callback function to send chunks to WebSocket.
        
    Returns:
        str: Synthesized full-case summary.
    """
    # Format the input summaries for the prompt
    summaries_text = "\\n\\n".join([
        f"--- SECTION: {item['title']} ({item['block_type']}) ---\\n{item['content']}"
        for item in block_summaries
    ])

    prompt_instruction = """
You are a legal case analyst. Your task is to synthesize the provided block summaries into a cohesive, comprehensive case summary.

YOUR VALUE-ADD:
1. IDENTIFY CONNECTIONS between blocks - how do the facts inform the issues? How does the research support the arguments? How do contrarian concerns relate to evidence weaknesses?
2. ADD TRANSITIONAL ANALYSIS - explain how insights from one block relate to or build upon another
3. CREATE NARRATIVE FLOW - help the reader understand the overall legal strategy and how the pieces fit together
4. HIGHLIGHT CROSS-BLOCK THEMES - if a concern appears in multiple blocks (e.g., a weak fact affecting both arguments and contrarian analysis), note this relationship

WHAT YOU MUST PRESERVE:
- ALL specific details from each block (facts, cases, statutes, arguments, etc.)
- ALL bullet points and analytical elements
- The substantive findings and conclusions from each block

STRUCTURE:
- Begin with a 3-4 sentence Executive Summary of the overall case approach
- Organize content by block in order: Intake → Issues → Research → Arguments → Contrarian → Policy
- Use block titles as section headers
- Include transitional paragraphs between sections explaining how blocks connect
- Only include blocks that are provided - do NOT create content for missing blocks

OUTPUT: Respond with ONLY the case summary in markdown format. No preamble.
    """

    system_prompt = f"""
{prompt_instruction}

IMPORTANT: Respond with ONLY the synthesized summary content in markdown format.
Do not include any preamble, explanation, or meta-commentary.
Start directly with the summary content.
    """.strip()
    user_prompt = f"Here are the summaries from different stages of the case:\n{summaries_text}"

    try:
        return _stream_invoke_model_text(llm, system_prompt, user_prompt, send_chunk_callback)
    except Exception as e:
        logger.error(f"Error during streaming full-case summary generation: {e}")
        raise

