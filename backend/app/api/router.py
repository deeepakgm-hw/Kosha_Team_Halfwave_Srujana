from fastapi import APIRouter
from backend.app.api.routes.health import router as health_router
from backend.app.api.routes.forecast import router as forecast_router
from backend.app.api.routes.businesses import router as businesses_router
from backend.app.api.routes.statements import router as statements_router
from backend.app.api.routes.invoices import router as invoices_router
from backend.app.api.routes.bills import router as bills_router
from backend.app.api.routes.operating_expenses import router as operating_expenses_router
from backend.app.api.routes.actions import router as actions_router
from backend.app.api.routes.receivables import router as receivables_router
from backend.app.api.routes.calendar import router as calendar_router
from backend.app.api.routes.backtest import router as backtest_router
from backend.app.api.routes.customer import router as customer_router
from backend.app.api.routes.shops import router as shops_router
from backend.app.api.routes.shopkeeper import router as shopkeeper_router
from backend.app.api.routes.payment_gateway import router as payment_gateway_router
from backend.app.api.routes.notifications import router as notifications_router
from backend.app.api.routes.events import router as events_router
from backend.app.api.routes.auth import router as auth_router
from backend.app.api.routes.autopay import router as autopay_router

api_router = APIRouter()

# Register active routes
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication & Identity"])
api_router.include_router(autopay_router, prefix="/autopay", tags=["AutoPay & Recurring Mandates"])
api_router.include_router(health_router, tags=["Health"])
api_router.include_router(businesses_router, tags=["Businesses & Accounts"])
api_router.include_router(statements_router, tags=["Bank Statements & Transactions"])
api_router.include_router(invoices_router, tags=["Customer Invoices"])
api_router.include_router(bills_router, tags=["Vendor Bills"])
api_router.include_router(operating_expenses_router, tags=["Operating Expenses"])
api_router.include_router(forecast_router, tags=["Forecast Engine"])
api_router.include_router(actions_router, prefix="/actions", tags=["Corrective Actions"])
api_router.include_router(receivables_router, prefix="/receivables", tags=["Receivables & MSMED Law"])
api_router.include_router(calendar_router, prefix="/calendar", tags=["Cash Calendar"])
api_router.include_router(backtest_router, prefix="/backtest", tags=["Forecast Reliability"])
api_router.include_router(customer_router, prefix="/customer", tags=["Customer Dashboard & Dues"])
api_router.include_router(shops_router, prefix="/shops", tags=["Merchant Shops"])
api_router.include_router(shopkeeper_router, prefix="/shopkeeper", tags=["Shopkeeper Credit & QR"])
api_router.include_router(payment_gateway_router, prefix="/payment-gateway", tags=["Payment Gateway Boundary"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["Persistent Notifications"])
api_router.include_router(events_router, prefix="/events", tags=["Real-Time Synchronization"])
