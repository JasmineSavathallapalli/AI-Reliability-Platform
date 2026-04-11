import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()

def get_connection():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def create_tables():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE,
            theme TEXT DEFAULT 'dark',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            title TEXT DEFAULT 'New Chat',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS queries (
            id SERIAL PRIMARY KEY,
            conversation_id INTEGER REFERENCES conversations(id),
            user_id INTEGER REFERENCES users(id),
            user_message TEXT NOT NULL,
            ai_response TEXT,
            blocked BOOLEAN DEFAULT FALSE,
            block_reason TEXT,
            relevance_score FLOAT,
            length_score FLOAT,
            quality_score FLOAT,
            overall_score FLOAT,
            grade TEXT,
            word_count INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    cursor.close()
    conn.close()
    print("Tables created!")


def create_conversation(user_id, title="New Chat"):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO conversations (user_id, title) VALUES (%s, %s) RETURNING id",
        (user_id, title)
    )
    conv_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return conv_id


def get_conversations(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.id, c.title, c.created_at,
               COUNT(q.id) as message_count
        FROM conversations c
        LEFT JOIN queries q ON q.conversation_id = c.id
        WHERE c.user_id = %s
        GROUP BY c.id, c.title, c.created_at
        ORDER BY c.created_at DESC
        LIMIT 30
    """, (user_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [
        {
            "id": row[0],
            "title": row[1],
            "created_at": str(row[2]),
            "message_count": row[3]
        }
        for row in rows
    ]


def get_conversation_messages(conversation_id, user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, user_message, ai_response, blocked,
               overall_score, grade, created_at
        FROM queries
        WHERE conversation_id = %s AND user_id = %s
        ORDER BY created_at ASC
    """, (conversation_id, user_id))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [
        {
            "id": row[0],
            "user_message": row[1],
            "ai_response": row[2],
            "blocked": row[3],
            "overall_score": row[4],
            "grade": row[5],
            "created_at": str(row[6])
        }
        for row in rows
    ]


def save_query(user_id, user_message, ai_response, blocked,
               block_reason, evaluation, conversation_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO queries (
            conversation_id, user_id, user_message, ai_response,
            blocked, block_reason, relevance_score, length_score,
            quality_score, overall_score, grade, word_count
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        conversation_id, user_id, user_message, ai_response,
        blocked, block_reason,
        evaluation.get("relevance"), evaluation.get("length"),
        evaluation.get("quality"), evaluation.get("overall"),
        evaluation.get("grade"), evaluation.get("word_count")
    ))
    conn.commit()
    cursor.close()
    conn.close()


def clear_user_history(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM queries WHERE user_id = %s", (user_id,))
    cursor.execute("DELETE FROM conversations WHERE user_id = %s", (user_id,))
    conn.commit()
    cursor.close()
    conn.close()


def get_query_count_today(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*) FROM queries
        WHERE user_id = %s
        AND DATE(created_at) = CURRENT_DATE
        AND blocked = FALSE
    """, (user_id,))
    count = cursor.fetchone()[0]
    cursor.close()
    conn.close()
    return count


def get_all_users():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.email, u.is_admin, u.created_at,
           COUNT(q.id) as total_queries, u.is_blocked
        FROM users u
        LEFT JOIN queries q ON q.user_id = u.id
        GROUP BY u.id, u.email, u.is_admin, u.created_at, u.is_blocked
        ORDER BY u.created_at DESC
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [
    {
        "id": row[0],
        "email": row[1],
        "is_admin": row[2],
        "created_at": str(row[3]),
        "total_queries": row[4],
        "is_blocked": row[5]
    }
    for row in rows
]


def get_all_queries_admin():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT q.id, u.email, q.user_message, q.blocked,
               q.overall_score, q.grade, q.created_at
        FROM queries q
        JOIN users u ON q.user_id = u.id
        ORDER BY q.created_at DESC
        LIMIT 100
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [
        {
            "id": row[0],
            "email": row[1],
            "user_message": row[2],
            "blocked": row[3],
            "overall_score": row[4],
            "grade": row[5],
            "created_at": str(row[6])
        }
        for row in rows
    ]


def get_admin_stats():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    total_users = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM queries")
    total_queries = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM queries WHERE blocked = TRUE")
    blocked_queries = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM users WHERE is_blocked = TRUE")
    blocked_users = cursor.fetchone()[0]
    cursor.execute("SELECT AVG(overall_score) FROM queries WHERE blocked = FALSE")
    avg_score = cursor.fetchone()[0]
    cursor.close()
    conn.close()
    return {
        "total_users": total_users,
        "total_queries": total_queries,
        "blocked_queries": blocked_queries,
        "blocked_users": blocked_users,
        "avg_score": round(avg_score, 2) if avg_score else 0
    }
def delete_conversation(conv_id, user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM queries WHERE conversation_id = %s AND user_id = %s",
        (conv_id, user_id)
    )
    cursor.execute(
        "DELETE FROM conversations WHERE id = %s AND user_id = %s",
        (conv_id, user_id)
    )
    conn.commit()
    cursor.close()
    conn.close()


def toggle_block_user(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT is_blocked FROM users WHERE id = %s",
        (user_id,)
    )
    row = cursor.fetchone()
    if not row:
        cursor.close()
        conn.close()
        return {"error": "User not found"}
    new_status = not row[0]
    cursor.execute(
        "UPDATE users SET is_blocked = %s WHERE id = %s",
        (new_status, user_id)
    )
    conn.commit()
    cursor.close()
    conn.close()
    return {"blocked": new_status, "user_id": user_id}

def save_reset_token(email, token, expiry):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET reset_token = %s, reset_token_expiry = %s WHERE email = %s",
        (token, expiry, email.lower())
    )
    conn.commit()
    cursor.close()
    conn.close()


def get_user_by_reset_token(token):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, email, reset_token_expiry FROM users WHERE reset_token = %s",
        (token,)
    )
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        return None
    return {"id": row[0], "email": row[1], "expiry": row[2]}


def reset_password(token, new_password):
    from auth import hash_password
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE users SET password = %s, reset_token = NULL, reset_token_expiry = NULL
        WHERE reset_token = %s
    """, (hash_password(new_password), token))
    conn.commit()
    cursor.close()
    conn.close()