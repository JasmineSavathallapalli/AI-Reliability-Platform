from pyexpat.errors import messages
from observability import trace_query, trace_blocked_query
from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
from dotenv import load_dotenv
from guardrails import check_input, check_output
from evaluator import evaluate_response
from database import (save_query, get_query_count_today,
                      get_all_queries_admin, get_admin_stats,
                      create_conversation, get_conversations,
                      get_conversation_messages, clear_user_history,
                      get_all_users)
from auth import register_user, login_user, verify_token
from flask_mail import Mail, Message 
from datetime import datetime, timedelta
from file_handler import get_file_context
from celery_app import celery
from tasks import process_query
import secrets
import os


load_dotenv()

app = Flask(__name__)
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.getenv('MAIL_EMAIL')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_EMAIL')

mail = Mail(app)
CORS(app)
app.config['CELERY_BROKER_URL'] = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

DAILY_LIMIT = 30

def get_current_user(request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    result = verify_token(token)
    if result["valid"]:
        return result["payload"]
    return None


# ─── AUTH ───────────────────────────────────────────────────

@app.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    result = register_user(email, password)
    if result["success"]:
        return jsonify(result), 201
    return jsonify({"error": result["error"]}), 400


@app.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    result = login_user(email, password)
    if result["success"]:
        return jsonify(result), 200
    return jsonify({"error": result["error"]}), 401


# ─── CONVERSATIONS ──────────────────────────────────────────

@app.route("/conversations", methods=["GET"])
def conversations():
    user = get_current_user(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    convs = get_conversations(user["user_id"])
    return jsonify({"conversations": convs})


@app.route("/conversations/new", methods=["POST"])
def new_conversation():
    user = get_current_user(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json()
    title = data.get("title", "New Chat")
    conv_id = create_conversation(user["user_id"], title)
    return jsonify({"conversation_id": conv_id})


@app.route("/conversations/<int:conv_id>/messages", methods=["GET"])
def conversation_messages(conv_id):
    user = get_current_user(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    messages = get_conversation_messages(conv_id, user["user_id"])
    return jsonify({"messages": messages})


# ─── QUERY ──────────────────────────────────────────────────

@app.route("/query", methods=["POST"])
def query():
    user = get_current_user(request)
    if not user:
        return jsonify({"error": "Unauthorized. Please login."}), 401

    query_count = get_query_count_today(user["user_id"])
    if query_count >= DAILY_LIMIT:
        return jsonify({
            "error": f"Daily limit of {DAILY_LIMIT} queries reached."
        }), 429

    data = request.get_json()
    user_message = data.get("message", "")
    conversation_id = data.get("conversation_id")
    file_context = data.get("file_context")

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    if not conversation_id:
        conversation_id = create_conversation(
            user["user_id"],
            user_message[:40] + "..." if len(user_message) > 40 else user_message
        )

    input_check = check_input(user_message)
    if not input_check["safe"]:
        save_query(user["user_id"], user_message, None, True,
                   input_check["reason"], {}, conversation_id)
        trace_blocked_query(user["user_id"], user_message,
                           input_check["reason"], "input")
        return jsonify({
            "blocked": True,
            "stage": "input",
            "reason": input_check["reason"],
            "conversation_id": conversation_id
        }), 400

    history = get_conversation_messages(conversation_id, user["user_id"])
    messages = [{"role": "system", "content": "You are a helpful assistant."}]
    for msg in history:
        messages.append({"role": "user", "content": msg["user_message"]})
        if msg["ai_response"]:
            messages.append({"role": "assistant", "content": msg["ai_response"]})

    final_message = user_message
    if file_context:
        final_message = f"{file_context['content']}\n\nUser question: {user_message}"
    messages.append({"role": "user", "content": final_message})

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages
    )
    reply = response.choices[0].message.content

    output_check = check_output(reply)
    if not output_check["safe"]:
        save_query(user["user_id"], user_message, reply, True,
                   output_check["reason"], {}, conversation_id)
        trace_blocked_query(user["user_id"], user_message,
                           output_check["reason"], "output")
        return jsonify({
            "blocked": True,
            "stage": "output",
            "reason": output_check["reason"],
            "conversation_id": conversation_id
        }), 400

    evaluation = evaluate_response(user_message, reply)
   

    save_query(user["user_id"], user_message, reply, False,
           None, evaluation, conversation_id)
    trace_query(user["user_id"], user_message, reply, evaluation, False)

    return jsonify({
        "blocked": False,
        "user_message": user_message,
        "ai_response": reply,
        "evaluation": evaluation,
        "conversation_id": conversation_id,
        "queries_used": query_count + 1,
        "queries_remaining": DAILY_LIMIT - query_count - 1
    })

# ─── HISTORY ────────────────────────────────────────────────

@app.route("/history/clear", methods=["DELETE"])
def clear_history():
    user = get_current_user(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    clear_user_history(user["user_id"])
    return jsonify({"message": "History cleared!"})


# ─── ADMIN ──────────────────────────────────────────────────

@app.route("/admin/stats", methods=["GET"])
def admin_stats():
    user = get_current_user(request)
    if not user or not user.get("is_admin"):
        return jsonify({"error": "Admin access required"}), 403
    return jsonify(get_admin_stats())


@app.route("/admin/queries", methods=["GET"])
def admin_queries():
    user = get_current_user(request)
    if not user or not user.get("is_admin"):
        return jsonify({"error": "Admin access required"}), 403
    return jsonify({"queries": get_all_queries_admin()})


@app.route("/admin/users", methods=["GET"])
def admin_users():
    user = get_current_user(request)
    if not user or not user.get("is_admin"):
        return jsonify({"error": "Admin access required"}), 403
    return jsonify({"users": get_all_users()})

@app.route("/conversations/<int:conv_id>", methods=["DELETE"])
def delete_conversation(conv_id):
    user = get_current_user(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    from database import delete_conversation as db_delete_conv
    db_delete_conv(conv_id, user["user_id"])
    return jsonify({"message": "Conversation deleted!"})


@app.route("/admin/users/<int:user_id>/block", methods=["POST"])
def block_user(user_id):
    user = get_current_user(request)
    if not user or not user.get("is_admin"):
        return jsonify({"error": "Admin access required"}), 403
    from database import toggle_block_user
    result = toggle_block_user(user_id)
    return jsonify(result)
# ────────────────────────────────────────────────────────────
@app.route("/auth/forgot-password", methods=["POST"])
def forgot_password():
    from database import save_reset_token, get_connection
    data = request.get_json()
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Email required"}), 400

    # Check if user exists
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user:
        # Don't reveal if email exists
        return jsonify({"message": "If this email exists, a reset link has been sent."}), 200

    # Generate token
    token = secrets.token_urlsafe(32)
    expiry = datetime.utcnow() + timedelta(hours=1)
    save_reset_token(email, token, expiry)

    # Send email
    reset_link = f"http://localhost:3000/reset-password?token={token}"
    try:
        msg = Message(
            subject="Reset Your Password - AI Reliability Platform",
            recipients=[email],
            html=f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #3b82f6;">🛡️ AI Reliability Platform</h2>
                <p>You requested a password reset. Click the button below:</p>
                <a href="{reset_link}"
                   style="display: inline-block; background: #3b82f6; color: white;
                          padding: 12px 24px; border-radius: 8px; text-decoration: none;
                          font-weight: bold; margin: 16px 0;">
                    Reset Password
                </a>
                <p style="color: #666;">This link expires in 1 hour.</p>
                <p style="color: #666;">If you didn't request this, ignore this email.</p>
            </div>
            """
        )
        mail.send(msg)
    except Exception as e:
        print(f"Email error: {e}")
        return jsonify({"error": "Failed to send email. Check mail config."}), 500

    return jsonify({"message": "Reset link sent! Check your email."}), 200


@app.route("/auth/reset-password", methods=["POST"])
def do_reset_password():
    from database import get_user_by_reset_token, reset_password
    data = request.get_json()
    token = data.get("token", "")
    new_password = data.get("password", "")

    if not token or not new_password:
        return jsonify({"error": "Token and password required"}), 400

    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    user = get_user_by_reset_token(token)
    if not user:
        return jsonify({"error": "Invalid or expired reset link"}), 400

    if datetime.utcnow() > user["expiry"]:
        return jsonify({"error": "Reset link has expired"}), 400

    reset_password(token, new_password)
    return jsonify({"message": "Password reset successfully!"}), 200

@app.route("/upload", methods=["POST"])
def upload():
    user = get_current_user(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    filename = file.filename
    mime_type = file.content_type
    file_bytes = file.read()

    # Check file size (max 10MB)
    if len(file_bytes) > 10 * 1024 * 1024:
        return jsonify({"error": "File too large. Max 10MB."}), 400

    file_context = get_file_context(file_bytes, filename, mime_type)

    return jsonify({
        "success": True,
        "file_context": file_context
    })
    
@app.route("/")
def home():
    return jsonify({"message": "AI Reliability Platform is running!"})


if __name__ == "__main__":
    app.run(debug=True, port=5000, host="0.0.0.0")