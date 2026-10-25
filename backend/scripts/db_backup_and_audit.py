"""
Comprehensive Database Backup, Verification, and Pre-Cleanup Audit Script for KOSHA.
Creates timestamped backup, checks SQLite integrity, records baseline row counts and financial totals.
"""

import os
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from decimal import Decimal

if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

DB_PATH = "kosha.db"
BACKUP_DIR = "backups"

def run_backup_and_audit():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Database {DB_PATH} not found.")

    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_filename = f"kosha_backup_{timestamp}.db"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)

    # 1. Online SQLite Backup
    src_conn = sqlite3.connect(DB_PATH)
    dst_conn = sqlite3.connect(backup_path)
    with dst_conn:
        src_conn.backup(dst_conn, pages=100)
    dst_conn.close()

    # 2. Integrity Check on Backup
    verify_conn = sqlite3.connect(backup_path)
    verify_cur = verify_conn.cursor()
    verify_cur.execute("PRAGMA integrity_check;")
    integrity_result = verify_cur.fetchone()[0]
    verify_conn.close()

    backup_size = os.path.getsize(backup_path)
    print(f"==================================================")
    print(f"DATABASE BACKUP VERIFIED SUCCESSFULLY")
    print(f"==================================================")
    print(f"Backup File      : {backup_path}")
    print(f"Backup Size      : {backup_size:,} bytes")
    print(f"Integrity Status : {integrity_result}")
    assert integrity_result == "ok", f"Backup integrity check failed: {integrity_result}"

    # 3. Baseline Table Counts
    cur = src_conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
    tables = [r[0] for r in cur.fetchall()]

    print(f"\n==================================================")
    print(f"BASELINE TABLE ROW COUNTS (BEFORE CLEANUP)")
    print(f"==================================================")
    table_counts = {}
    for table in tables:
        cur.execute(f'SELECT COUNT(*) FROM "{table}";')
        cnt = cur.fetchone()[0]
        table_counts[table] = cnt
        print(f"  {table:<32}: {cnt:>6} rows")

    # 4. Baseline Financial Totals
    print(f"\n==================================================")
    print(f"BASELINE FINANCIAL TOTALS (BEFORE CLEANUP)")
    print(f"==================================================")

    # Credit Transactions
    cur.execute("""
        SELECT 
            COUNT(*),
            COALESCE(SUM(purchase_amount), 0),
            COALESCE(SUM(initial_paid_amount), 0),
            COALESCE(SUM(outstanding_amount), 0)
        FROM customer_credit_transactions;
    """)
    credit_count, total_purchase, total_initial, total_outstanding = cur.fetchone()
    print(f"Customer Credit Transactions : {credit_count} bills")
    print(f"  - Total Purchase Amount    : ₹{total_purchase:,.2f}")
    print(f"  - Total Initial Paid       : ₹{total_initial:,.2f}")
    print(f"  - Total Outstanding Dues   : ₹{total_outstanding:,.2f}")

    # Repayments
    cur.execute("""
        SELECT COUNT(*), COALESCE(SUM(amount), 0)
        FROM customer_repayments
        WHERE payment_status = 'completed';
    """)
    repay_count, total_repayments = cur.fetchone()
    print(f"Customer Completed Repayments: {repay_count} payments, ₹{total_repayments:,.2f}")

    # Expected Invariant Check
    expected_outstanding = total_purchase - total_initial - total_repayments
    print(f"  - Net Derived Balance      : ₹{expected_outstanding:,.2f} (Delta from recorded: ₹{total_outstanding - expected_outstanding:,.2f})")

    # Invoices
    cur.execute("""
        SELECT COUNT(*), COALESCE(SUM(amount), 0), COALESCE(SUM(paid_amount), 0)
        FROM customer_invoices;
    """)
    inv_count, total_inv, total_inv_paid = cur.fetchone()
    print(f"\nCustomer Invoices (B2B AR)   : {inv_count} invoices")
    print(f"  - Total Invoice Amount     : ₹{total_inv:,.2f}")
    print(f"  - Total Paid Amount        : ₹{total_inv_paid:,.2f}")
    print(f"  - Outstanding Receivables  : ₹{total_inv - total_inv_paid:,.2f}")

    # Vendor Bills
    cur.execute("""
        SELECT COUNT(*), COALESCE(SUM(amount), 0), COALESCE(SUM(paid_amount), 0)
        FROM vendor_bills;
    """)
    bill_count, total_bill, total_bill_paid = cur.fetchone()
    print(f"\nVendor Bills (B2B AP)        : {bill_count} bills")
    print(f"  - Total Bill Amount        : ₹{total_bill:,.2f}")
    print(f"  - Total Paid Amount        : ₹{total_bill_paid:,.2f}")
    print(f"  - Outstanding Payables     : ₹{total_bill - total_bill_paid:,.2f}")

    # Bank Transactions
    cur.execute("""
        SELECT 
            COUNT(*),
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0),
            COALESCE(SUM(amount), 0)
        FROM bank_transactions;
    """)
    txn_count, total_credits, total_debits, net_bank = cur.fetchone()
    print(f"\nBank Transactions (Settled)  : {txn_count} transactions")
    print(f"  - Total Credits Inflow     : ₹{total_credits:,.2f}")
    print(f"  - Total Debits Outflow     : ₹{total_debits:,.2f}")
    print(f"  - Net Movement             : ₹{net_bank:,.2f}")

    src_conn.close()
    return backup_path, table_counts

if __name__ == "__main__":
    run_backup_and_audit()
