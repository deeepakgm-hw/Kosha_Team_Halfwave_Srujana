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
        "posted date", "posted_date", "post date", "post_date",
        "record_date_or_type", "record date or type", "record_date", "record date",
        "date_or_type", "date or type", "due_date_or_frequency"
    ],
    "description": [
        "description", "narration", "particulars", "details", "remarks",
        "memo", "transaction details", "transaction_details", "txn details",
        "txn_details", "payee", "payer",
        "counterparty_or_category", "counterparty or category", "counterparty",
        "party", "party_name", "party name", "beneficiary", "beneficiary_name",
        "category", "vendor", "customer", "entity", "title", "purpose",
        "duplicate_note", "duplicate note", "note", "notes", "type", "record_type"
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
        "net amount", "net_amount", "total", "total amount", "total_amount",
        "amount_inr", "amount in inr", "amount (inr)", "amount (rs)", "amt_inr", "amt", "inr"
    ],
    "reference": [
        "reference", "ref", "external_reference", "external reference", "external_ref",
        "reference no", "reference_no", "ref no", "ref_no", "chq no", "cheque no",
        "chq_no", "cheque_no", "utr", "utr no", "utr_no", "txn id", "txn_id",
        "transaction id", "transaction_id", "record_id", "record id", "id",
        "invoice_no", "invoice_number", "bill_no", "bill_number"
    ],
    "source": [
        "source_file", "source file", "source", "doc_type", "document_type"
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
        "source": None,
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

    # Defensive fallbacks:
    # If date is unassigned, look for any unused column mentioning date/time/day
    if col_map["date"] is None:
        for idx, h in enumerate(norm_headers):
            if idx not in used_indices and any(w in h for w in ["date", "time", "day", "txn"]):
                col_map["date"] = idx
                used_indices.add(idx)
                break

    # If description is unassigned, use any remaining unused text column
    if col_map["description"] is None:
        for idx, h in enumerate(norm_headers):
            if idx not in used_indices:
                col_map["description"] = idx
                used_indices.add(idx)
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
    exact_file_duplicates = 0
    previously_imported_duplicates = 0
    potential_duplicates_details: List[Dict[str, Any]] = []

    seen_in_batch: Set[str] = set()
    db_fingerprints = existing_fingerprints or set()
    seen_fallback_occurrences: Dict[str, int] = {}
    data_rows_found = False

    for row_idx, row in enumerate(reader, start=header_line_idx + 1):
        if not row or all(c.strip() == "" for c in row):
            continue  # skip completely blank lines

        data_rows_found = True

        try:
            # 1. Parse Date and Description with Polymorphic Header Support
            date_idx = col_map["date"]
            if date_idx is None or date_idx >= len(row):
                raise ValueError("Row missing date column")
            raw_date_str = row[date_idx].strip()

            desc_idx = col_map.get("description")
            raw_desc_str = (
                row[desc_idx].strip()
                if desc_idx is not None and desc_idx < len(row)
                else ""
            )

            txn_date = None
            description = raw_desc_str

            try:
                txn_date = parse_date(raw_date_str)
            except ValueError:
                # If date_idx didn't parse as date (e.g. Inverted row where 'record_date_or_type' is 'Payroll'),
                # check if the description column holds a valid date
                try:
                    txn_date = parse_date(raw_desc_str)
                    description = raw_date_str
                except ValueError:
                    # Search other non-amount columns for a valid date
                    for alt_idx, alt_cell in enumerate(row):
                        if alt_idx in [col_map.get("amount"), col_map.get("credit"), col_map.get("debit"), col_map.get("reference")]:
                            continue
                        try:
                            txn_date = parse_date(alt_cell.strip())
                            description = raw_desc_str or raw_date_str or alt_cell.strip()
                            break
                        except ValueError:
                            continue
                    if txn_date is None:
                        raise ValueError(f"Row missing valid transaction date: '{raw_date_str}'")

            if not description:
                raise ValueError("Row missing transaction description")

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

                # Source-aware outflow adjustment:
                # If a source column indicates an expense/bill/recurring payment and amount was positive, mark as debit outflow
                source_idx = col_map.get("source")
                if source_idx is not None and source_idx < len(row):
                    src_val = row[source_idx].strip().lower()
                    if any(w in src_val for w in ["bill", "recurring", "payment", "payout", "expense", "payroll", "lease", "rent"]):
                        if signed_amount > 0:
                            signed_amount = -signed_amount
                    elif any(w in src_val for w in ["invoice", "receipt", "sale", "revenue"]):
                        if signed_amount < 0:
                            signed_amount = abs(signed_amount)

                txn_type = "credit" if signed_amount > 0 else "debit"

            # 4. Parse External Reference
            external_ref: Optional[str] = None
            ref_idx = col_map["reference"]
            if ref_idx is not None and ref_idx < len(row) and row[ref_idx].strip():
                external_ref = row[ref_idx].strip()

            # 5. Duplicate Detection & Fallback Key
            clean_desc = re.sub(r"\s+", " ", description.strip().lower())
            fallback_key = f"{business_id}|{account_id or ''}|{txn_date.isoformat()}|{signed_amount:.2f}|{clean_desc}"
            prior_occurrences = seen_fallback_occurrences.get(fallback_key, 0)

            # Build canonical fingerprint
            fingerprint = compute_transaction_fingerprint(
                business_id=business_id,
                account_id=account_id,
                txn_date=txn_date,
                amount=signed_amount,
                description=description,
                reference=external_ref,
            )

            final_fingerprint = fingerprint

            if external_ref:
                # When external reference (UTR/cheque) exists, identical match is always an exact duplicate
                if fingerprint in seen_in_batch:
                    exact_file_duplicates += 1
                    continue
                if fingerprint in db_fingerprints:
                    previously_imported_duplicates += 1
                    continue
            else:
                # Without external reference: repeated entries on the same day are common in MSME cash/retail transactions.
                # Legitimate repeated occurrences get discriminators so they are not falsely dropped from cash flow.
                if prior_occurrences > 0:
                    raw_disc = f"{fallback_key}|occ_{prior_occurrences + 1}"
                    final_fingerprint = hashlib.sha256(raw_disc.encode("utf-8")).hexdigest()
                    potential_duplicates_details.append({
                        "row_number": row_idx,
                        "date": txn_date.isoformat(),
                        "amount": float(signed_amount),
                        "description": description,
                        "reason": f"Repeated occurrence #{prior_occurrences + 1} with identical date and amount but no external reference.",
                    })

                if final_fingerprint in seen_in_batch:
                    exact_file_duplicates += 1
                    continue
                if final_fingerprint in db_fingerprints:
                    previously_imported_duplicates += 1
                    continue

            seen_in_batch.add(final_fingerprint)
            seen_fallback_occurrences[fallback_key] = prior_occurrences + 1

            accepted_rows.append({
                "row_number": row_idx,
                "business_id": business_id,
                "bank_account_id": account_id,
                "transaction_date": txn_date,
                "description": description,
                "amount": signed_amount,
                "transaction_type": txn_type,
                "external_reference": external_ref,
                "fingerprint": final_fingerprint,
            })

        except Exception as exc:
            rejected_rows.append({
                "row_number": row_idx,
                "raw_content": delimiter.join(row),
                "error": str(exc),
            })

    if not data_rows_found:
        raise CsvImportError("CSV file contains headers but no transaction data rows.")

    duplicate_count = exact_file_duplicates + previously_imported_duplicates
    breakdown = {
        "exact_file_duplicates": exact_file_duplicates,
        "previously_imported_duplicates": previously_imported_duplicates,
        "potential_duplicates_review": len(potential_duplicates_details),
        "potential_duplicates_details": potential_duplicates_details,
    }

    return accepted_rows, rejected_rows, duplicate_count, breakdown
