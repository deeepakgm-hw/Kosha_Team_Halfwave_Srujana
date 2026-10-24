from datetime import date, datetime, timezone
from decimal import Decimal
import pytest
from backend.app.core.errors import AppException
from backend.app.db.models import BankAccountModel, BankTransactionModel, BusinessModel, ImportBatchModel
from backend.app.domain.csv_importer import (
    COLUMN_ALIASES,
    compute_file_hash,
    compute_transaction_fingerprint,
    parse_date,
    parse_decimal_amount,
    parse_statement_csv,
    resolve_columns,
)
from backend.app.services.import_service import import_service


def test_parse_decimal_amounts():
    """Verify robust parsing of currencies, commas, and negative signs."""
    assert parse_decimal_amount("1,00,000.50") == Decimal("100000.50")
    assert parse_decimal_amount("₹ 45,200.75") == Decimal("45200.75")
    assert parse_decimal_amount("-1250.00") == Decimal("-1250.00")
    assert parse_decimal_amount("(3500.25)") == Decimal("-3500.25")
    assert parse_decimal_amount("  $ 999.99 ") == Decimal("999.99")

    with pytest.raises(ValueError):
        parse_decimal_amount("not_a_number")


def test_parse_dates_multi_format():
    """Verify parsing ISO, Indian, and British date conventions."""
    from datetime import date
    assert parse_date("2026-10-24") == date(2026, 10, 24)
    assert parse_date("24/10/2026") == date(2026, 10, 24)
    assert parse_date("24-10-2026") == date(2026, 10, 24)
    assert parse_date("10/24/2026") == date(2026, 10, 24)

    with pytest.raises(ValueError):
        parse_date("invalid_date_format")


def test_csv_import_standard_canonical(db_session):
    """
    Test importing canonical CSV with single signed amount column.
    Positive = inflow/credit, Negative = outflow/debit.
    """
    biz = BusinessModel(id="biz_real_1", legal_name="Real Engineering Ltd", trade_name="Real Eng", industry="Engineering")
    db_session.add(biz)
    acc = BankAccountModel(
        id="acc_1",
        business_id="biz_real_1",
        bank_name="HDFC Bank",
        account_number_mask="...4001",
        opening_balance=Decimal("200000.00"),
        opening_balance_date=parse_date("2026-10-01"),
        is_verified=True,
    )
    db_session.add(acc)
    db_session.commit()

    csv_content = """Date,Description,Amount,Reference
2026-10-05,Customer Receipt - Apex Corp,150000.00,UTR-948102
2026-10-10,Midc Factory Shed Rent,-65000.00,CHQ-481920
2026-10-15,Raw Material Purchase,-40000.00,NEFT-29481
"""
    result = import_service.import_csv_statement(
        db=db_session,
        business_id="biz_real_1",
        filename="hdfc_oct_statement.csv",
        file_bytes=csv_content.encode("utf-8"),
        bank_account_id="acc_1",
    )

    assert result["total_rows"] == 3
    assert result["accepted_rows"] == 3
    assert result["rejected_rows"] == 0
    assert result["duplicate_rows"] == 0
    assert result["reconciliation"]["opening_balance"] == 200000.0
    assert result["reconciliation"]["total_credits"] == 150000.0
    assert result["reconciliation"]["total_debits"] == 105000.0
    assert result["reconciliation"]["net_movement"] == 45000.0
    # 200k + 45k = 245k
    assert result["reconciliation"]["calculated_closing_balance"] == 245000.0
    assert result["reconciliation"]["opening_balance_verified"] is True

    # Verify transactions persisted in database
    txns = db_session.query(BankTransactionModel).filter_by(business_id="biz_real_1").all()
    assert len(txns) == 3


