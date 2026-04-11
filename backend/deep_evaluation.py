# deep_evaluation.py - Professional evaluation using DeepEval

from deepeval.metrics import (
    AnswerRelevancyMetric,
    FaithfulnessMetric,
    ContextualRelevancyMetric
)
from deepeval.test_case import LLMTestCase
import os
from dotenv import load_dotenv

load_dotenv()


def deep_evaluate(user_message: str, ai_response: str, context: str = None) -> dict:
    """
    Run DeepEval metrics on a query-response pair.
    Returns professional evaluation scores.
    """
    try:
        # Create test case
        test_case = LLMTestCase(
            input=user_message,
            actual_output=ai_response,
            retrieval_context=[context] if context else [ai_response]
        )

        results = {}

        # ---- Answer Relevancy ----
        relevancy_metric = AnswerRelevancyMetric(
            threshold=0.5,
            model="gpt-4o-mini",
            include_reason=True
        )
        relevancy_metric.measure(test_case)
        results["answer_relevancy"] = {
            "score": round(relevancy_metric.score, 2),
            "passed": relevancy_metric.success,
            "reason": relevancy_metric.reason
        }

        return {
            "deep_eval": results,
            "overall_passed": all(v.get("passed", False) for v in results.values())
        }

    except Exception as e:
        print(f"DeepEval error: {e}")
        return {
            "deep_eval": {},
            "overall_passed": None,
            "error": str(e)
        }


def simple_deep_evaluate(user_message: str, ai_response: str) -> dict:
    """
    Simple evaluation without external API calls.
    Uses rule-based checks inspired by DeepEval methodology.
    """
    results = {}

    # Answer Relevancy — keyword overlap
    question_words = set(user_message.lower().split()) - {
        "the", "a", "an", "is", "it", "in", "on", "at", "to",
        "for", "of", "and", "or", "what", "how", "why", "when"
    }
    response_words = set(ai_response.lower().split())
    overlap = question_words.intersection(response_words)
    relevancy_score = round(min(len(overlap) / max(len(question_words), 1), 1.0), 2)

    results["answer_relevancy"] = {
        "score": relevancy_score,
        "passed": relevancy_score >= 0.5,
        "reason": f"{len(overlap)}/{len(question_words)} question keywords found in response"
    }

    # Faithfulness — checks if response is coherent
    sentences = ai_response.split(".")
    coherent_sentences = [s for s in sentences if len(s.strip()) > 10]
    faithfulness_score = round(min(len(coherent_sentences) / max(len(sentences), 1), 1.0), 2)

    results["faithfulness"] = {
        "score": faithfulness_score,
        "passed": faithfulness_score >= 0.5,
        "reason": f"{len(coherent_sentences)} coherent sentences out of {len(sentences)}"
    }

    # Completeness — response length check
    word_count = len(ai_response.split())
    if word_count >= 50:
        completeness_score = 1.0
        reason = f"Response has {word_count} words — comprehensive"
    elif word_count >= 20:
        completeness_score = 0.7
        reason = f"Response has {word_count} words — adequate"
    else:
        completeness_score = 0.3
        reason = f"Response has {word_count} words — too brief"

    results["completeness"] = {
        "score": completeness_score,
        "passed": completeness_score >= 0.5,
        "reason": reason
    }

    # Toxicity check — basic harmful content detection
    harmful_words = ["hate", "kill", "harm", "abuse", "illegal", "violence"]
    toxicity_found = any(word in ai_response.lower() for word in harmful_words)
    results["non_toxicity"] = {
        "score": 0.0 if toxicity_found else 1.0,
        "passed": not toxicity_found,
        "reason": "Harmful content detected" if toxicity_found else "No harmful content found"
    }

    overall_score = round(
        sum(v["score"] for v in results.values()) / len(results), 2
    )
    overall_passed = all(v["passed"] for v in results.values())

    return {
        "deep_eval": results,
        "overall_score": overall_score,
        "overall_passed": overall_passed
    }