# evaluator.py - Scores every AI response automatically

def evaluate_response(user_message: str, ai_response: str) -> dict:
    """
    Evaluates the AI response and returns quality scores.
    Returns: {"relevance": 0-1, "length": 0-1, "quality": 0-1, "overall": 0-1}
    """

    scores = {}

    # ---- 1. RELEVANCE SCORE ----
    # Check how many words from the question appear in the answer
    question_words = set(user_message.lower().split())
    response_words = set(ai_response.lower().split())

    # Remove common words that don't matter
    stopwords = {"the", "a", "an", "is", "it", "in", "on", "at", "to", "for",
                 "of", "and", "or", "but", "what", "how", "why", "when", "who"}
    question_words = question_words - stopwords

    if len(question_words) == 0:
        scores["relevance"] = 0.5
    else:
        overlap = question_words.intersection(response_words)
        scores["relevance"] = round(min(len(overlap) / len(question_words), 1.0), 2)

    # ---- 2. LENGTH SCORE ----
    # Ideal response: 50-500 words
    word_count = len(ai_response.split())

    if word_count < 10:
        scores["length"] = 0.2       # Too short
    elif word_count < 50:
        scores["length"] = 0.6       # A bit short
    elif word_count <= 500:
        scores["length"] = 1.0       # Perfect length
    elif word_count <= 800:
        scores["length"] = 0.7       # A bit long
    else:
        scores["length"] = 0.4       # Too long

    # ---- 3. QUALITY SCORE ----
    # Check for quality signals in the response
    quality = 0.5  # base score

    # Positive signals
    if any(word in ai_response.lower() for word in ["example", "for instance", "such as"]):
        quality += 0.1   # Has examples
    if any(word in ai_response for word in ["1.", "2.", "•", "-", "**"]):
        quality += 0.1   # Has structure
    if len(ai_response) > 200:
        quality += 0.1   # Detailed enough
    if "?" not in ai_response:
        quality += 0.1   # Doesn't deflect with questions
    if ai_response[0].isupper():
        quality += 0.1   # Starts properly

    scores["quality"] = round(min(quality, 1.0), 2)

    # ---- OVERALL SCORE ----
    scores["overall"] = round(
        (scores["relevance"] * 0.4) +
        (scores["length"] * 0.3) +
        (scores["quality"] * 0.3),
        2
    )

    # ---- GRADE ----
    if scores["overall"] >= 0.8:
        scores["grade"] = "A"
    elif scores["overall"] >= 0.6:
        scores["grade"] = "B"
    elif scores["overall"] >= 0.4:
        scores["grade"] = "C"
    else:
        scores["grade"] = "F"

    scores["word_count"] = word_count

    return scores