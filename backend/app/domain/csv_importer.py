"""
Bank Statement CSV Import Engine.
Parses, sanitizes, and validates bank statement CSV records.
Supports canonical schema, auto-detection of column variations,
multi-encoding decoding, Decimal-safe currency parsing, and duplicate fingerprinting.
"""

import csv
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import hashlib
import io
import re
from typing import Any, Dict, List, Optional, Set, Tuple


class CsvImportError(Exception):
    """Base error for CSV statement parsing."""
    pass


DATE_FORMATS = [
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d.%m.%Y",
    "%m/%d/%Y",
    "%Y/%m/%d",
    "%d %b %Y",
    "%d %B %Y",
    "%b %d, %Y",
    "%B %d, %Y",
    "%d-%b-%Y",
    "%d-%b-%y",
    "%d/%m/%y",
    "%d-%m-%y",
    "%Y.%m.%d",
]

# Aliases for flexible column detection
COLUMN_ALIASES = {
    "date": [
        "date", "transaction date", "transaction_date", "txn date", "txn_date",
        "value date", "val_date", "value_date", "booking date", "booking_date",
        "posted date", "posted_date", "post date", "post_date"
    ],
    "description": [
        "description", "narration", "particulars", "details", "remarks",
        "memo", "transaction details", "transaction_details", "txn details",
        "txn_details", "payee", "payer"
    ],
    "credit": [
        "credit", "cr", "deposit", "deposits", "inflow", "inflows",
        "received", "money in", "money_in", "cr amount", "cr_amount", "credit amount", "credit_amount"
    ],
    "debit": [
        "debit", "dr", "withdrawal", "withdrawals", "outflow", "outflows",
        "spent", "money out", "money_out", "dr amount", "dr_amount", "debit amount", "debit_amount"
    ],
    "amount": [
        "amount", "txn amount", "txn_amount", "transaction amount", "transaction_amount",
        "net amount", "net_amount", "total", "total amount", "total_amount", "inr"
    ],
    "reference": [
        "reference", "ref", "external_reference", "external reference", "external_ref",
        "reference no", "reference_no", "ref no", "ref_no", "chq no", "cheque no",
        "chq_no", "cheque_no", "utr", "utr no", "utr_no", "txn id", "txn_id",
        "transaction id", "transaction_id"
    ],
    "account": [
        "account", "account number", "account_number", "acc no", "acc_no", "account_no"
    ],
    "balance": [
        "balance", "closing balance", "closing_balance", "ledger balance", "ledger_balance",
        "running balance", "running_balance", "available balance", "available_balance"
    ],
}


def compute_file_hash(content: bytes) -> str:
    """Returns SHA256 hex digest of file bytes for idempotent upload tracking."""
    return hashlib.sha256(content).hexdigest()


def compute_transaction_fingerprint(
    business_id: str,
    account_id: Optional[str],
    txn_date: date,
    amount: Decimal,
    description: str,
    reference: Optional[str],
) -> str:
    """
    Computes a cryptographic SHA256 fingerprint for a single transaction
    to detect duplicates across uploads and within the same file.
    """
    normalized_desc = re.sub(r"\s+", " ", description.strip().lower())
    normalized_ref = str(reference or "").strip().lower()
    raw = f"{business_id}|{account_id or ''}|{txn_date.isoformat()}|{amount:.2f}|{normalized_desc}|{normalized_ref}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def decode_csv_bytes(file_bytes: bytes) -> str:
    """
    Attempts to decode file bytes using common bank statement encodings:
    UTF-8-SIG (Excel CSV), UTF-8, Latin-1 / Windows-1252.
    Strips leading UTF-8 BOM if present.
    """
    for encoding in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
        try:
            decoded = file_bytes.decode(encoding)
            return decoded.lstrip("\ufeff")
        except UnicodeDecodeError:
            continue
    raise CsvImportError("Unsupported file encoding. Please save the CSV file as UTF-8.")


def parse_date(date_str: str) -> date:
    """Parses date string against multiple standard international and Indian bank formats."""
    cleaned = date_str.strip()
    # Check for ISO format directly
    try:
        return date.fromisoformat(cleaned[:10])
    except (ValueError, TypeError):
        pass

    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue

    raise ValueError(f"Unrecognized date format: '{date_str}'. Expected formats: YYYY-MM-DD or DD/MM/YYYY.")


