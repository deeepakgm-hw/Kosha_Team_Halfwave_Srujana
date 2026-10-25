import shutil
import sys
import os

backup_file = "backups/kosha_backup_20261025_094729_pre_reset.db"
if not os.path.exists(backup_file):
    print(f"Error: Backup file {backup_file} not found.")
    sys.exit(1)

shutil.copyfile(backup_file, "kosha.db")
print(f"Successfully restored kosha.db from {backup_file}")
