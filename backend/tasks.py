# tasks.py - Celery async tasks

from celery_app import celery
from groq import Groq
from dotenv import load_dotenv
from guardrails import check_input, check_output
from evaluator import evaluate_response
from database import (save_query, get_query_count_today,
                      create_conversation, get_conversation_messages)
from observability import trace_query, trace_blocked_query
import os

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
DAILY_LIMIT = 30


@celery.task(bind=True)
def process_query(self, user_id, user_message, conversation_id, file_context=None):
    """
    Async task to process LLM query.
    Returns result dict with ai_response, evaluation etc.
    """
    try:
        # Update task state
        self.update_state(state="PROCESSING", meta={"status": "Checking guardrails..."})

        # ---- INPUT GUARDRAIL ----
        input_check = check_input(user_message)
        if not input_check["safe"]:
            save_query(user_id, user_message, None, True,
                      input_check["reason"], {}, conversation_id)
            trace_blocked_query(user_id, user_message,
                              input_check["reason"], "input")
            return {
                "blocked": True,
                "stage": "input",
                "reason": input_check["reason"],
                "conversation_id": conversation_id
            }

        # ---- BUILD MESSAGES ----
        self.update_state(state="PROCESSING", meta={"status": "Calling LLM..."})

        history = get_conversation_messages(conversation_id, user_id)
        messages = [{"role": "system", "content": "You are a helpful assistant."}]

        for msg in history:
            messages.append({"role": "user", "content": msg["user_message"]})
            if msg["ai_response"]:
                messages.append({"role": "assistant", "content": msg["ai_response"]})

        final_message = user_message
        if file_context:
            final_message = f"{file_context['content']}\n\nUser question: {user_message}"

        messages.append({"role": "user", "content": final_message})

        # ---- CALL LLM ----
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages
        )
        reply = response.choices[0].message.content

        # ---- OUTPUT GUARDRAIL ----
        self.update_state(state="PROCESSING", meta={"status": "Checking output..."})

        output_check = check_output(reply)
        if not output_check["safe"]:
            save_query(user_id, user_message, reply, True,
                      output_check["reason"], {}, conversation_id)
            trace_blocked_query(user_id, user_message,
                              output_check["reason"], "output")
            return {
                "blocked": True,
                "stage": "output",
                "reason": output_check["reason"],
                "conversation_id": conversation_id
            }

        # ---- EVALUATE ----
        self.update_state(state="PROCESSING", meta={"status": "Evaluating response..."})

        evaluation = evaluate_response(user_message, reply)
        save_query(user_id, user_message, reply, False,
                  None, evaluation, conversation_id)
        trace_query(user_id, user_message, reply, evaluation, False)

        return {
            "blocked": False,
            "user_message": user_message,
            "ai_response": reply,
            "evaluation": evaluation,
            "conversation_id": conversation_id
        }

    except Exception as e:
        self.update_state(state="FAILURE", meta={"status": str(e)})
        raise