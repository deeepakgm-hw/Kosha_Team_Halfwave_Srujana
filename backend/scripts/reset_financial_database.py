import sqlite3
import sys

sys.stdout.reconfigure(encoding="utf-8")

db_path = "kosha.db"
con = sqlite3.connect(db_path)
cur = con.cursor()

tables_to_clear = [
    "payment_verifications",
    "payment_requests",
    "payment_attempts",
    "customer_activities",
    "customer_repayments",
    "customer_credit_transactions",
    "webhook_events",
    "notifications",
    "invoice_payments",
    "bill_payments",
    "customer_invoices",
    "vendor_bills",
    "operating_expenses",
    "bank_transactions",
    "import_batches",
]

print("=== RECORD COUNTS BEFORE RESET ===")
before_counts = {}
for t in tables_to_clear:
    c = cur.execute(f"SELECT COUNT(*) FROM [{t}]").fetchone()[0]
    before_counts[t] = c
    print(f"  {t}: {c} records")

try:
    cur.execute("BEGIN TRANSACTION;")
    # Foreign key checks off temporarily for clean ordered deletion
    cur.execute("PRAGMA foreign_keys = OFF;")
    for t in tables_to_clear:
        cur.execute(f"DELETE FROM [{t}];")
    
    # Remove any stray test businesses
    cur.execute("DELETE FROM businesses WHERE id NOT IN ('apex_precision_mfg', 'biz_ret_03', 'biz_srv_02');")
    cur.execute("DELETE FROM bank_accounts WHERE business_id NOT IN ('apex_precision_mfg', 'biz_ret_03', 'biz_srv_02');")
    
    con.commit()
    print("\n✓ Transaction committed successfully.")
except Exception as e:
    con.rollback()
    print(f"\n❌ Error during reset transaction: {e}. Rolled back.")
    sys.exit(1)
finally:
    cur.execute("PRAGMA foreign_keys = ON;")

# Run VACUUM to reclaim space
cur.execute("VACUUM;")
con.close()

# Verify counts after reset
con2 = sqlite3.connect(db_path)
cur2 = con2.cursor()
print("\n=== RECORD COUNTS AFTER RESET ===")
all_tables = [r[0] for r in cur2.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
for t in all_tables:
    c = cur2.execute(f"SELECT COUNT(*) FROM [{t}]").fetchone()[0]
    print(f"  {t}: {c} records")

con2.close()
print("\n✓ Complete financial database reset finished. All financial ledgers are now at genuine clean zero state.")
