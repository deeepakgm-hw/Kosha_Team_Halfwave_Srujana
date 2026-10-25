import sqlite3
import os
import datetime
import sys

sys.stdout.reconfigure(encoding="utf-8")

os.makedirs("backups", exist_ok=True)
ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
backup_path = f"backups/kosha_backup_{ts}_pre_reset.db"

src = sqlite3.connect("kosha.db")
dst = sqlite3.connect(backup_path)
with dst:
    src.backup(dst)
dst.close()
src.close()

# Verify backup can be read
verify = sqlite3.connect(backup_path)
cur = verify.cursor()
tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
row_counts = {t: cur.execute(f"SELECT COUNT(*) FROM [{t}]").fetchone()[0] for t in tables}
verify.close()

print(f"Backup successfully created and verified: {backup_path}")
print(f"File size: {os.path.getsize(backup_path)} bytes")
print("Verified table counts in backup:")
for k, v in row_counts.items():
    print(f"  {k}: {v}")
