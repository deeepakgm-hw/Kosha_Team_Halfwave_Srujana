"""
Detailed inspection of duplicates and discrepancy in kosha.db.
"""
import sqlite3
import sys

if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

conn = sqlite3.connect("kosha.db")
conn.row_factory = sqlite3.Row
cur = conn.cursor()

print("=== 1. CUSTOMERS ===")
cur.execute("SELECT id, display_name, phone, email, created_at FROM customers;")
customers = cur.fetchall()
for c in customers:
    print(f"  [{c['id']}] Name: {c['display_name']} | Phone: '{c['phone']}' | Email: {c['email']}")

print("\n=== 2. BUSINESSES & SHOPS ===")
cur.execute("SELECT id, legal_name, trade_name, is_demo FROM businesses;")
for b in cur.fetchall():
    print(f"  Business [{b['id']}] Legal: '{b['legal_name']}' | Trade: '{b['trade_name']}' | Demo: {b['is_demo']}")

cur.execute("SELECT id, shop_name, shop_code, phone FROM shops;")
for s in cur.fetchall():
    print(f"  Shop [{s['id']}] Code: '{s['shop_code']}' | Name: '{s['shop_name']}' | Phone: '{s['phone']}'")

print("\n=== 3. CREDIT TRANSACTIONS & OUTSTANDING INVARIANTS ===")
cur.execute("""
    SELECT 
        t.id, t.reference, t.customer_id, t.shop_id, t.description,
        t.purchase_amount, t.initial_paid_amount, t.outstanding_amount,
        t.status, t.transaction_date, t.agreed_repayment_date
    FROM customer_credit_transactions t
    ORDER BY t.created_at;
""")
txns = cur.fetchall()
for t in txns:
    # calculate sum of completed repayments for this bill
    cur.execute("""
        SELECT COALESCE(SUM(amount), 0), COUNT(*) 
        FROM customer_repayments 
        WHERE transaction_id = ? AND payment_status = 'completed';
    """, (t['id'],))
    rep_sum, rep_cnt = cur.fetchone()
    derived_outstanding = max(0.0, float(t['purchase_amount']) - float(t['initial_paid_amount']) - float(rep_sum))
    recorded_outstanding = float(t['outstanding_amount'])
    diff = recorded_outstanding - derived_outstanding
    diff_str = f" [DISCREPANCY: diff={diff:+.2f}]" if abs(diff) > 0.001 else " [OK]"
    print(f"  Bill {t['reference']} ({t['id'][:8]}): Cust={t['customer_id']} | Total={t['purchase_amount']} | InitPaid={t['initial_paid_amount']} | Repayments({rep_cnt})={rep_sum:.2f} | RecOut={recorded_outstanding:.2f} | DerivedOut={derived_outstanding:.2f}{diff_str} | Status={t['status']}")

print("\n=== 4. CHECK DUPLICATE REPAYMENTS ===")
cur.execute("""
    SELECT transaction_id, amount, repayment_date, payment_method, COUNT(*) as cnt
    FROM customer_repayments
    GROUP BY transaction_id, amount, repayment_date, payment_method
    HAVING COUNT(*) > 1;
""")
dup_reps = cur.fetchall()
print(f"Identified duplicate repayment patterns: {len(dup_reps)}")
for d in dup_reps:
    print(f"  Txn: {d['transaction_id']} | Amount: ₹{d['amount']} | Date: {d['repayment_date']} | Count: {d['cnt']}")

print("\n=== 5. CHECK DUPLICATE BANK TRANSACTIONS ===")
cur.execute("""
    SELECT fingerprint, COUNT(*) as cnt
    FROM bank_transactions
    GROUP BY fingerprint
    HAVING COUNT(*) > 1;
""")
dup_bank = cur.fetchall()
print(f"Identified duplicate bank fingerprints: {len(dup_bank)}")
for d in dup_bank:
    print(f"  Fingerprint: {d['fingerprint']} | Count: {d['cnt']}")

cur.execute("""
    SELECT transaction_date, amount, description, COUNT(*) as cnt
    FROM bank_transactions
    GROUP BY transaction_date, amount, description
    HAVING COUNT(*) > 1;
""")
dup_bank_attrs = cur.fetchall()
print(f"Identified duplicate bank attrs (date+amount+desc): {len(dup_bank_attrs)}")
for d in dup_bank_attrs:
    print(f"  Date: {d['transaction_date']} | Amount: ₹{d['amount']} | Desc: {d['description']} | Count: {d['cnt']}")

print("\n=== 6. CHECK DUPLICATE BILLS ===")
cur.execute("""
    SELECT reference, COUNT(*) as cnt
    FROM customer_credit_transactions
    GROUP BY reference
    HAVING COUNT(*) > 1;
""")
dup_bills = cur.fetchall()
print(f"Identified duplicate bill references: {len(dup_bills)}")

print("\n=== 7. CHECK DUPLICATE PAYMENT ATTEMPTS & REQUESTS ===")
cur.execute("""
    SELECT bill_id, amount_paise, status, COUNT(*) as cnt
    FROM payment_requests
    GROUP BY bill_id, amount_paise, status
    HAVING COUNT(*) > 1;
""")
dup_reqs = cur.fetchall()
print(f"Identified duplicate payment requests: {len(dup_reqs)}")

conn.close()
