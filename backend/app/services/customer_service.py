"""
Customer & Shopkeeper Shared Ledger Service:
Implements the shared single source of truth for:
1. Customer shop-credit purchases, dues tracking, and demo repayments.
2. Shopkeeper receivables dashboard, QR generation, customer credit monitoring, and counter payment recording.
3. Multi-shop and multi-customer synthetic demo fixtures with verified integrity.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import uuid
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus
import qrcode
import qrcode.image.svg
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.core.errors import AppException, NotFoundException
from backend.app.db.models import (
    ActivityEventModel,
    CreditTransactionModel,
    CustomerModel,
    RepaymentModel,
    ShopModel,
)
from backend.app.schemas.customer import (
    ActivityEventOut,
    CreditTransactionCreate,
    CreditTransactionOut,
    CustomerDashboardSummary,
    CustomerDuesResponse,
    CustomerProfileOut,
    ReminderItemOut,
    RepaymentCreate,
    RepaymentOut,
    ShopOut,
    ShopProfileUpdate,
    ShopQrOut,
    ShopkeeperFinancialSummaryOut,
    ShopkeeperRepaymentCreate,
    ShopkeeperSummaryOut,
    ShopkeeperTransactionOut,
)


def generate_reference() -> str:
    """Generates a human-friendly unique transaction reference code."""
    token = uuid.uuid4().hex[:8].upper()
    return f"TXN-{token}"


class CustomerService:
    """Shared financial service connecting customer and shopkeeper records."""

    def ensure_system_metadata(self, db: Session) -> None:
        """
        Ensures baseline master shop and customer directory profiles exist
        without inserting ANY financial transactions, repayments, or activities.
        """
        shops_data = [
            {
                "id": "shop_apex_01",
                "shop_name": "Apex Precision Works",
                "shop_code": "KOSHA-APEX",
                "category": "Industrial Spares & Hardware",
                "owner_name": "Vikram Mehta",
                "phone": "+91 98220 11223",
                "upi_id": "apexworks@upi",
                "qr_payload": "upi://pay?pa=apexworks@upi&pn=Apex+Precision+Works&cu=INR&tn=KOSHA-APEX",
                "status": "active",
            },
            {
                "id": "shop_lakshmi_02",
                "shop_name": "Sri Lakshmi Provisions",
                "shop_code": "KOSHA-LAKSHMI",
                "category": "Grocery & Daily Provisions",
                "owner_name": "Lakshmi Narayanan",
                "phone": "+91 98440 22334",
                "upi_id": "lakshmiprovisions@upi",
                "qr_payload": "upi://pay?pa=lakshmiprovisions@upi&pn=Sri+Lakshmi+Provisions&cu=INR&tn=KOSHA-LAKSHMI",
                "status": "active",
            },
            {
                "id": "shop_city_03",
                "shop_name": "City Hardware & Tools",
                "shop_code": "KOSHA-CITY",
                "category": "Tools & Electrical Goods",
                "owner_name": "Rajesh Patil",
                "phone": "+91 98110 33445",
                "upi_id": "cityhardware@upi",
                "qr_payload": "upi://pay?pa=cityhardware@upi&pn=City+Hardware+%26+Tools&cu=INR&tn=KOSHA-CITY",
                "status": "active",
            },
        ]
        for s in shops_data:
            if not db.query(ShopModel).filter_by(id=s["id"]).first():
                db.add(
                    ShopModel(
                        id=s["id"],
                        shop_name=s["shop_name"],
                        shop_code=s["shop_code"],
                        category=s["category"],
                        owner_name=s["owner_name"],
                        phone=s["phone"],
                        upi_id=s["upi_id"],
                        qr_payload=s["qr_payload"],
                        is_verified=True,
                        status=s["status"],
                    )
                )

        customers_data = [
            {
                "id": "cust_rahul_01",
                "display_name": "Rahul Sharma",
                "phone": "+91 98765 43210",
                "email": "rahul.sharma@example.in",
            },
            {
                "id": "cust_priya_02",
                "display_name": "Priya Patel",
                "phone": "+91 98234 56789",
                "email": "priya.patel@example.in",
            },
            {
                "id": "cust_amit_03",
                "display_name": "Amit Kumar",
                "phone": "+91 98345 67890",
                "email": "amit.kumar@example.in",
            },
        ]
        for c in customers_data:
            if not db.query(CustomerModel).filter_by(id=c["id"]).first():
                db.add(
                    CustomerModel(
                        id=c["id"],
                        display_name=c["display_name"],
                        phone=c["phone"],
                        email=c["email"],
                    )
                )
        db.flush()

    def ensure_demo_seeds(self, db: Session) -> CustomerModel:
        """
        Seeds deterministic synthetic demo entities:
        - 3 Verified Shops (Apex, Lakshmi, City)
        - 3 Customers (Rahul, Priya, Amit)
        - Varied transactions: upcoming, due today, overdue, fully paid, multiple repayments
        """
        # 1. Seed 3 Shops
        shops_data = [
            {
                "id": "shop_apex_01",
                "shop_name": "Apex Precision Works",
                "shop_code": "KOSHA-APEX",
                "category": "Industrial Spares & Hardware",
                "owner_name": "Vikram Mehta",
                "phone": "+91 98220 11223",
                "upi_id": "apexworks@upi",
                "qr_payload": "upi://pay?pa=apexworks@upi&pn=Apex+Precision+Works&cu=INR&tn=KOSHA-APEX",
                "status": "active",
            },
            {
                "id": "shop_lakshmi_02",
                "shop_name": "Sri Lakshmi Provisions",
                "shop_code": "KOSHA-LAKSHMI",
                "category": "Grocery & Daily Provisions",
                "owner_name": "Lakshmi Narayanan",
                "phone": "+91 98440 22334",
                "upi_id": "lakshmiprovisions@upi",
                "qr_payload": "upi://pay?pa=lakshmiprovisions@upi&pn=Sri+Lakshmi+Provisions&cu=INR&tn=KOSHA-LAKSHMI",
                "status": "active",
            },
            {
                "id": "shop_city_03",
                "shop_name": "City Hardware & Tools",
                "shop_code": "KOSHA-CITY",
                "category": "Tools & Electrical Goods",
                "owner_name": "Rajesh Patil",
                "phone": "+91 98110 33445",
                "upi_id": "cityhardware@upi",
                "qr_payload": "upi://pay?pa=cityhardware@upi&pn=City+Hardware+%26+Tools&cu=INR&tn=KOSHA-CITY",
                "status": "active",
            },
        ]

        for s in shops_data:
            existing_shop = db.query(ShopModel).filter_by(id=s["id"]).first()
            if not existing_shop:
                db.add(
                    ShopModel(
                        id=s["id"],
                        shop_name=s["shop_name"],
                        shop_code=s["shop_code"],
                        category=s["category"],
                        owner_name=s["owner_name"],
                        phone=s["phone"],
                        upi_id=s["upi_id"],
                        qr_payload=s["qr_payload"],
                        is_verified=True,
                        status=s["status"],
                    )
                )
        db.flush()

        # 2. Seed 3 Customers
        customers_data = [
            {
                "id": "cust_rahul_01",
                "display_name": "Rahul Sharma",
                "phone": "+91 98765 43210",
                "email": "rahul.sharma@example.in",
            },
            {
                "id": "cust_priya_02",
                "display_name": "Priya Patel",
                "phone": "+91 98234 56789",
                "email": "priya.patel@example.in",
            },
            {
                "id": "cust_amit_03",
                "display_name": "Amit Kumar",
                "phone": "+91 98345 67890",
                "email": "amit.kumar@example.in",
            },
        ]

        primary_customer = None
        for c in customers_data:
            existing_cust = db.query(CustomerModel).filter_by(id=c["id"]).first()
            if not existing_cust:
                existing_cust = CustomerModel(
                    id=c["id"],
                    display_name=c["display_name"],
                    phone=c["phone"],
                    email=c["email"],
                )
                db.add(existing_cust)
            if c["id"] == "cust_rahul_01":
                primary_customer = existing_cust
        db.flush()

        # 3. Seed Realistic Transactions idempotently
        today = date.today()
        txns_spec = [
            (
                CreditTransactionModel(
                    id="ctx_demo_01",
                    reference="TXN-9482A101",
                    customer_id="cust_rahul_01",
                    shop_id="shop_lakshmi_02",
                    description="Monthly Grocery & Food Staples",
                    purchase_amount=Decimal("3200.00"),
                    initial_paid_amount=Decimal("1000.00"),
                    outstanding_amount=Decimal("2200.00"),
                    transaction_date=today - timedelta(days=10),
                    agreed_repayment_date=today + timedelta(days=5),
                    status="upcoming",
                ),
                [
                    RepaymentModel(
                        id="rep_demo_01",
                        transaction_id="ctx_demo_01",
                        amount=Decimal("1000.00"),
                        repayment_date=today - timedelta(days=10),
                        payment_method="initial_downpayment",
                        payment_status="completed",
                        recorded_by="customer",
                        provider_reference="DOWN-LAK-01",
                        notes="Initial payment at checkout",
                    )
                ],
                ActivityEventModel(
                    id="act_demo_01",
                    customer_id="cust_rahul_01",
                    transaction_id="ctx_demo_01",
                    event_type="purchase_recorded",
                    title="Purchase Recorded",
                    description="Bought Monthly Grocery at Sri Lakshmi Provisions for ₹3,200 (Paid ₹1,000)",
                    amount=Decimal("3200.00"),
                    created_at=datetime.now(timezone.utc) - timedelta(days=10),
                ),
            ),
            (
                CreditTransactionModel(
                    id="ctx_demo_02",
                    reference="TXN-3819B202",
                    customer_id="cust_rahul_01",
                    shop_id="shop_city_03",
                    description="Hardware Fittings & Cables",
                    purchase_amount=Decimal("1850.00"),
                    initial_paid_amount=Decimal("500.00"),
                    outstanding_amount=Decimal("1350.00"),
                    transaction_date=today - timedelta(days=15),
                    agreed_repayment_date=today - timedelta(days=2),
                    status="overdue",
                ),
                [
                    RepaymentModel(
                        id="rep_demo_02",
                        transaction_id="ctx_demo_02",
                        amount=Decimal("500.00"),
                        repayment_date=today - timedelta(days=15),
                        payment_method="initial_downpayment",
                        payment_status="completed",
                        recorded_by="customer",
                        provider_reference="DOWN-CITY-01",
                        notes="Initial payment at checkout",
                    )
                ],
                ActivityEventModel(
                    id="act_demo_02",
                    customer_id="cust_rahul_01",
                    transaction_id="ctx_demo_02",
                    event_type="purchase_recorded",
                    title="Purchase Recorded",
                    description="Bought Hardware Fittings at City Hardware & Tools for ₹1,850 (Paid ₹500)",
                    amount=Decimal("1850.00"),
                    created_at=datetime.now(timezone.utc) - timedelta(days=15),
                ),
            ),
            (
                CreditTransactionModel(
                    id="ctx_demo_03",
                    reference="TXN-7193C303",
                    customer_id="cust_rahul_01",
                    shop_id="shop_apex_01",
                    description="Precision Fasteners & Safety Gloves",
                    purchase_amount=Decimal("950.00"),
                    initial_paid_amount=Decimal("500.00"),
                    outstanding_amount=Decimal("0.00"),
                    transaction_date=today - timedelta(days=7),
                    agreed_repayment_date=today - timedelta(days=3),
                    status="paid",
                ),
                [
                    RepaymentModel(
                        id="rep_demo_03_down",
                        transaction_id="ctx_demo_03",
                        amount=Decimal("500.00"),
                        repayment_date=today - timedelta(days=7),
                        payment_method="initial_downpayment",
                        payment_status="completed",
                        recorded_by="customer",
                        provider_reference="DOWN-APEX-01",
                        notes="Initial payment at counter",
                    ),
                    RepaymentModel(
                        id="rep_demo_03_clear",
                        transaction_id="ctx_demo_03",
                        amount=Decimal("450.00"),
                        repayment_date=today,
                        payment_method="demo_upi",
                        payment_status="completed",
                        recorded_by="customer",
                        provider_reference="DEMO-UPI-9941",
                        notes="Cleared full remaining balance",
                    ),
                ],
                ActivityEventModel(
                    id="act_demo_03",
                    customer_id="cust_rahul_01",
                    transaction_id="ctx_demo_03",
                    event_type="repayment_completed",
                    title="Repayment Completed",
                    description="Cleared full balance of ₹450 at Apex Precision Works",
                    amount=Decimal("450.00"),
                    created_at=datetime.now(timezone.utc),
                ),
            ),
            (
                CreditTransactionModel(
                    id="ctx_demo_04",
                    reference="TXN-5521D404",
                    customer_id="cust_priya_02",
                    shop_id="shop_apex_01",
                    description="Industrial Tooling Bits & Milling Cutters",
                    purchase_amount=Decimal("2400.00"),
                    initial_paid_amount=Decimal("400.00"),
                    outstanding_amount=Decimal("2000.00"),
                    transaction_date=today - timedelta(days=14),
                    agreed_repayment_date=today - timedelta(days=4),
                    status="overdue",
                ),
                [
                    RepaymentModel(
                        id="rep_demo_04",
                        transaction_id="ctx_demo_04",
                        amount=Decimal("400.00"),
                        repayment_date=today - timedelta(days=14),
                        payment_method="initial_downpayment",
                        payment_status="completed",
                        recorded_by="customer",
                        provider_reference="DOWN-APEX-02",
                        notes="Initial downpayment",
                    )
                ],
                ActivityEventModel(
                    id="act_demo_04",
                    customer_id="cust_priya_02",
                    transaction_id="ctx_demo_04",
                    event_type="purchase_recorded",
                    title="Purchase Recorded",
                    description="Bought Industrial Tooling Bits for ₹2,400 (Paid ₹400)",
                    amount=Decimal("2400.00"),
                    created_at=datetime.now(timezone.utc) - timedelta(days=14),
                ),
            ),
            (
                CreditTransactionModel(
                    id="ctx_demo_05",
                    reference="TXN-8812E505",
                    customer_id="cust_amit_03",
                    shop_id="shop_apex_01",
                    description="High-Tensile Bolts & Gaskets",
                    purchase_amount=Decimal("1500.00"),
                    initial_paid_amount=Decimal("500.00"),
                    outstanding_amount=Decimal("1000.00"),
                    transaction_date=today - timedelta(days=5),
                    agreed_repayment_date=today,
                    status="due_today",
                ),
                [
                    RepaymentModel(
                        id="rep_demo_05",
                        transaction_id="ctx_demo_05",
                        amount=Decimal("500.00"),
                        repayment_date=today - timedelta(days=5),
                        payment_method="initial_downpayment",
                        payment_status="completed",
                        recorded_by="customer",
                        provider_reference="DOWN-APEX-03",
                        notes="Initial downpayment",
                    )
                ],
                ActivityEventModel(
                    id="act_demo_05",
                    customer_id="cust_amit_03",
                    transaction_id="ctx_demo_05",
                    event_type="purchase_recorded",
                    title="Purchase Recorded",
                    description="Bought High-Tensile Bolts for ₹1,500 (Paid ₹500)",
                    amount=Decimal("1500.00"),
                    created_at=datetime.now(timezone.utc) - timedelta(days=5),
                ),
            ),
            (
                CreditTransactionModel(
                    id="ctx_demo_06",
                    reference="TXN-1194F606",
                    customer_id="cust_priya_02",
                    shop_id="shop_lakshmi_02",
                    description="Organic Pulses & Cooking Oil",
                    purchase_amount=Decimal("1250.00"),
                    initial_paid_amount=Decimal("250.00"),
                    outstanding_amount=Decimal("1000.00"),
                    transaction_date=today - timedelta(days=4),
                    agreed_repayment_date=today + timedelta(days=3),
                    status="upcoming",
                ),
                [
                    RepaymentModel(
                        id="rep_demo_06",
                        transaction_id="ctx_demo_06",
                        amount=Decimal("250.00"),
                        repayment_date=today - timedelta(days=4),
                        payment_method="initial_downpayment",
                        payment_status="completed",
                        recorded_by="customer",
                        provider_reference="DOWN-LAK-02",
                        notes="Initial downpayment",
                    )
                ],
                ActivityEventModel(
                    id="act_demo_06",
                    customer_id="cust_priya_02",
                    transaction_id="ctx_demo_06",
                    event_type="purchase_recorded",
                    title="Purchase Recorded",
                    description="Bought Organic Pulses for ₹1,250 (Paid ₹250)",
                    amount=Decimal("1250.00"),
                    created_at=datetime.now(timezone.utc) - timedelta(days=4),
                ),
            ),
        ]

        for txn_item, reps, act_item in txns_spec:
            existing_txn = db.query(CreditTransactionModel).filter_by(id=txn_item.id).first()
            if not existing_txn:
                db.add(txn_item)
                db.flush()
                for r in reps:
                    db.add(r)
                db.add(act_item)
        db.commit()

        return primary_customer or db.query(CustomerModel).filter_by(id="cust_rahul_01").first()

    def _sync_transaction_status(self, txn: CreditTransactionModel) -> str:
        """Derives transaction status dynamically based on current date and outstanding amount."""
        if txn.outstanding_amount <= Decimal("0.00"):
            return "paid"
        today = date.today()
        if txn.agreed_repayment_date < today:
            return "overdue"
        elif txn.agreed_repayment_date == today:
            return "due_today"
        else:
            return "upcoming"

    def _serialize_transaction(self, txn: CreditTransactionModel) -> CreditTransactionOut:
        """Converts ORM transaction into typed schema with live calculated status."""
        current_status = self._sync_transaction_status(txn)
        if txn.status != current_status:
            txn.status = current_status

        repayments = [
            RepaymentOut(
                id=r.id,
                transaction_id=r.transaction_id,
                amount=float(r.amount),
                repayment_date=r.repayment_date,
                payment_method=r.payment_method,
                payment_status=r.payment_status,
                recorded_by=getattr(r, "recorded_by", "customer") or "customer",
                provider_reference=r.provider_reference,
                notes=r.notes,
                created_at=r.created_at,
            )
            for r in (txn.repayments or [])
        ]

        return CreditTransactionOut(
            id=txn.id,
            reference=txn.reference,
            customer_id=txn.customer_id,
            shop_id=txn.shop_id,
            shop_name=txn.shop.shop_name if txn.shop else "Shop",
            shop_code=txn.shop.shop_code if txn.shop else "",
            description=txn.description,
            purchase_amount=float(txn.purchase_amount),
            initial_paid_amount=float(txn.initial_paid_amount),
            outstanding_amount=float(txn.outstanding_amount),
            transaction_date=txn.transaction_date,
            agreed_repayment_date=txn.agreed_repayment_date,
            status=current_status,
            created_at=txn.created_at,
            repayments=repayments,
        )

    # =========================================================================
    # Customer APIs
    # =========================================================================

    def get_dashboard(self, customer_id: str, db: Session) -> CustomerDashboardSummary:
        """Aggregates realistic KPI totals, upcoming commitments, and recent activity."""
        self.ensure_system_metadata(db)
        customer = db.query(CustomerModel).filter_by(id=customer_id).first()
        if not customer:
            raise NotFoundException(f"Customer '{customer_id}' not found.")

        txns = db.query(CreditTransactionModel).filter_by(customer_id=customer.id).all()

        today = date.today()
        seven_days_later = today + timedelta(days=7)

        total_outstanding = Decimal("0.00")
        due_within_7_days = Decimal("0.00")
        overdue_amount = Decimal("0.00")
        active_shop_ids = set()

        reminders: List[ReminderItemOut] = []
        serialized_txns: List[CreditTransactionOut] = []

        for t in txns:
            status = self._sync_transaction_status(t)
            t.status = status
            stxn = self._serialize_transaction(t)
            serialized_txns.append(stxn)

            if t.outstanding_amount > 0:
                total_outstanding += t.outstanding_amount
                active_shop_ids.add(t.shop_id)
                days_diff = (t.agreed_repayment_date - today).days

                if status == "overdue":
                    overdue_amount += t.outstanding_amount
                    days_overdue = abs(days_diff)
                    reminders.append(
                        ReminderItemOut(
                            transaction_id=t.id,
                            reference=t.reference,
                            shop_name=stxn.shop_name,
                            shop_code=stxn.shop_code,
                            amount=float(t.outstanding_amount),
                            due_date=t.agreed_repayment_date,
                            days_diff=days_diff,
                            urgency="overdue",
                            message=f"₹{t.outstanding_amount:,.2f} at {stxn.shop_name} was due {days_overdue} day(s) ago ({t.agreed_repayment_date.strftime('%d %b %Y')}).",
                        )
                    )
                elif status == "due_today":
                    due_within_7_days += t.outstanding_amount
                    reminders.append(
                        ReminderItemOut(
                            transaction_id=t.id,
                            reference=t.reference,
                            shop_name=stxn.shop_name,
                            shop_code=stxn.shop_code,
                            amount=float(t.outstanding_amount),
                            due_date=t.agreed_repayment_date,
                            days_diff=0,
                            urgency="due_today",
                            message=f"₹{t.outstanding_amount:,.2f} at {stxn.shop_name} is due today.",
                        )
                    )
                elif today < t.agreed_repayment_date <= seven_days_later:
                    due_within_7_days += t.outstanding_amount
                    reminders.append(
                        ReminderItemOut(
                            transaction_id=t.id,
                            reference=t.reference,
                            shop_name=stxn.shop_name,
                            shop_code=stxn.shop_code,
                            amount=float(t.outstanding_amount),
                            due_date=t.agreed_repayment_date,
                            days_diff=days_diff,
                            urgency="approaching" if days_diff <= 3 else "upcoming",
                            message=f"₹{t.outstanding_amount:,.2f} at {stxn.shop_name} coming up in {days_diff} day(s) ({t.agreed_repayment_date.strftime('%d %b %Y')}).",
                        )
                    )

        if overdue_amount > 0:
            status_message = f"You have ₹{overdue_amount:,.2f} past its agreed repayment date. Review your dues to see the affected transactions."
        elif total_outstanding > 0:
            status_message = f"You have ₹{total_outstanding:,.2f} in shop credit across {len(active_shop_ids)} shop(s)."
        else:
            status_message = "You're all caught up. You have no outstanding shop dues."

        upcoming = [t for t in serialized_txns if t.status != "paid"]
        upcoming.sort(key=lambda x: x.agreed_repayment_date)

        acts = (
            db.query(ActivityEventModel)
            .filter_by(customer_id=customer.id)
            .order_by(ActivityEventModel.created_at.desc())
            .limit(10)
            .all()
        )
        recent_activity = [ActivityEventOut.model_validate(a) for a in acts]

        total_purchase_amount = sum((t.purchase_amount for t in txns), Decimal("0.00"))
        total_initial_paid = sum((t.initial_paid_amount for t in txns), Decimal("0.00"))
        total_verified_online = Decimal("0.00")
        for t in txns:
            for r in (t.repayments or []):
                if r.payment_status == "completed" and r.payment_method in ("razorpay_upi", "upi", "initial_downpayment", "demo_upi"):
                    total_verified_online += Decimal(str(r.amount))
        total_paid_amount = total_initial_paid + total_verified_online
        active_bills_count = sum(1 for t in txns if t.outstanding_amount > 0)
        settled_bills_count = sum(1 for t in txns if t.outstanding_amount == 0)

        return CustomerDashboardSummary(
            customer=CustomerProfileOut.model_validate(customer),
            total_outstanding=float(total_outstanding),
            due_within_7_days=float(due_within_7_days),
            overdue_amount=float(overdue_amount),
            shops_count=len(active_shop_ids),
            status_message=status_message,
            upcoming_repayments=upcoming,
            recent_activity=recent_activity,
            reminders=reminders,
            total_purchase_amount=float(total_purchase_amount),
            total_initial_paid=float(total_initial_paid),
            total_verified_online_paid=float(total_verified_online),
            total_paid_amount=float(total_paid_amount),
            active_bills_count=active_bills_count,
            settled_bills_count=settled_bills_count,
        )

    def get_dues(
        self, customer_id: str, filter_status: Optional[str], db: Session
    ) -> CustomerDuesResponse:
        """Returns customer transactions filtered by status with ledger totals."""
        self.ensure_system_metadata(db)
        customer = db.query(CustomerModel).filter_by(id=customer_id).first()
        if not customer:
            raise NotFoundException(f"Customer '{customer_id}' not found.")

        txns = db.query(CreditTransactionModel).filter_by(customer_id=customer.id).all()

        total_outstanding = Decimal("0.00")
        overdue_amount = Decimal("0.00")
        due_today_amount = Decimal("0.00")
        upcoming_amount = Decimal("0.00")
        paid_amount = Decimal("0.00")

        all_serialized: List[CreditTransactionOut] = []

        for t in txns:
            status = self._sync_transaction_status(t)
            t.status = status
            stxn = self._serialize_transaction(t)
            all_serialized.append(stxn)

            if status == "paid":
                paid_amount += t.purchase_amount
            elif status == "overdue":
                overdue_amount += t.outstanding_amount
                total_outstanding += t.outstanding_amount
            elif status == "due_today":
                due_today_amount += t.outstanding_amount
                total_outstanding += t.outstanding_amount
            elif status == "upcoming":
                upcoming_amount += t.outstanding_amount
                total_outstanding += t.outstanding_amount

        if filter_status and filter_status.lower() != "all":
            fs = filter_status.lower()
            if fs == "outstanding":
                filtered = [t for t in all_serialized if t.outstanding_amount > 0]
            elif fs == "partially_paid":
                filtered = [
                    t for t in all_serialized
                    if t.outstanding_amount > 0 and (t.purchase_amount - t.outstanding_amount) > 0
                ]
            elif fs == "awaiting_payment":
                filtered = [
                    t for t in all_serialized
                    if t.outstanding_amount > 0 and (t.purchase_amount - t.outstanding_amount) == 0
                ]
            else:
                filtered = [t for t in all_serialized if t.status.lower() == fs]
        else:
            filtered = all_serialized

        def sort_priority(item: CreditTransactionOut):
            if item.status == "overdue":
                return (0, item.agreed_repayment_date)
            elif item.status == "due_today":
                return (1, item.agreed_repayment_date)
            elif item.status == "upcoming":
                return (2, item.agreed_repayment_date)
            else:
                return (3, item.agreed_repayment_date)

        filtered.sort(key=sort_priority)

        total_purchase_amount = sum((t.purchase_amount for t in txns), Decimal("0.00"))
        total_initial_paid = sum((t.initial_paid_amount for t in txns), Decimal("0.00"))
        total_verified_online = Decimal("0.00")
        for t in txns:
            for r in (t.repayments or []):
                if r.payment_status == "completed" and r.payment_method in ("razorpay_upi", "upi", "initial_downpayment", "demo_upi"):
                    total_verified_online += Decimal(str(r.amount))

        return CustomerDuesResponse(
            total_outstanding=float(total_outstanding),
            overdue_amount=float(overdue_amount),
            due_today_amount=float(due_today_amount),
            upcoming_amount=float(upcoming_amount),
            paid_amount=float(paid_amount),
            transactions=filtered,
            total_purchase_amount=float(total_purchase_amount),
            total_initial_paid=float(total_initial_paid),
            total_verified_online_paid=float(total_verified_online),
        )

    def get_transaction(
        self, transaction_id: str, customer_id: str, db: Session
    ) -> CreditTransactionOut:
        """Fetches a single transaction ensuring customer privacy."""
        self.ensure_system_metadata(db)
        txn = (
            db.query(CreditTransactionModel)
            .filter_by(id=transaction_id, customer_id=customer_id)
            .first()
        )
        if not txn:
            raise NotFoundException(f"Transaction '{transaction_id}' not found.")
        return self._serialize_transaction(txn)

    def get_reminders(self, customer_id: str, db: Session) -> List[ReminderItemOut]:
        """Returns sorted, actionable repayment reminders for a customer."""
        dash = self.get_dashboard(customer_id=customer_id, db=db)
        # Sort: Overdue first (most overdue first), then due today, then nearest upcoming
        def reminder_urgency_score(r: ReminderItemOut):
            if r.urgency == "overdue":
                return (0, r.days_diff)  # e.g. -5 comes before -2
            elif r.urgency == "due_today":
                return (1, 0)
            elif r.urgency == "approaching":
                return (2, r.days_diff)
            else:
                return (3, r.days_diff)

        reminders = sorted(dash.reminders, key=reminder_urgency_score)
        return reminders

    def create_credit_transaction(
        self, customer_id: str, data: CreditTransactionCreate, db: Session
    ) -> CreditTransactionOut:
        """
        Records a new shop credit purchase.
        Enforces decimal calculations: remaining = purchase_amount - initial_paid_now.
        Validates shop existence and constraints.
        """
        self.ensure_system_metadata(db)
        customer = db.query(CustomerModel).filter_by(id=customer_id).first()
        if not customer:
            raise NotFoundException(f"Customer '{customer_id}' not found.")

        # 1. Resolve shop by shop_code
        if data.idempotency_key:
            existing_txn = (
                db.query(CreditTransactionModel)
                .filter_by(idempotency_key=data.idempotency_key)
                .first()
            )
            if existing_txn:
                return self._serialize_transaction(existing_txn)

        clean_shop_code = data.shop_code.strip()
        shop = (
            db.query(ShopModel)
            .filter(ShopModel.shop_code.ilike(clean_shop_code))
            .first()
        )
        if not shop:
            shop = (
                db.query(ShopModel)
                .filter(
                    or_(
                        ShopModel.id == clean_shop_code,
                        ShopModel.upi_id.ilike(clean_shop_code),
                        ShopModel.shop_name.ilike(clean_shop_code),
                    )
                )
                .first()
            )
        if not shop:
            raise AppException(
                status_code=404,
                message=f"Shop code '{data.shop_code}' not recognized. Please verify the code or scan a participating KOSHA QR code.",
                code="SHOP_NOT_FOUND",
            )

        if getattr(shop, "status", "active") == "inactive":
            raise AppException(
                status_code=400,
                message=f"Shop '{shop.shop_name}' is currently inactive and cannot accept credit purchases.",
                code="SHOP_INACTIVE",
            )

        # 2. Financial validation
        if data.purchase_amount <= Decimal("0.00"):
            raise AppException(
                status_code=422,
                message="Purchase amount must be greater than zero.",
                code="INVALID_PURCHASE_AMOUNT",
            )

        if data.amount_paid_now < Decimal("0.00"):
            raise AppException(
                status_code=422,
                message="Amount paid now cannot be negative.",
                code="INVALID_PAID_AMOUNT",
            )

        if data.amount_paid_now > data.purchase_amount:
            raise AppException(
                status_code=422,
                message=f"Amount paid now (₹{data.amount_paid_now}) cannot exceed the total purchase value (₹{data.purchase_amount}).",
                code="PAID_EXCEEDS_PURCHASE",
            )

        today = date.today()
        remaining_due = (data.purchase_amount - data.amount_paid_now).quantize(Decimal("0.01"))

        if remaining_due > 0 and data.agreed_repayment_date < today:
            raise AppException(
                status_code=422,
                message="Agreed repayment date cannot be in the past.",
                code="INVALID_REPAYMENT_DATE",
            )

        if remaining_due == 0:
            status = "paid"
        elif data.agreed_repayment_date == today:
            status = "due_today"
        else:
            status = "upcoming"

        # 3. Create persistent record
        reference = generate_reference()
        txn = CreditTransactionModel(
            id=str(uuid.uuid4()),
            reference=reference,
            customer_id=customer.id,
            shop_id=shop.id,
            description=data.description.strip(),
            purchase_amount=data.purchase_amount,
            initial_paid_amount=data.amount_paid_now,
            outstanding_amount=remaining_due,
            transaction_date=today,
            agreed_repayment_date=data.agreed_repayment_date,
            status=status,
            idempotency_key=data.idempotency_key,
        )
        db.add(txn)
        db.flush()

        if data.amount_paid_now > 0:
            method = getattr(data, "payment_method", None) or "upi"
            pref = getattr(data, "payment_reference", None) or f"UPI-{uuid.uuid4().hex[:8].upper()}"
            rep = RepaymentModel(
                transaction_id=txn.id,
                amount=data.amount_paid_now,
                repayment_date=today,
                payment_method=method,
                payment_status="completed",
                recorded_by="customer",
                provider_reference=pref,
                notes=f"Initial downpayment via {method.upper()}",
            )
            db.add(rep)

        if remaining_due > 0:
            act_title = "Shop Credit Recorded"
            act_desc = f"Recorded purchase of {data.description} at {shop.shop_name} for ₹{data.purchase_amount:,.2f}. Paid ₹{data.amount_paid_now:,.2f}, balance ₹{remaining_due:,.2f} due on {data.agreed_repayment_date.strftime('%d %b %Y')}."
        else:
            act_title = "Purchase Paid in Full"
            act_desc = f"Purchased {data.description} at {shop.shop_name} for ₹{data.purchase_amount:,.2f} (Cleared at checkout)."

        act = ActivityEventModel(
            customer_id=customer.id,
            transaction_id=txn.id,
            event_type="purchase_recorded",
            title=act_title,
            description=act_desc,
            amount=data.purchase_amount,
        )
        db.add(act)
        db.commit()
        db.refresh(txn)

        try:
            from backend.app.core.events import event_broadcaster
            event_broadcaster.publish("bill_created", {
                "bill_id": txn.id,
                "customer_id": txn.customer_id,
                "shop_id": txn.shop_id,
                "reference": txn.reference,
                "purchase_amount": float(data.purchase_amount),
                "outstanding_amount": float(txn.outstanding_amount),
            })
        except Exception:
            pass

        return self._serialize_transaction(txn)

    def record_repayment(
        self, transaction_id: str, customer_id: str, data: RepaymentCreate, db: Session
    ) -> CreditTransactionOut:
        """
        Records an auditable repayment towards an outstanding credit balance.
        Recalculates server-side balance atomically.
        """
        self.ensure_system_metadata(db)

        if data.idempotency_key:
            existing_rep = (
                db.query(RepaymentModel)
                .filter_by(idempotency_key=data.idempotency_key)
                .first()
            )
            if existing_rep:
                return self._serialize_transaction(existing_rep.transaction)

        txn = (
            db.query(CreditTransactionModel)
            .filter_by(id=transaction_id, customer_id=customer_id)
            .first()
        )
        if not txn:
            raise NotFoundException(f"Credit transaction '{transaction_id}' not found.")

        if txn.status == "paid" or txn.outstanding_amount <= Decimal("0.00"):
            raise AppException(
                status_code=400,
                message="This transaction is already fully paid. No additional repayments can be recorded.",
                code="TRANSACTION_ALREADY_PAID",
            )

        if data.amount <= Decimal("0.00"):
            raise AppException(
                status_code=422,
                message="Repayment amount must be greater than zero.",
                code="INVALID_REPAYMENT_AMOUNT",
            )

        if data.amount > txn.outstanding_amount:
            raise AppException(
                status_code=422,
                message=f"Repayment amount (₹{data.amount:,.2f}) cannot exceed current outstanding balance (₹{txn.outstanding_amount:,.2f}).",
                code="OVERPAYMENT_NOT_ALLOWED",
            )

        today = date.today()
        repayment = RepaymentModel(
            id=str(uuid.uuid4()),
            transaction_id=txn.id,
            amount=data.amount,
            repayment_date=today,
            payment_method=data.payment_method or "demo_upi",
            payment_status="completed",
            recorded_by="customer",
            provider_reference=f"DEMO-UPI-{uuid.uuid4().hex[:8].upper()}",
            notes=data.notes,
            idempotency_key=data.idempotency_key,
        )
        db.add(repayment)
        db.flush()

        txn.outstanding_amount = (txn.outstanding_amount - data.amount).quantize(Decimal("0.01"))
        if txn.outstanding_amount <= Decimal("0.00"):
            txn.outstanding_amount = Decimal("0.00")
            txn.status = "paid"
            act_title = "Repayment Completed"
            act_desc = f"Cleared full remaining balance of ₹{data.amount:,.2f} for {txn.description} at {txn.shop.shop_name}."
        else:
            txn.status = self._sync_transaction_status(txn)
            act_title = "Partial Repayment Recorded"
            act_desc = f"Paid ₹{data.amount:,.2f} towards {txn.description} at {txn.shop.shop_name}. Remaining due: ₹{txn.outstanding_amount:,.2f}."

        act = ActivityEventModel(
            customer_id=customer_id,
            transaction_id=txn.id,
            event_type="repayment_completed" if txn.status == "paid" else "partial_payment",
            title=act_title,
            description=act_desc,
            amount=data.amount,
        )
        db.add(act)
        db.commit()
        db.refresh(txn)

        try:
            from backend.app.core.events import event_broadcaster
            event_broadcaster.publish("repayment_recorded", {
                "bill_id": txn.id,
                "customer_id": txn.customer_id,
                "shop_id": txn.shop_id,
                "reference": txn.reference,
                "repayment_amount": float(data.amount),
                "outstanding_amount": float(txn.outstanding_amount),
            })
        except Exception:
            pass

        return self._serialize_transaction(txn)

    def list_shops(self, db: Session) -> List[ShopOut]:
        """Lists all participating verified shops."""
        self.ensure_system_metadata(db)
        shops = db.query(ShopModel).filter_by(is_verified=True).all()
        return [ShopOut.model_validate(s) for s in shops]

    def get_shop_by_code(self, shop_code: str, db: Session) -> ShopOut:
        """Resolves a shop by code, VPA, name, or auto-registers a scanned merchant."""
        self.ensure_system_metadata(db)
        clean = shop_code.strip()

        # 1. Exact or case-insensitive shop_code match
        shop = db.query(ShopModel).filter(ShopModel.shop_code.ilike(clean)).first()
        if shop:
            return ShopOut.model_validate(shop)

        # 2. Extract KOSHA- or KSH- pattern if present inside the string
        import re
        code_match = re.search(r'(KOSHA-[A-Za-z0-9_-]+|KSH-[A-Za-z0-9_-]+)', clean, re.IGNORECASE)
        if code_match:
            sub_code = code_match.group(1).upper()
            shop = db.query(ShopModel).filter(ShopModel.shop_code.ilike(sub_code)).first()
            if shop:
                return ShopOut.model_validate(shop)

        # 3. Match by shop ID
        shop = db.query(ShopModel).filter(ShopModel.id == clean).first()
        if shop:
            return ShopOut.model_validate(shop)

        # 4. Match by UPI ID / VPA
        shop = db.query(ShopModel).filter(ShopModel.upi_id.ilike(clean)).first()
        if shop:
            return ShopOut.model_validate(shop)

        # 5. Match by Shop Name (exact or substring)
        shop = db.query(ShopModel).filter(ShopModel.shop_name.ilike(clean)).first()
        if shop:
            return ShopOut.model_validate(shop)

        shop = db.query(ShopModel).filter(ShopModel.shop_name.ilike(f"%{clean}%")).first()
        if shop:
            return ShopOut.model_validate(shop)

        # 6. Auto-register scanned merchant so the customer can pay immediately!
        clean_name = clean.replace("_", " ").replace("-", " ").strip()
        code_slug = "KSH-" + uuid.uuid4().hex[:6].upper()
        merchant_upi = clean if "@" in clean else f"{code_slug.lower()}@upi"
        new_shop = ShopModel(
            id=str(uuid.uuid4()),
            shop_name=clean_name.title() if len(clean_name) <= 60 else clean_name[:60],
            shop_code=code_slug,
            category="Retail & Counter Merchant",
            owner_name="Verified Counter Merchant",
            phone=None,
            upi_id=merchant_upi,
            qr_payload=f"upi://pay?pa={merchant_upi}&pn={quote_plus(clean_name)}&cu=INR&tn={code_slug}",
            is_verified=True,
            status="active",
        )
        db.add(new_shop)
        db.commit()
        db.refresh(new_shop)
        return ShopOut.model_validate(new_shop)

    def get_activity(
        self, customer_id: str, limit: int, db: Session
    ) -> List[ActivityEventOut]:
        """Fetches customer activity events."""
        self.ensure_system_metadata(db)
        customer = db.query(CustomerModel).filter_by(id=customer_id).first()
        if not customer:
            raise NotFoundException(f"Customer '{customer_id}' not found.")
        acts = (
            db.query(ActivityEventModel)
            .filter_by(customer_id=customer.id)
            .order_by(ActivityEventModel.created_at.desc())
            .limit(limit)
            .all()
        )
        return [ActivityEventOut.model_validate(a) for a in acts]

    def get_shop_qr(self, shop_code: str, db: Session) -> ShopQrOut:
        """Generates real SVG QR code and instructions for a shop in standard NPCI UPI format."""
        shop = self.get_shop_by_code(shop_code=shop_code, db=db)
        merchant_vpa = (shop.upi_id if shop and shop.upi_id else None) or "kosha.merchant@razorpay"
        payload = f"upi://pay?pa={merchant_vpa}&pn={quote_plus(shop.shop_name)}&cu=INR&tn={quote_plus(shop.shop_code)}"
        
        # Generate SVG QR image in memory
        img = qrcode.make(payload, image_factory=qrcode.image.svg.SvgPathImage)
        qr_svg = img.to_string().decode("utf-8")

        return ShopQrOut(
            shop_code=shop.shop_code,
            shop_name=shop.shop_name,
            qr_payload=payload,
            qr_svg=qr_svg,
            instructions=f"Scan this QR code with any UPI app (GPay, PhonePe, Paytm) or KOSHA to record purchases and credit bills for {shop.shop_name}.",
        )

    # =========================================================================
    # Shopkeeper APIs
    # =========================================================================

    def _resolve_shop(self, shop_id_or_code: Optional[str], db: Session) -> ShopModel:
        """Helper to find shop by ID or code."""
        self.ensure_system_metadata(db)
        if not shop_id_or_code or not shop_id_or_code.strip():
            shop = db.query(ShopModel).filter_by(id="shop_apex_01").first()
            if not shop:
                raise NotFoundException("Default shop not found.")
            return shop

        clean = shop_id_or_code.strip()
        shop = (
            db.query(ShopModel)
            .filter(or_(ShopModel.id == clean, ShopModel.shop_code.ilike(clean)))
            .first()
        )
        if not shop:
            raise NotFoundException(f"Shop '{shop_id_or_code}' not found.")
        return shop

    def get_shopkeeper_shop(self, shop_id_or_code: Optional[str], db: Session) -> ShopOut:
        """Returns the active shopkeeper's shop details."""
        shop = self._resolve_shop(shop_id_or_code or "shop_apex_01", db)
        return ShopOut.model_validate(shop)

    def update_shop_profile(self, shop_id_or_code: str, data: ShopProfileUpdate, db: Session) -> ShopOut:
        """Updates shop details, including real UPI ID for receiving payments via GPay/PhonePe/Paytm."""
        shop = self._resolve_shop(shop_id_or_code, db)
        if data.upi_id is not None:
            clean_upi = data.upi_id.strip()
            shop.upi_id = clean_upi
            shop.qr_payload = f"upi://pay?pa={clean_upi}&pn={quote_plus(shop.shop_name)}&cu=INR&tn={quote_plus(shop.shop_code)}"
        if data.phone is not None:
            shop.phone = data.phone.strip()
        if data.shop_name is not None and data.shop_name.strip():
            shop.shop_name = data.shop_name.strip()
            if shop.upi_id:
                shop.qr_payload = f"upi://pay?pa={shop.upi_id}&pn={quote_plus(shop.shop_name)}&cu=INR&tn={quote_plus(shop.shop_code)}"
        db.add(shop)
        db.commit()
        db.refresh(shop)
        return ShopOut.model_validate(shop)

    def get_shopkeeper_summary(
        self, shop_id_or_code: str, db: Session
    ) -> ShopkeeperSummaryOut:
        """
        Calculates live summary cards for the shopkeeper dashboard:
        - Total customer receivables
        - Amount collected today
        - Amount due in next 7 days
        - Overdue receivables
        - Count of customers with balance
        - Total transactions count
        """
        shop = self._resolve_shop(shop_id_or_code, db)
        txns = db.query(CreditTransactionModel).filter_by(shop_id=shop.id).all()

        today = date.today()
        seven_days_later = today + timedelta(days=7)

        total_receivables = Decimal("0.00")
        collected_today = Decimal("0.00")
        due_in_7_days = Decimal("0.00")
        overdue_receivables = Decimal("0.00")
        debtor_customers = set()

        for t in txns:
            status = self._sync_transaction_status(t)
            t.status = status

            if t.outstanding_amount > 0:
                total_receivables += t.outstanding_amount
                debtor_customers.add(t.customer_id)

                if status == "overdue":
                    overdue_receivables += t.outstanding_amount
                elif status == "due_today" or (today <= t.agreed_repayment_date <= seven_days_later):
                    due_in_7_days += t.outstanding_amount

            # Check payments collected today
            for r in (t.repayments or []):
                if r.repayment_date == today and r.payment_status == "completed":
                    collected_today += r.amount

        total_billed = sum((t.purchase_amount for t in txns), Decimal("0.00"))
        total_cash = sum((t.initial_paid_amount for t in txns), Decimal("0.00"))
        total_online = Decimal("0.00")
        for t in txns:
            for r in (t.repayments or []):
                if r.payment_status == "completed" and r.payment_method in ("razorpay_upi", "upi"):
                    total_online += Decimal(str(r.amount))
        settled_txns = sum(1 for t in txns if t.outstanding_amount == 0)
        active_txns = sum(1 for t in txns if t.outstanding_amount > 0)

        return ShopkeeperSummaryOut(
            shop=ShopOut.model_validate(shop),
            total_customer_receivables=float(total_receivables),
            collected_today=float(collected_today),
            due_in_7_days=float(due_in_7_days),
            overdue_receivables=float(overdue_receivables),
            customers_with_balance_count=len(debtor_customers),
            total_transactions_count=len(txns),
            total_billed_amount=float(total_billed),
            total_cash_collected=float(total_cash),
            total_online_verified=float(total_online),
            settled_transactions_count=settled_txns,
            active_transactions_count=active_txns,
        )

    def get_financial_summary(
        self, shop_id_or_code: str, db: Session
    ) -> ShopkeeperFinancialSummaryOut:
        """
        Authoritative backend calculation of all financial metrics for the shopkeeper dashboard.
        Guarantees integer paise / Decimal precision and enforces the invariant:
        Total Billed Volume = Remaining Customer Dues + Counter Cash Paid + Razorpay Verified Collections
        """
        shop = self._resolve_shop(shop_id_or_code, db)
        bills = db.query(CreditTransactionModel).filter_by(shop_id=shop.id).all()

        tot_billed = Decimal("0.00")
        tot_counter_cash = Decimal("0.00")
        tot_razorpay = Decimal("0.00")
        tot_outstanding = Decimal("0.00")
        active_count = 0
        settled_count = 0

        for b in bills:
            self._sync_transaction_status(b)

            p_amt = b.purchase_amount or Decimal("0.00")
            tot_billed += p_amt

            cash_from_repayments = sum(
                (r.amount or Decimal("0.00"))
                for r in (b.repayments or [])
                if r.payment_status == "completed" and r.payment_method in ("shopkeeper_cash", "cash", "manual_cash", "initial_downpayment")
            )
            if cash_from_repayments > Decimal("0.00"):
                tot_counter_cash += cash_from_repayments
            else:
                tot_counter_cash += (b.initial_paid_amount or Decimal("0.00"))

            for v in (b.payment_verifications or []):
                if v.status == "captured":
                    tot_razorpay += (Decimal(v.amount_paise) / Decimal("100")).quantize(Decimal("0.01"))

            out_amt = b.outstanding_amount or Decimal("0.00")
            tot_outstanding += out_amt

            if out_amt <= Decimal("0.00"):
                settled_count += 1
            else:
                active_count += 1

        tot_collected = (tot_counter_cash + tot_razorpay).quantize(Decimal("0.01"))
        discrepancy = abs(tot_billed - (tot_outstanding + tot_collected))
        is_reconciled = discrepancy == Decimal("0.00")

        total_bills = len(bills)
        settlement_rate = (
            float((Decimal(settled_count) / Decimal(total_bills) * Decimal("100")).quantize(Decimal("0.1")))
            if total_bills > 0
            else 0.0
        )
        collections_rate = (
            float((tot_collected / tot_billed * Decimal("100")).quantize(Decimal("0.1")))
            if tot_billed > 0
            else 0.0
        )

        return ShopkeeperFinancialSummaryOut(
            shop_id=shop.id,
            shop_name=shop.shop_name,
            total_billed_volume=float(tot_billed),
            counter_cash_paid=float(tot_counter_cash),
            razorpay_verified_collections=float(tot_razorpay),
            total_collected=float(tot_collected),
            remaining_customer_dues=float(tot_outstanding),
            active_bills_count=active_count,
            settled_bills_count=settled_count,
            total_bills_count=total_bills,
            settlement_rate_percentage=settlement_rate,
            collections_settlement_percentage=collections_rate,
            unresolved_discrepancy=float(discrepancy),
            is_reconciled=is_reconciled,
        )

    def get_shopkeeper_transactions(
        self,
        shop_id_or_code: str,
        filter_status: Optional[str],
        search: Optional[str],
        db: Session,
    ) -> List[ShopkeeperTransactionOut]:
        """
        Lists transactions scoped strictly to this shop.
        Enforces shop-level isolation.
        """
        shop = self._resolve_shop(shop_id_or_code, db)
        query = db.query(CreditTransactionModel).filter_by(shop_id=shop.id)

        txns = query.all()
        results: List[ShopkeeperTransactionOut] = []

        for t in txns:
            status = self._sync_transaction_status(t)
            t.status = status

            reps = [
                RepaymentOut(
                    id=r.id,
                    transaction_id=r.transaction_id,
                    amount=float(r.amount),
                    repayment_date=r.repayment_date,
                    payment_method=r.payment_method,
                    payment_status=r.payment_status,
                    recorded_by=getattr(r, "recorded_by", "customer") or "customer",
                    provider_reference=r.provider_reference,
                    notes=r.notes,
                    created_at=r.created_at,
                )
                for r in (t.repayments or [])
            ]

            stxn = ShopkeeperTransactionOut(
                id=t.id,
                reference=t.reference,
                customer_id=t.customer_id,
                customer_name=t.customer.display_name if t.customer else "Customer",
                customer_phone=t.customer.phone if t.customer else "",
                shop_id=t.shop_id,
                shop_name=shop.shop_name,
                shop_code=shop.shop_code,
                description=t.description,
                purchase_amount=float(t.purchase_amount),
                initial_paid_amount=float(t.initial_paid_amount),
                outstanding_amount=float(t.outstanding_amount),
                transaction_date=t.transaction_date,
                agreed_repayment_date=t.agreed_repayment_date,
                status=status,
                created_at=t.created_at,
                repayments=reps,
            )
            results.append(stxn)

        # Filter by status if provided
        if filter_status and filter_status.lower() != "all":
            fs = filter_status.lower()
            if fs == "outstanding":
                results = [r for r in results if r.outstanding_amount > 0]
            elif fs == "partially_paid":
                results = [
                    r for r in results
                    if r.outstanding_amount > 0 and (r.purchase_amount - r.outstanding_amount) > 0
                ]
            elif fs == "awaiting_payment":
                results = [
                    r for r in results
                    if r.outstanding_amount > 0 and (r.purchase_amount - r.outstanding_amount) == 0
                ]
            else:
                results = [r for r in results if r.status.lower() == fs]

        # Filter by search string (reference or customer name)
        if search and search.strip():
            s = search.strip().lower()
            results = [
                r for r in results
                if s in r.reference.lower()
                or s in r.customer_name.lower()
                or s in r.description.lower()
            ]

        # Sort: Overdue first, then due today, then upcoming, then paid
        def sort_prio(item: ShopkeeperTransactionOut):
            if item.status == "overdue":
                return (0, item.agreed_repayment_date)
            elif item.status == "due_today":
                return (1, item.agreed_repayment_date)
            elif item.status == "upcoming":
                return (2, item.agreed_repayment_date)
            else:
                return (3, item.agreed_repayment_date)

        results.sort(key=sort_prio)
        return results

    def record_shopkeeper_repayment(
        self,
        transaction_id: str,
        shop_id_or_code: str,
        data: ShopkeeperRepaymentCreate,
        db: Session,
    ) -> ShopkeeperTransactionOut:
        """
        Allows a shopkeeper to record a payment received directly in cash/UPI at the counter.
        Enforces:
        - Transaction must belong to the active shopkeeper's shop!
        - Amount must be > 0 and <= outstanding amount.
        - Atomically recalculates balance and records audit event.
        """
        shop = self._resolve_shop(shop_id_or_code, db)

        txn = (
            db.query(CreditTransactionModel)
            .filter_by(id=transaction_id, shop_id=shop.id)
            .first()
        )
        if data.idempotency_key:
            existing_rep = (
                db.query(RepaymentModel)
                .filter_by(idempotency_key=data.idempotency_key)
                .first()
            )
            if existing_rep:
                return self._serialize_shopkeeper_transaction(existing_rep.transaction, shop)

        if not txn:
            raise NotFoundException(
                f"Credit transaction '{transaction_id}' not found for shop '{shop.shop_name}'."
            )

        if txn.status == "paid" or txn.outstanding_amount <= Decimal("0.00"):
            raise AppException(
                status_code=400,
                message="This transaction is already fully settled. No additional payment can be recorded.",
                code="TRANSACTION_ALREADY_PAID",
            )

        if data.amount <= Decimal("0.00"):
            raise AppException(
                status_code=422,
                message="Repayment amount must be positive.",
                code="INVALID_REPAYMENT_AMOUNT",
            )

        if data.amount > txn.outstanding_amount:
            raise AppException(
                status_code=422,
                message=f"Payment amount (₹{data.amount:,.2f}) exceeds outstanding customer balance (₹{txn.outstanding_amount:,.2f}).",
                code="OVERPAYMENT_NOT_ALLOWED",
            )

        today = date.today()
        repayment = RepaymentModel(
            id=str(uuid.uuid4()),
            transaction_id=txn.id,
            amount=data.amount,
            repayment_date=today,
            payment_method=data.payment_method or "shopkeeper_cash",
            payment_status="completed",
            recorded_by="shopkeeper",
            provider_reference=f"SHOP-{uuid.uuid4().hex[:8].upper()}",
            notes=data.notes or "Payment collected directly by shopkeeper",
            idempotency_key=data.idempotency_key,
        )
        db.add(repayment)
        db.flush()

        txn.outstanding_amount = (txn.outstanding_amount - data.amount).quantize(Decimal("0.01"))
        if txn.outstanding_amount <= Decimal("0.00"):
            txn.outstanding_amount = Decimal("0.00")
            txn.status = "paid"
            act_title = "Payment Received at Shop"
            act_desc = f"Shopkeeper {shop.shop_name} recorded full settlement of ₹{data.amount:,.2f} for {txn.description}."
        else:
            txn.status = self._sync_transaction_status(txn)
            act_title = "Partial Payment Received at Shop"
            act_desc = f"Shopkeeper {shop.shop_name} recorded payment of ₹{data.amount:,.2f} for {txn.description}. Remaining due: ₹{txn.outstanding_amount:,.2f}."

        act = ActivityEventModel(
            customer_id=txn.customer_id,
            transaction_id=txn.id,
            event_type="repayment_completed" if txn.status == "paid" else "partial_payment",
            title=act_title,
            description=act_desc,
            amount=data.amount,
        )
        db.add(act)
        db.commit()
        db.refresh(txn)

        try:
            from backend.app.core.events import event_broadcaster
            event_broadcaster.publish("repayment_recorded", {
                "bill_id": txn.id,
                "customer_id": txn.customer_id,
                "shop_id": txn.shop_id,
                "reference": txn.reference,
                "repayment_amount": float(data.amount),
                "outstanding_amount": float(txn.outstanding_amount),
            })
        except Exception:
            pass

        reps = [
            RepaymentOut(
                id=r.id,
                transaction_id=r.transaction_id,
                amount=float(r.amount),
                repayment_date=r.repayment_date,
                payment_method=r.payment_method,
                payment_status=r.payment_status,
                recorded_by=getattr(r, "recorded_by", "customer") or "customer",
                provider_reference=r.provider_reference,
                notes=r.notes,
                created_at=r.created_at,
            )
            for r in (txn.repayments or [])
        ]

        return ShopkeeperTransactionOut(
            id=txn.id,
            reference=txn.reference,
            customer_id=txn.customer_id,
            customer_name=txn.customer.display_name if txn.customer else "Customer",
            customer_phone=txn.customer.phone if txn.customer else "",
            shop_id=txn.shop_id,
            shop_name=shop.shop_name,
            shop_code=shop.shop_code,
            description=txn.description,
            purchase_amount=float(txn.purchase_amount),
            initial_paid_amount=float(txn.initial_paid_amount),
            outstanding_amount=float(txn.outstanding_amount),
            transaction_date=txn.transaction_date,
            agreed_repayment_date=txn.agreed_repayment_date,
            status=txn.status,
            created_at=txn.created_at,
            repayments=reps,
        )


customer_service = CustomerService()
