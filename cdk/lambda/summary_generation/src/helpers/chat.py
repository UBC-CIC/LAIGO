import os
import json
import boto3
import logging
import hashlib
import uuid
from datetime import datetime

import boto3
from botocore.exceptions import ClientError
from langchain_aws import ChatBedrockConverse
from langchain_core.prompts import ChatPromptTemplate

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# AWS Clients
dynamodb = boto3.client('dynamodb')
bedrock_runtime = boto3.client('bedrock-runtime')

def get_bedrock_llm(
    bedrock_llm_id: str , 
    temperature: float = 0.3
) -> ChatBedrockConverse:
    """
    Initialize a Bedrock LLM with specified parameters.
    
    Args:
        bedrock_llm_id (str): The model ID for the Bedrock LLM.
        temperature (float): Controls the randomness of the output.
    
    Returns:
        ChatBedrockConverse: Configured Bedrock LLM instance.
    """
    return ChatBedrockConverse(
        model=bedrock_llm_id,
        temperature=temperature,
        max_tokens=2048
    )

def retrieve_dynamodb_history(table_name: str, session_id: str) -> list:
    """
    Retrieve conversation history from DynamoDB for a specific session.
    
    Args:
        table_name (str): Name of the DynamoDB table storing chat history.
        session_id (str): Unique identifier for the conversation session.
    
    Returns:
        list: List of message dictionaries from the conversation history.
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
            readable_messages = []
            
            # Process each message in the history
            for msg_wrapper in history_list:
                msg = msg_wrapper.get('M', {})
                data = msg.get('data', {}).get('M', {})
                msg_type = data.get('type', {}).get('S', '')
                content = data.get('content', {}).get('S', '')
                
                # Convert to the format expected by the summarization function
                if msg_type and content:
                    readable_messages.append({
                        'role': 'user' if msg_type == 'human' else 'assistant',
                        'content': content,
                        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')  # Using current time as timestamp
                    })
            
            return readable_messages
        else:
            logger.warning(f"No history found for session_id {session_id}")
            return []
    
    except ClientError as e:
        logger.error(f"Error retrieving conversation history: {e}")
        raise

def generate_lawyer_summary(
    messages: list, 
    llm: ChatBedrockConverse, 
    case_type: str = None, 
    case_description: str = None, 
    jurisdiction: str = None,
    block_type: str = "intake"
) -> str:
    """
    Generate a concise, professional summary of the conversation for lawyers.
    
    Args:
        messages (list): List of conversation messages.
        llm (ChatBedrockConverse): Bedrock LLM for generating summary.
        case_type (str, optional): Type of legal case.
        case_description (str, optional): Brief description of the case.
        jurisdiction (str, optional): Legal jurisdiction for the case.
        block_type (str, optional): The type of block to summarize (e.g. intake, issues).
    
    Returns:
        str: Formatted lawyer-friendly summary.
    """
    # Construct conversation text
    conversation_text = "\n".join([
        f"{msg['timestamp']} - {msg['role'].upper()}: {msg['content']}"
        for msg in messages
    ])

    prompts = {
        "intake": """
            You are a professional legal summarization assistant.
            Create a concise, objective summary of the Intake & Facts conversation.
            
            IMPORTANT: Summarize ONLY the information explicitly provided in the conversation. 
            Do NOT create, hallucinate, or infer any new facts, events, or details not present in the chat history.
            
            Focus strictly on:
            1. Key facts and chronological timeline of events discussed.
            2. The parties involved and their relationships as mentioned.
            3. The client's specific objectives and concerns stated.
            4. Any critical missing information or gaps identified in the conversation.
            5. Facts that are determined as weak or not supported by evidence.
            6. Further evidence or facts that need to be established.
            
            Do NOT include legal arguments, research strategies, or broad policy discussions unless explicitly discussed.
        """,
        "issues": """
            You are a professional legal summarization assistant.
            Create a concise, objective summary of the Issue Identification conversation.
            
            IMPORTANT: Summarize ONLY the legal issues and topics explicitly discussed in the conversation.
            Do NOT analyze the case yourself, suggest new issues, or apply legal theories that were not mentioned in the chat.
            
            Focus strictly on:
            1. The primary legal questions or issues identified in the chat.
            2. Potential causes of action or defenses discussed.
            3. The relevant legal standards or tests mentioned.
            4. Distinctions made between factual disputes and legal questions.
            
            Do NOT restate the timeline of facts in detail unless necessary to frame an issue.
        """,
        "research": """
            You are a professional legal summarization assistant.
            Create a concise, objective summary of the Research Strategy conversation.
            
            IMPORTANT: Summarize ONLY the research strategy and results discussed in the conversation.
            Do NOT suggest new case law, statutes, or search terms that were not explicitly mentioned in the chat.
            
            Focus strictly on:
            1. Key search terms, keywords, and legal concepts explored.
            2. Relevant statutes, regulations, or case law identified (cite only examples from the chat).
            3. Analogous cases or precedents discussed.
            4. The jurisdiction-specific legal landscape discussed.
            
            Do NOT include detailed fact narratives or final arguments.
        """,
        "argument": """
            You are a professional legal summarization assistant.
            Create a concise, objective summary of the Argument Construction conversation.
            
            IMPORTANT: Summarize ONLY the arguments and analysis constructed in the conversation.
            Do NOT improve the arguments, add new legal reasoning, or fill in logical gaps with your own analysis.
            
            Focus strictly on:
            1. The application of law to the specific facts as discussed.
            2. The main strengths of the client's position identified in the chat.
            3. How specific evidence supports each element of the claim or defense as discussed.
            4. The logical flow and structure of the proposed arguments.
            
            Do NOT focus on gathering new facts or initial issue spotting.
        """,
        "contrarian": """
            You are a professional legal summarization assistant.
            Create a concise, objective summary of the Contrarian Analysis conversation.
            
            IMPORTANT: Summarize ONLY the counter-arguments and weaknesses identified in the conversation.
            Do NOT invent new weaknesses, potential defenses, or risks that were not discussed in the chat.
            
            Focus strictly on:
            1. Potential weaknesses, vulnerabilities, or fatal flaws identified.
            2. Likely counter-arguments or defenses from the opposing party discussed.
            3. Critical gaps in evidence or legal support noted.
            4. Strategies discussed for mitigating these risks.
            
            Focus on the "Devil's Advocate" perspective as it appeared in the conversation.
        """,
        "policy": """
            You are a professional legal summarization assistant.
            Create a concise, objective summary of the Policy Context conversation.
            
            IMPORTANT: Summarize ONLY the policy discussions present in the conversation.
            Do NOT add external policy considerations, legislative history, or social contexts not mentioned in the chat.
            
            Focus strictly on:
            1. Broader public policy implications discussed.
            2. Legislative intent mentioned.
            3. Social, economic, or ethical factors discussed.
            4. Systemic issues or non-legal considerations relevant to the client as discussed.
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

    # Create a prompt for summarization
    summary_prompt = ChatPromptTemplate.from_messages([
        ("system", f"""
        {{selected_prompt_instruction}}
        
        Respond in a proper, readable, markdown format.
        Use a clear, professional tone. Organize the summary with clear headings.
        Avoid personal opinions and stick to the observable facts from the conversation.
        
        Case Metadata:
        - Case Type: {{case_type}}
        - Case Description: {{case_description}}
        - Jurisdiction: {{jurisdiction}}
        """),
        ("human", "Here is the conversation to summarize:\n{{conversation}}")
    ])
    
    # Generate summary
    summary_chain = summary_prompt | llm
    summary = summary_chain.invoke({
        "selected_prompt_instruction": selected_prompt_instruction,
        "conversation": conversation_text,
        "case_type": case_type or "Not Specified",
        "case_description": case_description or "No additional description provided",
        "jurisdiction": jurisdiction or "Not Specified"
    }).content
    
    return summary