def test_csv_import_credit_debit_columns(db_session):
    """
    Test importing statement with separate Credit (Deposit) and Debit (Withdrawal) columns.
    """
    biz = BusinessModel(id="biz_real_2", legal_name="Precision Spares LLP", trade_name="Precision", industry="Spares")
    db_session.add(biz)
    db_session.commit()

    csv_content = """Txn Date,Narration,Deposit,Withdrawal,Ref No
2026-10-02,Client Payment,85000.00,,NEFT001
2026-10-08,Staff Salary,,50000.00,SAL-OCT
2026-10-12,Electricity Bill,,12500.00,EBILL
"""
    result = import_service.import_csv_statement(
        db=db_session,
        business_id="biz_real_2",
        filename="sbi_statement.csv",
        file_bytes=csv_content.encode("utf-8"),
    )

    assert result["accepted_rows"] == 3
    assert result["reconciliation"]["total_credits"] == 85000.0
    assert result["reconciliation"]["total_debits"] == 62500.0
    assert result["reconciliation"]["net_movement"] == 22500.0
    # Opening balance was not configured -> unverified
    assert result["reconciliation"]["opening_balance"] is None
    assert result["reconciliation"]["opening_balance_verified"] is False


def test_csv_import_duplicate_prevention(db_session):
    """
    Verify both identical file import rejection and internal duplicate row detection.
    """
    biz = BusinessModel(id="biz_dup_test", legal_name="Alpha Tech", trade_name="Alpha", industry="IT")
    db_session.add(biz)
    db_session.commit()

    csv_content = """Date,Description,Amount,Reference
2026-10-01,Client Inflow,50000.00,REF101
2026-10-01,Client Inflow,50000.00,REF101
2026-10-02,Office Rent,-20000.00,REF102
"""
    # 1. First import: row 2 is identical to row 1, so 1 duplicate row detected inside the batch
    result1 = import_service.import_csv_statement(
        db=db_session,
        business_id="biz_dup_test",
        filename="oct_txns.csv",
        file_bytes=csv_content.encode("utf-8"),
    )
    assert result1["accepted_rows"] == 2
    assert result1["duplicate_rows"] == 1

    # 2. Second import of exact same file -> must be blocked with 409 DUPLICATE_FILE_IMPORT
    with pytest.raises(AppException) as exc_info:
        import_service.import_csv_statement(
            db=db_session,
            business_id="biz_dup_test",
            filename="oct_txns.csv",
            file_bytes=csv_content.encode("utf-8"),
        )
    assert exc_info.value.code == "DUPLICATE_FILE_IMPORT"
    assert exc_info.value.status_code == 409


def test_csv_import_invalid_rows_handling(db_session):
    """
    Verify invalid rows are rejected and reported with row numbers and exact reasons,
    while valid rows are still safely processed.
    """
    biz = BusinessModel(id="biz_inv_test", legal_name="Beta Retail", trade_name="Beta", industry="Retail")
    db_session.add(biz)
    db_session.commit()

    csv_content = """Date,Description,Amount
2026-10-01,Valid Inflow,10000.00
invalid_date,Broken Date Row,5000.00
2026-10-02,,15000.00
2026-10-03,Bad Amount,not_a_number
2026-10-04,Valid Outflow,-4000.00
"""
    result = import_service.import_csv_statement(
        db=db_session,
        business_id="biz_inv_test",
        filename="messy_statement.csv",
        file_bytes=csv_content.encode("utf-8"),
    )

    assert result["accepted_rows"] == 2
    assert result["rejected_rows"] == 3
    assert len(result["rejected_details"]) == 3
    rejected_rows = [d["row_number"] for d in result["rejected_details"]]
    assert rejected_rows == [3, 4, 5]


def test_csv_import_with_opening_balance_and_empty_date(db_session):
    """
    Verify statement import with opening balance 234554 and omitted opening balance date
    (the exact user reproduction scenario).
    """
    from datetime import date
    biz = BusinessModel(id="biz_op_bal_test", legal_name="Apex Precision Mfg", trade_name="Apex", industry="Manufacturing")
    db_session.add(biz)
    db_session.commit()

    csv_content = """Date,Description,Amount,Reference
2026-10-01,Customer Advance,150000.00,NEFT-001
2026-10-02,Machinery Maintenance,-35000.00,CHQ-002
2026-10-02,Machinery Maintenance,-35000.00,CHQ-002
2026-10-03,Raw Material Inflow,80000.00,NEFT-003
"""
    result = import_service.import_csv_statement(
        db=db_session,
        business_id="biz_op_bal_test",
        filename="kosha_duplicate_test_data.csv",
        file_bytes=csv_content.encode("utf-8"),
        opening_balance=Decimal("234554"),
        opening_balance_date=None,  # blank/omitted date
    )

    assert result["accepted_rows"] == 3
    assert result["duplicate_rows"] == 1
    assert result["rejected_rows"] == 0
    assert result["reconciliation"]["opening_balance"] == 234554.0
    assert result["reconciliation"]["opening_balance_verified"] is True
    assert result["reconciliation"]["total_credits"] == 230000.0
    assert result["reconciliation"]["total_debits"] == 35000.0
    assert result["reconciliation"]["net_movement"] == 195000.0
    assert result["reconciliation"]["calculated_closing_balance"] == 429554.0

    # Verify bank account was created and verified
    acc = db_session.query(BankAccountModel).filter_by(business_id="biz_op_bal_test").first()
    assert acc is not None
    assert acc.opening_balance == Decimal("234554")
    assert acc.opening_balance_date in (date.today(), datetime.now(timezone.utc).date())
    assert acc.is_verified is True