def parse_decimal_amount(value: Any) -> Decimal:
    """
    Safely parses an amount string into a Python Decimal with 2 decimal places.
    Handles commas (e.g. 1,00,000.00), currency symbols (₹, $, €, £), parentheses (500.00),
    trailing Dr/Cr notation, and whitespace.
    """
    if value is None:
        raise ValueError("Amount is empty")

    s = str(value).strip()
    if not s or s.lower() in ["-", "--", "nil", "null", "none", "nan"]:
        raise ValueError("Amount is empty")

    # Handle negative in parentheses: (100.50) -> -100.50
    is_paren_negative = False
    if s.startswith("(") and s.endswith(")"):
        is_paren_negative = True
        s = s[1:-1].strip()

    # Handle trailing CR or DR
    trailing_dr = False
    if s.lower().endswith("dr"):
        trailing_dr = True
        s = s[:-2].strip()
    elif s.lower().endswith("cr"):
        s = s[:-2].strip()

    # Strip currency symbols and whitespace
    s = re.sub(r"[₹\$€£\s]", "", s)
    # Remove commas
    s = s.replace(",", "")

    try:
        dec = Decimal(s).quantize(Decimal("0.01"))
        if is_paren_negative or trailing_dr:
            dec = -abs(dec)
        return dec
    except (InvalidOperation, TypeError):
        raise ValueError(f"Invalid monetary amount: '{value}'")


def resolve_columns(headers: List[str], custom_mapping: Optional[Dict[str, str]] = None) -> Dict[str, Optional[int]]:
    """
    Maps logical fields ('date', 'description', 'amount', 'credit', 'debit', 'reference')
    to 0-based column indices based on header names or custom mapping.
    Prevents assigning the same column to multiple logical fields.
    """
    norm_headers = [h.strip().lower() for h in headers]
    used_indices: Set[int] = set()

    col_map: Dict[str, Optional[int]] = {
        "date": None,
        "description": None,
        "amount": None,
        "credit": None,
        "debit": None,
        "reference": None,
        "account": None,
        "balance": None,
    }

    # Apply custom mapping if provided
    if custom_mapping:
        for logical_key, target_header in custom_mapping.items():
            logical_key_lower = logical_key.lower()
            if logical_key_lower in col_map:
                target_lower = target_header.strip().lower()
                for idx, h in enumerate(norm_headers):
                    if h == target_lower and idx not in used_indices:
                        col_map[logical_key_lower] = idx
                        used_indices.add(idx)
                        break

    # Exact match pass
    for logical_key, aliases in COLUMN_ALIASES.items():
        if col_map.get(logical_key) is None:
            for idx, h in enumerate(norm_headers):
                if idx in used_indices:
                    continue
                # Normalize spaces and underscores
                h_norm = re.sub(r"[\s_]+", " ", h)
                for alias in aliases:
                    alias_norm = re.sub(r"[\s_]+", " ", alias)
                    if h == alias or h_norm == alias_norm:
                        col_map[logical_key] = idx
                        used_indices.add(idx)
                        break
                if col_map.get(logical_key) is not None:
                    break

    # Prefix/contains pass for unassigned fields (skip balance)
    for logical_key, aliases in COLUMN_ALIASES.items():
        if logical_key == "balance":
            continue
        if col_map.get(logical_key) is None:
            for idx, h in enumerate(norm_headers):
                if idx in used_indices:
                    continue
                h_norm = re.sub(r"[\s_]+", " ", h)
                for alias in aliases:
                    alias_norm = re.sub(r"[\s_]+", " ", alias)
                    if len(alias_norm) >= 3 and (h_norm.startswith(alias_norm) or alias_norm in h_norm):
                        col_map[logical_key] = idx
                        used_indices.add(idx)
                        break
                if col_map.get(logical_key) is not None:
                    break

    # Validation: Must have at least a date, description, and an amount or credit/debit
    if col_map["date"] is None:
        raise CsvImportError("Missing date column. Please include a column named 'date', 'transaction_date', or 'txn_date'.")
    if col_map["description"] is None:
        raise CsvImportError("Missing description column. Please include a column named 'description', 'narration', or 'particulars'.")
    if col_map["amount"] is None and (col_map["credit"] is None and col_map["debit"] is None):
        raise CsvImportError("Missing amount column. Must provide an 'amount' column or separate 'credit' and 'debit' columns.")

    return col_map


