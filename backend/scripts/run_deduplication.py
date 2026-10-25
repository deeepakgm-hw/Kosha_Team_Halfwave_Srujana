"""
CLI Runner for KOSHA Database Cleanup and Deduplication.
Usage:
  python backend/scripts/run_deduplication.py --dry-run
  python backend/scripts/run_deduplication.py --apply
"""

import argparse
import json
import os
import sys

# Ensure root in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from backend.app.db.database import SessionLocal
from backend.app.services.deduplication_service import deduplication_service


def main():
    parser = argparse.ArgumentParser(description="KOSHA Database Cleanup & Deduplication")
    parser.add_argument("--apply", action="store_true", help="Apply cleanup permanently inside an atomic transaction")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Simulate cleanup without writing changes")
    args = parser.parse_args()

    dry_run = not args.apply

    mode_label = "DRY-RUN SIMULATION (NO CHANGES COMMITTED)" if dry_run else "LIVE EXECUTION (APPLYING PERMANENT CLEANUP)"
    print("=" * 65)
    print(f"KOSHA DATABASE DEDUPLICATION & RECONCILIATION")
    print(f"MODE: {mode_label}")
    print("=" * 65)

    db = SessionLocal()
    try:
        report = deduplication_service.execute_cleanup(db, dry_run=dry_run)
        report_data = report.to_dict()

        os.makedirs("docs", exist_ok=True)
        report_file = "docs/DATA_CLEANUP_DRY_RUN_REPORT.json" if dry_run else "docs/DATA_CLEANUP_APPLIED_REPORT.json"
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2)

        print(f"\n[+] Businesses Merged / Deduplicated : {report_data['businesses_merged_count']}")
        for b in report_data["businesses_merged"]:
            print(f"    - Merged '{b['duplicate_id']}' -> '{b['canonical_id']}' ({b['legal_name']})")

        print(f"\n[+] Credit Bills Deduplicated       : {report_data['bills_deduped_count']}")
        for bill in report_data["bills_deduped"]:
            print(f"    - Duplicate {bill['duplicate_reference']} -> Canonical {bill['canonical_reference']} (₹{bill['amount']:,.2f}: {bill['description']})")

        print(f"\n[+] Repayments Deduplicated          : {report_data['repayments_deduped_count']}")
        for rep in report_data["repayments_deduped"]:
            print(f"    - Repayment {rep['duplicate_id']} (₹{rep['amount']:,.2f}) on Txn {rep['transaction_id']}")

        print(f"\n[+] Balances & Statuses Reconciled   : {report_data['balances_reconciled_count']}")
        for bal in report_data["balances_reconciled"]:
            status_change = f"[{bal['old_status']} -> {bal['new_status']}]" if bal['old_status'] != bal['new_status'] else f"[{bal['new_status']}]"
            print(f"    - Bill {bal['reference']}: Recorded ₹{bal['old_outstanding']:,.2f} -> Derived ₹{bal['new_outstanding']:,.2f} {status_change}")

        print(f"\n[+] Obsolete Payment Requests Cleaned: {report_data['payment_requests_cleaned_count']}")

        print(f"\n[+] Flagged for Review (Distinct)    : {report_data['flagged_for_review_count']}")
        for flag in report_data["flagged_for_review"]:
            print(f"    - {flag.get('reference', flag.get('bill_id'))}: {flag['reason']}")

        print("\n" + "=" * 65)
        print("TABLE COUNTS SUMMARY:")
        print("=" * 65)
        for tbl, cnt_before in sorted(report_data["before_counts"].items()):
            cnt_after = report_data["after_counts"].get(tbl, cnt_before)
            delta = cnt_after - cnt_before
            delta_str = f"({delta:+d})" if delta != 0 else "(no change)"
            print(f"  {tbl:<30}: Before={cnt_before:>4} | After={cnt_after:>4} {delta_str}")

        print("\n" + "=" * 65)
        print("FINANCIAL TOTALS SUMMARY:")
        print("=" * 65)
        for metric, tot_before in sorted(report_data["before_totals"].items()):
            tot_after = report_data["after_totals"].get(metric, tot_before)
            diff = tot_after - tot_before
            diff_str = f"(Δ ₹{diff:+,.2f})" if abs(diff) > 0.001 else "(exact match)"
            print(f"  {metric:<30}: Before=₹{tot_before:>12,.2f} | After=₹{tot_after:>12,.2f} {diff_str}")

        print(f"\nDetailed JSON report saved to: {report_file}")
        if dry_run:
            print("\n[!] To execute these changes permanently, run: python backend/scripts/run_deduplication.py --apply")

    finally:
        db.close()


if __name__ == "__main__":
    main()
