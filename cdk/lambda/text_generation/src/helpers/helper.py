import logging
from typing import Optional

import psycopg
from langchain_aws import BedrockEmbeddings
from langchain_postgres import PGVector

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_vectorstore(
    collection_name: str, 
    embeddings: BedrockEmbeddings, 
    dbname: str, 
    user: str, 
    password: str, 
    host: str, 
    port: int
) -> Optional[PGVector]:
    """
    Initialize and return a PGVector instance.
    
    Args:
    collection_name (str): The name of the collection.
    embeddings (BedrockEmbeddings): The embeddings instance.
    dbname (str): The name of the database.
    user (str): The database user.
    password (str): The database password.
    host (str): The database host.
    port (int): The database port.
    
    Returns:
    Optional[PGVector]: The initialized PGVector instance, or None if an error occurred.
    """
    try:
        connection_string = (
            f"postgresql+psycopg://{user}:{password}@{host}:{port}/{dbname}?sslmode=require"
        )

        logger.info("Initializing the VectorStore with SSL/TLS")
        vectorstore = PGVector(
            embeddings=embeddings,
            collection_name=collection_name,
            connection=connection_string,
            use_jsonb=True
        )

        logger.info("VectorStore initialized successfully with SSL/TLS")
        return vectorstore, connection_string

    except Exception as e:
        logger.error(f"Error initializing vector store with SSL/TLS: {e}")
        logger.error(f"Connection string (credentials redacted): postgresql+psycopg://***@{host}:{port}/{dbname}?sslmode=require")
        if 'SSL' in str(e) or 'certificate' in str(e).lower():
            logger.error("SSL certificate validation failed. Verify RDS Proxy TLS configuration.")
        return None