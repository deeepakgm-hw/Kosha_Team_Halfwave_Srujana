"""
Predefined Synthetic Business Personas:
1. Manufacturer with one big buyer: Apex Precision Components (Auto Ancillary SME)
2. Seasonal trader: GreenGrocer Distribution (FMCG / Agri Wholesale SME)
3. Payroll-heavy service firm: PixelCraft Digital Solutions (Software & Design Agency)
"""

from datetime import date, timedelta
from typing import Any, Dict, List, Tuple

SYNTHETIC_PERSONAS: Dict[str, Dict[str, Any]] = {
    "manufacturer": {
        "id": "apex_precision_mfg",
        "legal_name": "Apex Precision Components Pvt Ltd",
        "trade_name": "Apex Precision",
        "industry": "Auto Ancillary Manufacturing",
        "msme_category": "Small",
        "opening_cash": 450000.0,
        "monthly_payroll": 180000.0,
        "monthly_rent": 65000.0,
        "is_synthetic": True,
    },
    "trader": {
        "id": "biz_ret_03",
        "legal_name": "GreenGrocer Distribution Pvt Ltd",
        "trade_name": "GreenGrocer Hub",
        "industry": "FMCG / Agri Wholesale",
        "msme_category": "Small",
        "opening_cash": 620000.0,
        "monthly_payroll": 140000.0,
        "monthly_rent": 90000.0,
        "is_synthetic": True,
    },
    "service": {
        "id": "biz_srv_02",
        "legal_name": "PixelCraft Digital Solutions LLP",
        "trade_name": "PixelCraft Studio",
        "industry": "Software & Digital Agency",
        "msme_category": "Micro",
        "opening_cash": 280000.0,
        "monthly_payroll": 220000.0,
        "monthly_rent": 35000.0,
        "is_synthetic": True,
    },
}

# Aliases for lookup flexibility
PERSONA_ALIAS_MAP = {
    "apex_precision_mfg": "manufacturer",
    "manufacturing_sme": "manufacturer",
    "manufacturer": "manufacturer",
    "biz_ret_03": "trader",
    "b2b_retailer": "trader",
    "trader": "trader",
    "seasonal_trader": "trader",
    "biz_srv_02": "service",
    "services_agency": "service",
    "service": "service",
    "payroll_heavy_service": "service",
}