def parse_statement_csv(
    file_bytes: bytes,
    business_id: str,
    account_id: Optional[str] = None,
    custom_mapping: Optional[Dict[str, str]] = None,
    amount_sign_mode: str = "standard",  # "standard": positive=credit, negative=debit; "inverted": negative=credit, positive=debit
    existing_fingerprints: Optional[Set[str]] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int]:
    """
    Parses a raw CSV file into validated transaction dictionaries.
    
    :param file_bytes: Raw file binary content.
    :param business_id: Target business identifier.
    :param account_id: Optional bank account identifier.
    :param custom_mapping: Optional column header overrides.
    :param amount_sign_mode: Sign convention interpretation.
    :param existing_fingerprints: Set of fingerprints already in the database for deduplication.
    :return: (accepted_rows, rejected_rows, duplicate_count)
    """
    text_content = decode_csv_bytes(file_bytes)
    cleaned_text = text_content.strip()
    if not cleaned_text:
        raise CsvImportError("CSV file is completely empty.")

    f = io.StringIO(cleaned_text)

    # Sniff delimiter (comma, tab, semicolon)
    sample = cleaned_text[:2048]
    delimiter = ","
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t;")
        delimiter = dialect.delimiter
    except csv.Error:
        # Fallback delimiter detection based on header line
        first_line = sample.split("\n")[0] if sample else ""
        counts = {
            ",": first_line.count(","),
            ";": first_line.count(";"),
            "\t": first_line.count("\t"),
        }
        best = max(counts, key=counts.get)
        if counts[best] > 0:
            delimiter = best

    reader = csv.reader(f, delimiter=delimiter)
    headers: Optional[List[str]] = None
    header_line_idx = 0

    for idx, row in enumerate(reader, start=1):
        if row and any(cell.strip() for cell in row):
            headers = row
            header_line_idx = idx
            break

    if not headers:
        raise CsvImportError("CSV file is completely empty.")

    col_map = resolve_columns(headers, custom_mapping=custom_mapping)

    accepted_rows: List[Dict[str, Any]] = []
    rejected_rows: List[Dict[str, Any]] = []
    duplicate_count = 0

    seen_in_batch: Set[str] = set()
    db_fingerprints = existing_fingerprints or set()
    data_rows_found = False

    for row_idx, row in enumerate(reader, start=header_line_idx + 1):
        if not row or all(c.strip() == "" for c in row):
            continue  # skip completely blank lines

        data_rows_found = True

        try:
            # 1. Parse Date
            date_idx = col_map["date"]
            if date_idx is None or date_idx >= len(row):
                raise ValueError("Row missing date column")
            txn_date = parse_date(row[date_idx])

            # 2. Parse Description
            desc_idx = col_map["description"]
            if desc_idx is None or desc_idx >= len(row) or not row[desc_idx].strip():
                raise ValueError("Row missing transaction description")
            description = row[desc_idx].strip()

            # 3. Parse Amount
            signed_amount: Decimal
            txn_type: str

            if col_map["credit"] is not None or col_map["debit"] is not None:
                # Credit/Debit columns layout
                cr_str = row[col_map["credit"]].strip() if col_map["credit"] is not None and col_map["credit"] < len(row) else ""
                dr_str = row[col_map["debit"]].strip() if col_map["debit"] is not None and col_map["debit"] < len(row) else ""

                empty_markers = {"", "-", "--", "0", "0.00", "0.0", "nil", "null", "none", "nan"}
                has_cr = bool(cr_str and cr_str.lower() not in empty_markers)
                has_dr = bool(dr_str and dr_str.lower() not in empty_markers)

                if has_cr and not has_dr:
                    val = parse_decimal_amount(cr_str)
                    signed_amount = abs(val)
                    txn_type = "credit"
                elif has_dr and not has_cr:
                    val = parse_decimal_amount(dr_str)
                    signed_amount = -abs(val)
                    txn_type = "debit"
                elif has_cr and has_dr:
                    # Both present: net them
                    cr_val = abs(parse_decimal_amount(cr_str))
                    dr_val = abs(parse_decimal_amount(dr_str))
                    signed_amount = cr_val - dr_val
                    txn_type = "credit" if signed_amount >= 0 else "debit"
                else:
                    raise ValueError("Row has neither credit nor debit amount")
            else:
                # Single amount column layout
                amt_idx = col_map["amount"]
                if amt_idx is None or amt_idx >= len(row):
                    raise ValueError("Row missing amount column")
                raw_amt = parse_decimal_amount(row[amt_idx])
                if raw_amt == 0:
                    raise ValueError("Transaction amount cannot be zero")

                if amount_sign_mode == "inverted":
                    signed_amount = -raw_amt
                else:
                    signed_amount = raw_amt

                txn_type = "credit" if signed_amount > 0 else "debit"

            # 4. Parse External Reference
            external_ref: Optional[str] = None
            ref_idx = col_map["reference"]
            if ref_idx is not None and ref_idx < len(row) and row[ref_idx].strip():
                external_ref = row[ref_idx].strip()

            # 5. Duplicate Detection
            fingerprint = compute_transaction_fingerprint(
                business_id=business_id,
                account_id=account_id,
                txn_date=txn_date,
                amount=signed_amount,
                description=description,
                reference=external_ref,
            )

            if fingerprint in seen_in_batch or fingerprint in db_fingerprints:
                duplicate_count += 1
                continue

            seen_in_batch.add(fingerprint)

            accepted_rows.append({
                "row_number": row_idx,
                "business_id": business_id,
                "bank_account_id": account_id,
                "transaction_date": txn_date,
                "description": description,
                "amount": signed_amount,
                "transaction_type": txn_type,
                "external_reference": external_ref,
                "fingerprint": fingerprint,
            })

        except Exception as exc:
            rejected_rows.append({
                "row_number": row_idx,
                "raw_content": delimiter.join(row),
                "error": str(exc),
            })

    if not data_rows_found:
        raise CsvImportError("CSV file contains headers but no transaction data rows.")

    return accepted_rows, rejected_rows, duplicate_count
