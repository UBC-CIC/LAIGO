import logging
import boto3
import re
import json
from datetime import datetime
from langchain_aws.chat_models.bedrock import ChatBedrockConverse
from langchain_core.prompts import PromptTemplate, ChatPromptTemplate, MessagesPlaceholder
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.output_parsers import StrOutputParser
from langchain.chains import create_retrieval_chain
from langchain_core.runnables import RunnablePassthrough
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import DynamoDBChatMessageHistory
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, Tuple

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_bedrock_llm(
    bedrock_llm_id: str,
    temperature: Optional[float] = 0.7,
    max_tokens: Optional[int] = 150,
    top_p : Optional[float] = None
) -> ChatBedrockConverse:
    """
    Retrieve a Bedrock LLM instance configured with the given model ID and temperature.

    Args:
        bedrock_llm_id (str): The unique identifier for the Bedrock LLM model.
        temperature (float, optional): A parameter that controls the randomness 
            of generated responses (default is 0).
        max_tokens (int, optional): Sets an upper bound on how many tokens the model will generate in its response (default is None).
        top_p (float, optional): Indicates the percentage of most-likely candidates that are considered for the next token (default is None).

    Returns:
        ChatBedrockConverse: An instance of the Bedrock LLM corresponding to the provided model ID.
    """
    logger.info(
        "Initializing ChatBedrockConverse with model_id '%s', temperature '%s', max_tokens '%s', top_p '%s'.",
        bedrock_llm_id, 
        temperature,
        max_tokens, 
        top_p
    )
    
    return ChatBedrockConverse(
        model=bedrock_llm_id,
        temperature=temperature,
        # Additional kwargs: https://api.python.langchain.com/en/latest/aws/chat_models/langchain_aws.chat_models.bedrock_converse.ChatBedrockConverse.html
        max_tokens=max_tokens,
        top_p=top_p
    )


def get_response(
    case_type: str, 
    llm: ChatBedrockConverse,
    jurisdiction: Optional[str] = None, 
    case_description: Optional[str] = None,
    province: Optional[str] = None
) -> str:
    """
    Generate a case title using an LLM based on input parameters.

    Args:
        case_type (str): The type of legal case
        llm (ChatBedrockConverse): The language model to generate the title
        jurisdiction (str, optional): The legal jurisdiction of the case
        case_description (str, optional): A brief description of the case

    Returns:
        str: A generated case title
    """
    logger.info(f"Generating case title for case type: {case_type}")
    
    # Construct a prompt to guide the LLM in creating a concise, professional case title
    prompt = (
        "You are a legal document title generator. Create a professional, concise case title. "
        "Follow these guidelines:\n"
        "- Use a clear, formal format\n"
        "- Include the case type\n"
        "- If jurisdiction is provided, incorporate it\n"
        "- If a description is given, distill its essence\n"
        "- Keep the title under 100 characters\n"
        "- Avoid unnecessary words\n\n"
        "- Avoid the name of the person or any personal information or any country or region names\n"
        "- Do not mention any country or region name in the title, do not format it as country vs person\n"
        "- Do not mention United States vs Defendant"
        "Do not mention anything like: Here is a professional and concise case title:, just return the title.\n"
        f"Case Type: {case_type}\n"
    )
    
    # Add jurisdiction to the prompt if provided
    if jurisdiction:
        prompt += f"Jurisdiction: {jurisdiction}\n"

    # Add case description to the prompt if provided
    if province:
        prompt += f"Province: {province}\n"
    
    # Add case description to the prompt if provided
    if case_description:
        prompt += f"Case Description: {case_description}\n"
    
    # Add instruction to generate the title
    prompt += "\nGenerate the case title:"
    
    # Use the LLM to generate the title
    logger.info("Invoking LLM to generate case title")
    response = llm.invoke(prompt).content
    
    # Trim the response to ensure it's not too long
    title = response.strip()[:100]
    
    logger.info(f"Generated case title: {title}")
    return title