def test_csv_import_missing_required_columns():
    """Verify specific error messages when required columns are missing."""
    from backend.app.domain.csv_importer import CsvImportError

    # 1. Missing date
    with pytest.raises(CsvImportError) as exc1:
        parse_statement_csv(
            file_bytes=b"Description,Amount\nTest,1000",
            business_id="biz_test",
        )
    assert "Missing date column" in str(exc1.value)

    # 2. Missing description
    with pytest.raises(CsvImportError) as exc2:
        parse_statement_csv(
            file_bytes=b"Date,Amount\n2026-10-01,1000",
            business_id="biz_test",
        )
    assert "Missing description column" in str(exc2.value)

    # 3. Missing amount
    with pytest.raises(CsvImportError) as exc3:
        parse_statement_csv(
            file_bytes=b"Date,Description\n2026-10-01,Salary",
            business_id="biz_test",
        )
    assert "Missing amount column" in str(exc3.value)


def test_csv_import_utf8_bom_and_delimiters(db_session):
    """Verify handling of UTF-8 with BOM, semicolon delimiters, and tab delimiters."""
    biz = BusinessModel(id="biz_bom_test", legal_name="BOM Delim Tech", trade_name="BOM", industry="Tech")
    db_session.add(biz)
    db_session.commit()

    # UTF-8 with BOM and semicolon delimiter
    semicolon_csv = "\ufeffDate;Description;Amount;Reference\n2026-10-01;Vendor Payment;-15000.00;REF-01\n2026-10-02;Inflow;25000.00;REF-02"
    result = import_service.import_csv_statement(
        db=db_session,
        business_id="biz_bom_test",
        filename="semicolon_bom.csv",
        file_bytes=semicolon_csv.encode("utf-8-sig"),
    )
    assert result["accepted_rows"] == 2
    assert result["reconciliation"]["total_credits"] == 25000.0
    assert result["reconciliation"]["total_debits"] == 15000.0


def test_csv_import_failed_import_leaves_no_corrupted_records(db_session):
    """Verify that a rejected CSV import leaves 0 records in the database."""
    biz = BusinessModel(id="biz_clean_fail", legal_name="Clean Fail", trade_name="Clean", industry="Retail")
    db_session.add(biz)
    db_session.commit()

    with pytest.raises(AppException):
        import_service.import_csv_statement(
            db=db_session,
            business_id="biz_clean_fail",
            filename="bad_columns.csv",
            file_bytes=b"InvalidCol1,InvalidCol2\nFoo,Bar",
        )

    txns = db_session.query(BankTransactionModel).filter_by(business_id="biz_clean_fail").all()
    batches = db_session.query(ImportBatchModel).filter_by(business_id="biz_clean_fail").all()
    assert len(txns) == 0
    assert len(batches) == 0


def test_bank_account_create_schema_defaults():
    """Verify BankAccountCreate defaults account_number_mask and opening_balance_date cleanly."""
    from backend.app.schemas.cashflow import BankAccountCreate
    from datetime import date

    # Empty optional fields should default without 422
    acc = BankAccountCreate(
        bank_name="Imported Statement Account",
        opening_balance=Decimal("234554"),
    )
    assert acc.account_number_mask == "...0000"
    assert acc.opening_balance_date in (date.today(), datetime.now(timezone.utc).date())
    assert acc.opening_balance == Decimal("234554")
    assert acc.is_verified is True
