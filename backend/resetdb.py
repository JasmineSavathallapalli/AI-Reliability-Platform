from database import get_connection

conn = get_connection()
cur = conn.cursor()

cur.execute("DROP TABLE IF EXISTS queries")
cur.execute("DROP TABLE IF EXISTS conversations")
cur.execute("DROP TABLE IF EXISTS users")
conn.commit()

print(" Tables dropped!")
cur.close()
conn.close()