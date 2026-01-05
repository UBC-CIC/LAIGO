import json
import os
import boto3


def lambda_handler(event, context):

    

    try:
        # Extract arguments from the AppSync payload
        arguments = event.get("arguments", {})
        audio_file_id = arguments.get("audioFileId", "DefaultAudioFileId")
        message = arguments.get("message", "Default message")

        # Log the extracted values for debugging
        

        # Return the values back to AppSync
        return {
            "audioFileId": audio_file_id,
            "message": message
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "error": str(e)
        }

    