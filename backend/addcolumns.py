from database import get_connection

conn = get_connection()
cur = conn.cursor()

try:
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP")
    conn.commit()
    print(" Reset token columns added!")
except Exception as e:
    print(f"Error: {e}")
finally:
    cur.close()
    conn.close()