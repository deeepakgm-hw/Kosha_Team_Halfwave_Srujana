import sqlite3
import json
import sys
from decimal import Decimal

sys.stdout.reconfigure(encoding="utf-8")

con = sqlite3.connect("kosha.db")
con.row_factory = sqlite3.Row
cur = con.cursor()

tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("=================== KOSHA DATABASE AUDIT ===================")
table_counts = {}
for t in tables:
    count = cur.execute(f"SELECT COUNT(1) FROM [{t}]").fetchone()[0]
    table_counts[t] = count
    print(f"{t}: {count} rows")

print("\n--- Summary of customer_credit_transactions ---")
txns = cur.execute("SELECT id, reference, customer_id, shop_id, description, purchase_amount, initial_paid_amount, outstanding_amount, status FROM customer_credit_transactions").fetchall()
tot_purchase = Decimal("0.00")
tot_initial = Decimal("0.00")
tot_outstanding = Decimal("0.00")

for t in txns:
    p = Decimal(str(t["purchase_amount"]))
    i = Decimal(str(t["initial_paid_amount"]))
    o = Decimal(str(t["outstanding_amount"]))
    tot_purchase += p
    tot_initial += i
    tot_outstanding += o
    print(f"[{t['id'][:8]}] {t['reference']} | Cust: {t['customer_id']} | Shop: {t['shop_id']} | Total: ₹{p} | InitPaid: ₹{i} | Due: ₹{o} | Status: {t['status']} | Desc: {t['description']}")

print(f"\nCalculated Sums from customer_credit_transactions:")
print(f"  Total Billed Volume: ₹{tot_purchase}")
print(f"  Total Counter Cash Paid: ₹{tot_initial}")
print(f"  Total Outstanding Dues: ₹{tot_outstanding}")

print("\n--- Summary of payment_verifications ---")
verifs = cur.execute("SELECT id, bill_id, razorpay_payment_id, amount_paise, status, verified_at FROM payment_verifications").fetchall()
tot_razorpay = Decimal("0.00")
for v in verifs:
    amt = Decimal(str(v["amount_paise"])) / Decimal("100")
    tot_razorpay += amt
    print(f"Verif [{v['id'][:8]}] Bill: {v['bill_id'][:8]} | PayID: {v['razorpay_payment_id']} | INR {amt} ({v['amount_paise']}p) | Status: {v['status']} | Time: {v['verified_at']}")

print(f"Total Razorpay Verified Collections: ₹{tot_razorpay}")

print("\n--- Summary of customer_repayments ---")
reps = cur.execute("SELECT id, transaction_id, amount, payment_method, payment_status, recorded_by, provider_reference FROM customer_repayments").fetchall()
for r in reps:
    print(f"Repayment [{r['id'][:8]}] Txn: {r['transaction_id'][:8]} | ₹{r['amount']} | Method: {r['payment_method']} | Status: {r['payment_status']} | By: {r['recorded_by']} | Ref: {r['provider_reference']}")

print("\n--- Summary of businesses & bank accounts ---")
bizs = cur.execute("SELECT id, legal_name, is_demo FROM businesses").fetchall()
for b in bizs:
    print(f"Business: {b['id']} | {b['legal_name']} | is_demo: {b['is_demo']}")

print("\n--- Summary of customer_invoices (B2B) ---")
invs = cur.execute("SELECT id, invoice_number, customer_name, amount, paid_amount, status FROM customer_invoices").fetchall()
tot_inv_amt = sum(Decimal(str(i["amount"])) for i in invs)
tot_inv_paid = sum(Decimal(str(i["paid_amount"])) for i in invs)
print(f"Invoices count: {len(invs)} | Total: ₹{tot_inv_amt} | Paid: ₹{tot_inv_paid}")
for i in invs:
    print(f"  Inv: {i['invoice_number']} | Cust: {i['customer_name']} | ₹{i['amount']} | Paid: ₹{i['paid_amount']} | Status: {i['status']}")

print("\n--- Summary of bank_transactions ---")
bank_txns = cur.execute("SELECT id, account_id, transaction_date, description, amount, transaction_type, is_reconciled FROM bank_transactions").fetchall()
print(f"Bank Transactions count: {len(bank_txns)}")
for bt in bank_txns[:10]:
    print(f"  BankTxn: {bt['transaction_date']} | ₹{bt['amount']} ({bt['transaction_type']}) | Reconciled: {bt['is_reconciled']} | {bt['description']}")