def generate_full_case_summary(
    block_summaries: list,  # [{block_type, content, title}, ...]
    llm: ChatBedrockConverse,
    case_type: str = None,
    case_description: str = None,
    jurisdiction: str = None
) -> str:
    """
    Synthesize multiple block summaries into a cohesive full-case summary.
    
    Args:
        block_summaries (list): List of dictionaries containing block summaries.
        llm (ChatBedrockConverse): Bedrock LLM instance.
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
        You are a professional legal document compiler.

        You are provided with summaries from different stages of legal case analysis.
        These summaries represent ONLY the blocks that have been completed so far.
        Each summary contains structured analytical information that must be preserved.
        
        CRITICAL INSTRUCTIONS:
        1. PRESERVE the original structure, headings, and organization from each block summary
        2. PRESERVE all analytical elements including:
           - Weak points in evidence
           - Established facts
           - Further evidence needed
           - Legal issues identified
           - Research findings
           - Argument structures
           - Counter-arguments
           - Policy considerations
        3. Work ONLY with the summaries provided - do not invent information for missing stages
        4. If a stage is not provided, completely omit it from the compilation
        5. Organize sections in their natural legal workflow order (Intake → Issues → Research → Arguments → Analysis → Policy)
        6. You may add brief transitional sentences between sections if needed for flow, but keep them minimal
        7. Do NOT rewrite or paraphrase the content - maintain the exact analytical detail
        8. Do NOT merge structured lists into narrative paragraphs
        9. Use clear section headers that match the provided block titles
        
        Do NOT:
        - Rewrite structured analytical elements into narrative form
        - Summarize or condense the information from the blocks
        - Add new information not present in the provided summaries
        - Create placeholder sections for missing blocks
        - Infer or assume what missing blocks might contain
        
        Your goal is to compile the provided summaries into a single document while preserving their analytical structure and detail.
    """

    summary_prompt = ChatPromptTemplate.from_messages([
        ("system", """
        {instruction}
        
        IMPORTANT: Respond with ONLY the synthesized summary content in markdown format.
        Do not include any preamble, explanation, or meta-commentary.
        Start directly with the summary content.
        """),
        ("human", "Here are the summaries from different stages of the case:\n{summaries}")
    ])
    
    # Generate summary
    summary_chain = summary_prompt | llm
    summary = summary_chain.invoke({
        "instruction": prompt_instruction,
        "summaries": summaries_text
    }).content
    
    return summary
