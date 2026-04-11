# guardrails.py - Input & Output safety checks

BLOCKED_INPUTS = [
    "how to make a bomb",
    "how to hack",
    "kill someone",
    "suicide method",
    "drug synthesis",
    "child abuse",
]

BLOCKED_OUTPUT_PATTERNS = [
    "I cannot help with that",
    "as an ai, i must warn",
    "illegal activity",
]

def check_input(user_message: str) -> dict:
    """
    Check if user input is safe.
    Returns: {"safe": True/False, "reason": "..."}
    """
    message_lower = user_message.lower()

    for pattern in BLOCKED_INPUTS:
        if pattern in message_lower:
            return {
                "safe": False,
                "reason": f"Blocked input detected: '{pattern}'"
            }

    # Check message length
    if len(user_message) > 1000:
        return {
            "safe": False,
            "reason": "Message too long (max 1000 characters)"
        }

    # Check for empty/gibberish (too short)
    if len(user_message.strip()) < 2:
        return {
            "safe": False,
            "reason": "Message too short"
        }

    return {"safe": True, "reason": "OK"}


def check_output(ai_response: str) -> dict:
    """
    Check if AI response is safe to return.
    Returns: {"safe": True/False, "reason": "..."}
    """
    response_lower = ai_response.lower()

    for pattern in BLOCKED_OUTPUT_PATTERNS:
        if pattern in response_lower:
            return {
                "safe": False,
                "reason": f"Unsafe output pattern detected: '{pattern}'"
            }

    return {"safe": True, "reason": "OK"}