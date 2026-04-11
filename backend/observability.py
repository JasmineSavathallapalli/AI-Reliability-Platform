# observability.py - Langfuse observability integration

from langfuse import Langfuse
from dotenv import load_dotenv
import os

load_dotenv()

langfuse = Langfuse(
    secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
    host=os.getenv("LANGFUSE_HOST")
)


def trace_query(user_id, user_message, ai_response, evaluation, blocked, model="llama-3.3-70b-versatile"):
    """Track every LLM query in Langfuse."""
    try:
        trace = langfuse.trace(
            name="llm-query",
            user_id=str(user_id),
            metadata={
                "blocked": blocked,
                "model": model,
                "evaluation": evaluation
            },
            tags=["production", "guardrail"]
        )

        # Track the LLM call
        trace.generation(
            name="groq-generation",
            model=model,
            input=user_message,
            output=ai_response if not blocked else "BLOCKED",
            metadata={
                "blocked": blocked,
                "grade": evaluation.get("grade") if evaluation else None,
                "overall_score": evaluation.get("overall") if evaluation else None
            }
        )

        # Track evaluation scores as a span
        if evaluation and not blocked:
            trace.span(
                name="evaluation",
                input=ai_response,
                output=str(evaluation),
                metadata=evaluation
            )

        langfuse.flush()
        return trace.id

    except Exception as e:
        print(f"Langfuse tracking error: {e}")
        return None


def trace_blocked_query(user_id, user_message, reason, stage):
    """Track blocked queries separately."""
    try:
        trace = langfuse.trace(
            name="blocked-query",
            user_id=str(user_id),
            metadata={
                "reason": reason,
                "stage": stage
            },
            tags=["blocked", "guardrail"]
        )

        trace.span(
            name="guardrail-block",
            input=user_message,
            output=f"BLOCKED at {stage}: {reason}"
        )

        langfuse.flush()
        return trace.id

    except Exception as e:
        print(f"Langfuse tracking error: {e}")
        return None