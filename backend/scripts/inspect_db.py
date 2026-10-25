import sqlite3
import os

db_path = 'kosha.db'
if not os.path.exists(db_path):
    print(f"Database {db_path} does not exist!")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [r[0] for r in cursor.fetchall() if not r[0].startswith('sqlite_')]
print(f"Database: {db_path} ({os.path.getsize(db_path):,} bytes)")
print(f"Tables found: {len(tables)}")
print("-" * 50)
total_rows = 0
for t in sorted(tables):
    cursor.execute(f'SELECT COUNT(*) FROM "{t}"')
    count = cursor.fetchone()[0]
    total_rows += count
    print(f"  {t:<32}: {count:>6} rows")
print("-" * 50)
print(f"Total Rows: {total_rows}")
conn.close()