def get_sample_forecast_dataset(
    start_date: date,
    persona_id: str = "apex_precision_mfg",
) -> Tuple[float, List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Returns realistic 90-day synthetic receivables and commitments for the demo persona.
    All dates are projected relative to start_date.
    """
    resolved_key = PERSONA_ALIAS_MAP.get(persona_id.lower().strip(), "manufacturer")

    if resolved_key == "trader":
        # Seasonal trader (GreenGrocer Distribution Pvt Ltd)
        starting_cash = 620000.0
        receivables = [
            {
                "id": "INV-RET-001",
                "customer_name": "Metro Hypermarket Chain",
                "amount": 340000.0,
                "due_date": (start_date + timedelta(days=8)).isoformat(),
                "expected_payment_date": (start_date + timedelta(days=8)).isoformat(),
                "status": "expected",
                "paid_amount": 0.0,
                "is_synthetic": True,
            },
            {
                "id": "INV-RET-002",
                "customer_name": "Central Supermarkets LLP",
                "amount": 180000.0,
                "due_date": (start_date + timedelta(days=24)).isoformat(),
                "expected_payment_date": (start_date + timedelta(days=24)).isoformat(),
                "status": "expected",
                "paid_amount": 0.0,
                "is_synthetic": True,
            },
            {
                "id": "INV-RET-003",
                "customer_name": "Diwali Festival Bulk Order",
                "amount": 420000.0,
                "due_date": (start_date + timedelta(days=48)).isoformat(),
                "expected_payment_date": (start_date + timedelta(days=48)).isoformat(),
                "status": "expected",
                "paid_amount": 0.0,
                "is_synthetic": True,
            },
            {
                "id": "INV-RET-004",
                "customer_name": "Regional Grocery Network",
                "amount": 150000.0,
                "due_date": (start_date + timedelta(days=75)).isoformat(),
                "expected_payment_date": (start_date + timedelta(days=75)).isoformat(),
                "status": "expected",
                "paid_amount": 0.0,
                "is_synthetic": True,
            },
        ]
        outflows = [
            # Bulk inventory purchase upfront
            {
                "id": "OBL-TRD-INVENTORY",
                "title": "Seasonal Bulk FMCG Inventory Intake",
                "amount": 380000.0,
                "due_date": (start_date + timedelta(days=10)).isoformat(),
                "category": "vendor",
                "priority": "critical",
            },
            {
                "id": "OBL-TRD-RENT-M1",
                "title": "Central Cold-Storage Warehouse Rent",
                "amount": 90000.0,
                "due_date": (start_date + timedelta(days=12)).isoformat(),
                "category": "rent",
                "priority": "critical",
            },
            {
                "id": "OBL-TRD-PAYROLL-M1",
                "title": "Warehouse Logistics Payroll",
                "amount": 140000.0,
                "due_date": (start_date + timedelta(days=15)).isoformat(),
                "category": "payroll",
                "priority": "critical",
            },
            {
                "id": "OBL-TRD-GST-M1",
                "title": "GSTR-3B Tax Settlement",
                "amount": 62000.0,
                "due_date": (start_date + timedelta(days=26)).isoformat(),
                "category": "statutory",
                "priority": "critical",
            },
            # Month 2
            {
                "id": "OBL-TRD-RENT-M2",
                "title": "Central Cold-Storage Warehouse Rent",
                "amount": 90000.0,
                "due_date": (start_date + timedelta(days=42)).isoformat(),
                "category": "rent",
                "priority": "critical",
            },
            {
                "id": "OBL-TRD-PAYROLL-M2",
                "title": "Warehouse Logistics Payroll",
                "amount": 140000.0,
                "due_date": (start_date + timedelta(days=45)).isoformat(),
                "category": "payroll",
                "priority": "critical",
            },
            {
                "id": "OBL-TRD-PACKING",
                "title": "Festive Packaging & Corrugated Supplies",
                "amount": 75000.0,
                "due_date": (start_date + timedelta(days=52)).isoformat(),
                "category": "vendor",
                "priority": "normal",
            },
            # Month 3
            {
                "id": "OBL-TRD-RENT-M3",
                "title": "Central Cold-Storage Warehouse Rent",
                "amount": 90000.0,
                "due_date": (start_date + timedelta(days=72)).isoformat(),
                "category": "rent",
                "priority": "critical",
            },
            {
                "id": "OBL-TRD-PAYROLL-M3",
                "title": "Warehouse Logistics Payroll",
                "amount": 140000.0,
                "due_date": (start_date + timedelta(days=75)).isoformat(),
                "category": "payroll",
                "priority": "critical",
            },
        ]
        return starting_cash, receivables, outflows

    if resolved_key == "service":
        # Payroll-heavy service firm (PixelCraft Digital Solutions LLP)
        starting_cash = 280000.0
        receivables = [
            {
                "id": "INV-SRV-001",
                "customer_name": "Fintech Enterprise Retainer",
                "amount": 160000.0,
                "due_date": (start_date + timedelta(days=6)).isoformat(),
                "expected_payment_date": (start_date + timedelta(days=6)).isoformat(),
                "status": "expected",
                "paid_amount": 0.0,
                "is_synthetic": True,
            },
            {
                "id": "INV-SRV-002",
                "customer_name": "Healthcare SaaS Milestone #2",
                "amount": 190000.0,
                "due_date": (start_date + timedelta(days=25)).isoformat(),
                "expected_payment_date": (start_date + timedelta(days=25)).isoformat(),
                "status": "expected",
                "paid_amount": 0.0,
                "is_synthetic": True,
            },
            {
                "id": "INV-SRV-003",
                "customer_name": "E-Commerce App Redesign",
                "amount": 140000.0,
                "due_date": (start_date + timedelta(days=55)).isoformat(),
                "expected_payment_date": (start_date + timedelta(days=55)).isoformat(),
                "status": "expected",
                "paid_amount": 0.0,
                "is_synthetic": True,
            },
            {
                "id": "INV-SRV-004",
                "customer_name": "Annual Maintenance Contract",
                "amount": 120000.0,
                "due_date": (start_date + timedelta(days=78)).isoformat(),
                "expected_payment_date": (start_date + timedelta(days=78)).isoformat(),
                "status": "expected",
                "paid_amount": 0.0,
                "is_synthetic": True,
            },
        ]
        outflows = [
            # High payroll commitment on 1st/month
            {
                "id": "OBL-SRV-PAYROLL-M1",
                "title": "Engineering & Design Team Salaries",
                "amount": 220000.0,
                "due_date": (start_date + timedelta(days=7)).isoformat(),
                "category": "payroll",
                "priority": "critical",
            },
            {
                "id": "OBL-SRV-OFFICE-M1",
                "title": "Co-Working Studio Lease",
                "amount": 35000.0,
                "due_date": (start_date + timedelta(days=10)).isoformat(),
                "category": "rent",
                "priority": "critical",
            },
            {
                "id": "OBL-SRV-CLOUD-M1",
                "title": "AWS & GitHub Cloud Infrastructure",
                "amount": 28000.0,
                "due_date": (start_date + timedelta(days=18)).isoformat(),
                "category": "vendor",
                "priority": "normal",
            },
            # Month 2
            {
                "id": "OBL-SRV-PAYROLL-M2",
                "title": "Engineering & Design Team Salaries",
                "amount": 220000.0,
                "due_date": (start_date + timedelta(days=37)).isoformat(),
                "category": "payroll",
                "priority": "critical",
            },
            {
                "id": "OBL-SRV-OFFICE-M2",
                "title": "Co-Working Studio Lease",
                "amount": 35000.0,
                "due_date": (start_date + timedelta(days=40)).isoformat(),
                "category": "rent",
                "priority": "critical",
            },
            # Month 3
            {
                "id": "OBL-SRV-PAYROLL-M3",
                "title": "Engineering & Design Team Salaries",
                "amount": 220000.0,
                "due_date": (start_date + timedelta(days=67)).isoformat(),
                "category": "payroll",
                "priority": "critical",
            },
            {
                "id": "OBL-SRV-OFFICE-M3",
                "title": "Co-Working Studio Lease",
                "amount": 35000.0,
                "due_date": (start_date + timedelta(days=70)).isoformat(),
                "category": "rent",
                "priority": "critical",
            },
        ]
        return starting_cash, receivables, outflows

    # Default: Manufacturer with one big buyer (Apex Precision Components Pvt Ltd)
    starting_cash = 450000.0
    receivables = [
        {
            "id": "INV-SYNTH-001",
            "customer_name": "Western Auto Assemblers (Tier-1 Main Buyer)",
            "amount": 280000.0,
            "due_date": (start_date + timedelta(days=11)).isoformat(),
            "expected_payment_date": (start_date + timedelta(days=11)).isoformat(),
            "status": "expected",
            "paid_amount": 0.0,
            "is_synthetic": True,
        },
        {
            "id": "INV-SYNTH-002",
            "customer_name": "Bharat Gears Ltd",
            "amount": 195000.0,
            "due_date": (start_date - timedelta(days=6)).isoformat(),
            "expected_payment_date": (start_date + timedelta(days=22)).isoformat(),
            "status": "overdue",
            "paid_amount": 0.0,
            "is_synthetic": True,
        },
        {
            "id": "INV-SYNTH-003",
            "customer_name": "Mahindra Tier-2 Subsidiary",
            "amount": 210000.0,
            "due_date": (start_date + timedelta(days=50)).isoformat(),
            "expected_payment_date": (start_date + timedelta(days=50)).isoformat(),
            "status": "expected",
            "paid_amount": 0.0,
            "is_synthetic": True,
        },
        {
            "id": "INV-SYNTH-004",
            "customer_name": "Bajaj Casting Hub",
            "amount": 185000.0,
            "due_date": (start_date + timedelta(days=78)).isoformat(),
            "expected_payment_date": (start_date + timedelta(days=78)).isoformat(),
            "status": "expected",
            "paid_amount": 0.0,
            "is_synthetic": True,
        },
    ]

    outflows = [
        # Month 1
        {
            "id": "OBL-M1-RENT",
            "title": "MIDC Factory Shed Rent",
            "amount": 65000.0,
            "due_date": (start_date + timedelta(days=12)).isoformat(),
            "category": "rent",
            "priority": "critical",
        },
        {
            "id": "OBL-M1-PAYROLL",
            "title": "Factory Workforce Payroll",
            "amount": 180000.0,
            "due_date": (start_date + timedelta(days=14)).isoformat(),
            "category": "payroll",
            "priority": "critical",
        },
        {
            "id": "OBL-M1-GST",
            "title": "GSTR-3B Tax Filing Settlement",
            "amount": 54000.0,
            "due_date": (start_date + timedelta(days=27)).isoformat(),
            "category": "statutory",
            "priority": "critical",
        },
        {
            "id": "OBL-M1-SPARES",
            "title": "CNC Machine Tooling Spares",
            "amount": 45000.0,
            "due_date": (start_date + timedelta(days=35)).isoformat(),
            "category": "vendor",
            "priority": "normal",
        },
        # Month 2
        {
            "id": "OBL-M2-RENT",
            "title": "MIDC Factory Shed Rent",
            "amount": 65000.0,
            "due_date": (start_date + timedelta(days=42)).isoformat(),
            "category": "rent",
            "priority": "critical",
        },
        {
            "id": "OBL-M2-PAYROLL",
            "title": "Factory Workforce Payroll",
            "amount": 180000.0,
            "due_date": (start_date + timedelta(days=44)).isoformat(),
            "category": "payroll",
            "priority": "critical",
        },
        {
            "id": "OBL-M2-GST",
            "title": "GSTR-3B Tax Filing Settlement",
            "amount": 54000.0,
            "due_date": (start_date + timedelta(days=57)).isoformat(),
            "category": "statutory",
            "priority": "critical",
        },
        {
            "id": "OBL-M2-STEEL",
            "title": "Special Alloy Steel Supply Due",
            "amount": 90000.0,
            "due_date": (start_date + timedelta(days=63)).isoformat(),
            "category": "vendor",
            "priority": "normal",
        },
        # Month 3
        {
            "id": "OBL-M3-RENT",
            "title": "MIDC Factory Shed Rent",
            "amount": 65000.0,
            "due_date": (start_date + timedelta(days=72)).isoformat(),
            "category": "rent",
            "priority": "critical",
        },
        {
            "id": "OBL-M3-PAYROLL",
            "title": "Factory Workforce Payroll",
            "amount": 180000.0,
            "due_date": (start_date + timedelta(days=74)).isoformat(),
            "category": "payroll",
            "priority": "critical",
        },
        {
            "id": "OBL-M3-GST",
            "title": "GSTR-3B Tax Filing Settlement",
            "amount": 54000.0,
            "due_date": (start_date + timedelta(days=87)).isoformat(),
            "category": "statutory",
            "priority": "critical",
        },
    ]

    return starting_cash, receivables, outflows
