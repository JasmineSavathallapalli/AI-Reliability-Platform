from database import get_connection

conn = get_connection()
cur = conn.cursor()
cur.execute("UPDATE users SET is_admin = TRUE WHERE email = 'admin@admin.com'")
conn.commit()
cur.close()
conn.close()
print("Admin created!")