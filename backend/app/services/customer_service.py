"""
Customer Service: Implements customer shop-credit tracking, dues aggregation,
transaction creation, and auditable demo repayment recording.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

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
)


def generate_reference() -> str:
    """Generates a human-friendly unique transaction reference code."""
    token = uuid.uuid4().hex[:8].upper()
    return f"TXN-{token}"


class CustomerService:
    """Handles customer credit transactions, dues, and repayment commitments."""

    def ensure_demo_seeds(self, db: Session) -> CustomerModel:
        """Seeds default synthetic demo customer and shops if not already created."""
        customer = db.query(CustomerModel).filter_by(id="cust_rahul_01").first()
        if not customer:
            customer = CustomerModel(
                id="cust_rahul_01",
                display_name="Rahul Sharma",
                phone="+91 98765 43210",
                email="rahul.sharma@example.in",
            )
            db.add(customer)
            db.flush()

        # Seed standard participating shops
        shops_data = [
            {
                "id": "shop_apex_01",
                "shop_name": "Apex Precision Works",
                "shop_code": "KOSHA-APEX",
                "category": "Industrial Spares & Hardware",
                "owner_name": "Vikram Mehta",
                "phone": "+91 98220 11223",
                "upi_id": "apexworks@upi",
                "qr_payload": "kosha://pay?shop=KOSHA-APEX",
            },
            {
                "id": "shop_lakshmi_02",
                "shop_name": "Sri Lakshmi Provisions",
                "shop_code": "KOSHA-LAKSHMI",
                "category": "Grocery & Daily Provisions",
                "owner_name": "Lakshmi Narayanan",
                "phone": "+91 98440 22334",
                "upi_id": "lakshmiprovisions@upi",
                "qr_payload": "kosha://pay?shop=KOSHA-LAKSHMI",
            },
            {
                "id": "shop_city_03",
                "shop_name": "City Hardware & Tools",
                "shop_code": "KOSHA-CITY",
                "category": "Tools & Electrical Goods",
                "owner_name": "Rajesh Patil",
                "phone": "+91 98110 33445",
                "upi_id": "cityhardware@upi",
                "qr_payload": "kosha://pay?shop=KOSHA-CITY",
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
                    )
                )
        db.flush()

        # Seed sample credit transactions if user has none
        txn_count = db.query(CreditTransactionModel).filter_by(customer_id=customer.id).count()
        if txn_count == 0:
            today = date.today()
            # 1. Upcoming due in 5 days
            txn1 = CreditTransactionModel(
                id="ctx_demo_01",
                reference="TXN-9482A101",
                customer_id=customer.id,
                shop_id="shop_lakshmi_02",
                description="Monthly Grocery & Food Staples",
                purchase_amount=Decimal("3200.00"),
                initial_paid_amount=Decimal("1000.00"),
                outstanding_amount=Decimal("2200.00"),
                transaction_date=today - timedelta(days=10),
                agreed_repayment_date=today + timedelta(days=5),
                status="upcoming",
            )
            # 2. Overdue by 2 days
            txn2 = CreditTransactionModel(
                id="ctx_demo_02",
                reference="TXN-3819B202",
                customer_id=customer.id,
                shop_id="shop_city_03",
                description="Hardware Fittings & Cables",
                purchase_amount=Decimal("1850.00"),
                initial_paid_amount=Decimal("500.00"),
                outstanding_amount=Decimal("1350.00"),
                transaction_date=today - timedelta(days=15),
                agreed_repayment_date=today - timedelta(days=2),
                status="overdue",
            )
            # 3. Fully paid
            txn3 = CreditTransactionModel(
                id="ctx_demo_03",
                reference="TXN-7193C303",
                customer_id=customer.id,
                shop_id="shop_apex_01",
                description="Precision Fasteners & Safety Gloves",
                purchase_amount=Decimal("950.00"),
                initial_paid_amount=Decimal("950.00"),
                outstanding_amount=Decimal("0.00"),
                transaction_date=today - timedelta(days=7),
                agreed_repayment_date=today - timedelta(days=3),
                status="paid",
            )
            db.add_all([txn1, txn2, txn3])
            db.flush()

            # Add activity history
            act1 = ActivityEventModel(
                customer_id=customer.id,
                transaction_id=txn1.id,
                event_type="purchase_recorded",
                title="Purchase Recorded",
                description="Bought Monthly Grocery at Sri Lakshmi Provisions for ₹3,200 (Paid ₹1,000)",
                amount=Decimal("3200.00"),
                created_at=datetime.now(timezone.utc) - timedelta(days=10),
            )
            act2 = ActivityEventModel(
                customer_id=customer.id,
                transaction_id=txn2.id,
                event_type="purchase_recorded",
                title="Purchase Recorded",
                description="Bought Hardware Fittings at City Hardware & Tools for ₹1,850 (Paid ₹500)",
                amount=Decimal("1850.00"),
                created_at=datetime.now(timezone.utc) - timedelta(days=15),
            )
            act3 = ActivityEventModel(
                customer_id=customer.id,
                transaction_id=txn3.id,
                event_type="repayment_completed",
                title="Repayment Completed",
                description="Cleared full balance of ₹950 at Apex Precision Works",
                amount=Decimal("950.00"),
                created_at=datetime.now(timezone.utc) - timedelta(days=3),
            )
            db.add_all([act1, act2, act3])
            db.commit()

        return customer

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

    def get_dashboard(self, customer_id: str, db: Session) -> CustomerDashboardSummary:
        """Aggregates realistic KPI totals, upcoming commitments, and recent activity."""
        customer = self.ensure_demo_seeds(db)
        if customer_id != customer.id:
            customer = db.query(CustomerModel).filter_by(id=customer_id).first()
            if not customer:
                customer = self.ensure_demo_seeds(db)

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

                if status == "overdue":
                    overdue_amount += t.outstanding_amount
                    reminders.append(
                        ReminderItemOut(
                            transaction_id=t.id,
                            shop_name=stxn.shop_name,
                            amount=float(t.outstanding_amount),
                            due_date=t.agreed_repayment_date,
                            urgency="overdue",
                            message=f"₹{t.outstanding_amount:,.2f} due at {stxn.shop_name} was agreed for {t.agreed_repayment_date.strftime('%d %b %Y')}.",
                        )
                    )
                elif status == "due_today":
                    due_within_7_days += t.outstanding_amount
                    reminders.append(
                        ReminderItemOut(
                            transaction_id=t.id,
                            shop_name=stxn.shop_name,
                            amount=float(t.outstanding_amount),
                            due_date=t.agreed_repayment_date,
                            urgency="due_today",
                            message=f"₹{t.outstanding_amount:,.2f} at {stxn.shop_name} is due today.",
                        )
                    )
                elif today < t.agreed_repayment_date <= seven_days_later:
                    due_within_7_days += t.outstanding_amount
                    reminders.append(
                        ReminderItemOut(
                            transaction_id=t.id,
                            shop_name=stxn.shop_name,
                            amount=float(t.outstanding_amount),
                            due_date=t.agreed_repayment_date,
                            urgency="upcoming",
                            message=f"₹{t.outstanding_amount:,.2f} at {stxn.shop_name} coming up on {t.agreed_repayment_date.strftime('%d %b %Y')}.",
                        )
                    )

        # Non-judgmental friendly status message
        if overdue_amount > 0:
            status_message = f"You have ₹{overdue_amount:,.2f} past its agreed repayment date. Review your dues to see the affected transactions."
        elif total_outstanding > 0:
            status_message = f"You have ₹{total_outstanding:,.2f} in shop credit across {len(active_shop_ids)} shop(s)."
        else:
            status_message = "You're all caught up. You have no outstanding shop dues."

        # Sort upcoming by nearest due date
        upcoming = [t for t in serialized_txns if t.status != "paid"]
        upcoming.sort(key=lambda x: x.agreed_repayment_date)

        # Recent activities
        acts = (
            db.query(ActivityEventModel)
            .filter_by(customer_id=customer.id)
            .order_by(ActivityEventModel.created_at.desc())
            .limit(10)
            .all()
        )
        recent_activity = [
            ActivityEventOut.model_validate(a) for a in acts
        ]

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
        )

    def get_dues(
        self, customer_id: str, filter_status: Optional[str], db: Session
    ) -> CustomerDuesResponse:
        """Returns customer transactions filtered by status with ledger totals."""
        customer = self.ensure_demo_seeds(db)
        if customer_id != customer.id:
            customer = db.query(CustomerModel).filter_by(id=customer_id).first() or customer

        query = db.query(CreditTransactionModel).filter_by(customer_id=customer.id)
        txns = query.all()

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

        # Filter if requested
        if filter_status and filter_status.lower() != "all":
            filtered = [t for t in all_serialized if t.status.lower() == filter_status.lower()]
        else:
            filtered = all_serialized

        # Sort: Overdue & due today first, then nearest due date, paid last
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

        return CustomerDuesResponse(
            total_outstanding=float(total_outstanding),
            overdue_amount=float(overdue_amount),
            due_today_amount=float(due_today_amount),
            upcoming_amount=float(upcoming_amount),
            paid_amount=float(paid_amount),
            transactions=filtered,
        )

    def get_transaction(
        self, transaction_id: str, customer_id: str, db: Session
    ) -> CreditTransactionOut:
        """Fetches a single transaction ensuring customer privacy."""
        self.ensure_demo_seeds(db)
        txn = (
            db.query(CreditTransactionModel)
            .filter_by(id=transaction_id, customer_id=customer_id)
            .first()
        )
        if not txn:
            raise NotFoundException(f"Transaction '{transaction_id}' not found.")
        return self._serialize_transaction(txn)

    def create_credit_transaction(
        self, customer_id: str, data: CreditTransactionCreate, db: Session
    ) -> CreditTransactionOut:
        """
        Records a new shop credit purchase.
        Enforces decimal calculations: remaining = purchase_amount - initial_paid_now.
        Validates shop existence and constraints.
        """
        self.ensure_demo_seeds(db)
        customer = db.query(CustomerModel).filter_by(id=customer_id).first()
        if not customer:
            customer = self.ensure_demo_seeds(db)

        # 1. Resolve shop by shop_code
        shop = (
            db.query(ShopModel)
            .filter(ShopModel.shop_code.ilike(data.shop_code.strip()))
            .first()
        )
        if not shop:
            raise AppException(
                status_code=404,
                message=f"Shop code '{data.shop_code}' not recognized. Please verify the code or scan a participating KOSHA QR code.",
                code="SHOP_NOT_FOUND",
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

        # If there's an outstanding balance, date cannot be in the past
        if remaining_due > 0 and data.agreed_repayment_date < today:
            raise AppException(
                status_code=422,
                message="Agreed repayment date cannot be in the past.",
                code="INVALID_REPAYMENT_DATE",
            )

        # Determine status
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
        )
        db.add(txn)
        db.flush()

        # If user made an initial down payment, log it as completed repayment
        if data.amount_paid_now > 0:
            rep = RepaymentModel(
                transaction_id=txn.id,
                amount=data.amount_paid_now,
                repayment_date=today,
                payment_method="initial_downpayment",
                payment_status="completed",
                provider_reference=f"DOWN-{uuid.uuid4().hex[:6].upper()}",
                notes="Initial payment at checkout",
            )
            db.add(rep)

        # Audit Activity Event
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

        return self._serialize_transaction(txn)

    def record_repayment(
        self, transaction_id: str, customer_id: str, data: RepaymentCreate, db: Session
    ) -> CreditTransactionOut:
        """
        Records an auditable demo repayment towards an outstanding credit balance.
        Recalculates server-side balance atomically.
        """
        self.ensure_demo_seeds(db)
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
            provider_reference=f"DEMO-UPI-{uuid.uuid4().hex[:8].upper()}",
            notes=data.notes,
        )
        db.add(repayment)
        db.flush()

        # Recalculate outstanding balance from source of truth
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

        return self._serialize_transaction(txn)

    def list_shops(self, db: Session) -> List[ShopOut]:
        """Lists all participating verified shops."""
        self.ensure_demo_seeds(db)
        shops = db.query(ShopModel).filter_by(is_verified=True).all()
        return [ShopOut.model_validate(s) for s in shops]

    def get_shop_by_code(self, shop_code: str, db: Session) -> ShopOut:
        """Resolves a shop by its unique QR or manual code."""
        self.ensure_demo_seeds(db)
        clean_code = shop_code.strip()
        shop = db.query(ShopModel).filter(ShopModel.shop_code.ilike(clean_code)).first()
        if not shop:
            raise NotFoundException(f"Shop with code '{shop_code}' not found.")
        return ShopOut.model_validate(shop)

    def get_activity(
        self, customer_id: str, limit: int, db: Session
    ) -> List[ActivityEventOut]:
        """Fetches customer activity events."""
        customer = self.ensure_demo_seeds(db)
        acts = (
            db.query(ActivityEventModel)
            .filter_by(customer_id=customer.id)
            .order_by(ActivityEventModel.created_at.desc())
            .limit(limit)
            .all()
        )
        return [ActivityEventOut.model_validate(a) for a in acts]


customer_service = CustomerService()
