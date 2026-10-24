"""
Predefined Synthetic Business Personas:
1. Apex Precision Components (Manufacturing SME)
2. PixelCraft Digital (Services / Consulting SME)
3. GreenGrocer Hub (B2B Distributor)
"""

from typing import Any, Dict

SYNTHETIC_PERSONAS: Dict[str, Dict[str, Any]] = {
    "manufacturing_sme": {
        "id": "biz_mfg_01",
        "legal_name": "Apex Precision Components Pvt Ltd",
        "trade_name": "Apex Precision",
        "industry": "Auto Ancillary Manufacturing",
        "msme_category": "Small",
        "opening_cash": 450000.0,
        "monthly_payroll": 180000.0,
        "monthly_rent": 65000.0,
        "is_synthetic": True,
    },
    "services_agency": {
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
    "b2b_retailer": {
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
}
