import os
import MySQLdb
from dotenv import load_dotenv

load_dotenv('.env')

db_user = os.environ.get("DB_USER", "root")
db_password = os.environ.get("DB_PASSWORD", "root")
db_host = os.environ.get("DB_HOST", "localhost")
db_port = int(os.environ.get("DB_PORT", "3306"))

db = MySQLdb.connect(
    host=db_host,
    user=db_user,
    passwd=db_password,
    port=db_port
)
cursor = db.cursor()
cursor.execute("SHOW DATABASES")
databases = [row[0] for row in cursor.fetchall()]
print("Databases on server:", databases)

for db_name in databases:
    if db_name in ['information_schema', 'mysql', 'performance_schema', 'sys']:
        continue
    try:
        db.select_db(db_name)
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"Database: {db_name}, Tables: {tables}")
        matching_tables = [t for t in tables if 'systemconfig' in t.lower()]
        if matching_tables:
            cursor.execute(f"SELECT * FROM {matching_tables[0]}")
            rows = cursor.fetchall()
            print(f"  SystemConfig rows in {db_name}:")
            for r in rows:
                print("   ", r)
    except Exception as e:
        print(f"  Could not read {db_name}: {e}")

db.close()
