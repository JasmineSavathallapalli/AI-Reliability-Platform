# auth.py - Handles login, signup, JWT tokens

import bcrypt
import jwt
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
import psycopg2

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def generate_token(user_id: int, email: str, is_admin: bool) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "is_admin": is_admin,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return {"valid": True, "payload": payload}
    except jwt.ExpiredSignatureError:
        return {"valid": False, "error": "Token expired"}
    except jwt.InvalidTokenError:
        return {"valid": False, "error": "Invalid token"}


def register_user(email: str, password: str) -> dict:
    from database import get_connection
    conn = get_connection()
    cursor = conn.cursor()

    try:
        hashed = hash_password(password)
        cursor.execute(
            "INSERT INTO users (email, password) VALUES (%s, %s) RETURNING id, email, is_admin",
            (email.lower(), hashed)
        )
        user = cursor.fetchone()
        conn.commit()

        token = generate_token(user[0], user[1], user[2])
        return {"success": True, "token": token, "email": user[1]}

    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        return {"success": False, "error": "Email already exists"}
    finally:
        cursor.close()
        conn.close()



def login_user(email: str, password: str) -> dict:
    from database import get_connection
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, email, password, is_admin, is_blocked FROM users WHERE email = %s",
        (email.lower(),)
    )
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user:
        return {"success": False, "error": "Email not found"}

    if user[4]:
        return {"success": False, "error": "Your account has been blocked. Contact admin."}

    if not verify_password(password, user[2]):
        return {"success": False, "error": "Incorrect password"}

    token = generate_token(user[0], user[1], user[3])
    return {
        "success": True,
        "token": token,
        "email": user[1],
        "is_admin": user[3]
    }