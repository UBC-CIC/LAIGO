
import logging
from datetime import datetime, timezone

logger = logging.getLogger()

def check_and_increment_usage(connection, user_id):
    """
    Checks and increments the daily message usage for a user.
    Returns the current usage count for today.
    """
    if connection is None:
        logger.error("Database connection is None")
        raise ValueError("Database connection failed")

    try:
        cur = connection.cursor()
        
        # Check current usage
        cur.execute("""
            SELECT activity_counter, last_activity
            FROM "users"
            WHERE user_id = %s
        """, (user_id,))
        
        result = cur.fetchone()
        
        if not result:
            logger.error(f"User not found: {user_id}")
            raise ValueError(f"User not found: {user_id}")
            
        activity_counter = result[0] or 0
        last_activity = result[1]
        
        current_time = datetime.now(timezone.utc)
        
        # If last_activity is None or from a different day, reset counter
        # We compare dates in UTC
        if last_activity is None or last_activity.date() != current_time.date():
            logger.info(f"Resetting usage for user {user_id}. Last activity: {last_activity}, Today: {current_time.date()}")
            new_count = 1
        else:
            new_count = activity_counter + 1
            
        # Update user record
        cur.execute("""
            UPDATE "users"
            SET activity_counter = %s,
                last_activity = %s
            WHERE user_id = %s
        """, (new_count, current_time, user_id))
        
        connection.commit()
        cur.close()
        
        logger.info(f"Updated usage for user {user_id}: {new_count}")
        return new_count
        
    except Exception as e:
        logger.error(f"Error checking/incrementing usage: {e}")
        if connection:
            connection.rollback()
        raise
