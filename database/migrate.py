"""
database/migrate.py
Voert het SQL schema uit en maakt de database klaar.
Gebruik: python database/migrate.py
"""
import os
import sys
import psycopg2
from dotenv import load_dotenv
 
load_dotenv()
 
def migrate():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL niet gevonden in .env")
        sys.exit(1)
 
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r") as f:
        schema_sql = f.read()
 
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cursor = conn.cursor()
        cursor.execute(schema_sql)
        print("✅ Database schema succesvol aangemaakt.")
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"❌ Fout bij migratie: {e}")
        sys.exit(1)
 
if __name__ == "__main__":
    migrate()
