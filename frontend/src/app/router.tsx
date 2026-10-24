import { createBrowserRouter, Navigate } from "react-router-dom";
import { GlassLayout } from "../components/layout/GlassLayout";
import { LoadPage } from "../features/load/LoadPage";
import { KnowForecastPage } from "../features/forecast/KnowForecastPage";
import { DecideScenariosPage } from "../features/scenarios/DecideScenariosPage";
import { ActActionsPage } from "../features/actions/ActActionsPage";
import { PlanPage } from "../features/plan/PlanPage";
import { ReceivablesPage } from "../features/receivables/ReceivablesPage";
import { CalendarPage } from "../features/calendar/CalendarPage";
import { TrustPage } from "../features/trust/TrustPage";
import { ShopCreditPage } from "../features/shopkeeper/ShopCreditPage";
import { LoginPage } from "../features/auth/LoginPage";
import { LandingPage } from "../features/landing/LandingPage";
import { CustomerLayout } from "../components/layout/CustomerLayout";
import { CustomerDashboardPage } from "../features/customer/CustomerDashboardPage";
import { CustomerDuesPage } from "../features/customer/CustomerDuesPage";
import { CustomerPayPage } from "../features/customer/CustomerPayPage";
import { CustomerActivityPage } from "../features/customer/CustomerActivityPage";
import { CustomerProfilePage } from "../features/customer/CustomerProfilePage";
import { RouteErrorBoundary } from "../components/layout/RouteErrorBoundary";

export const router = createBrowserRouter([
  // High-Impact PayPal-Style Landing Page
  {
    path: "/",
    element: <LandingPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/landing",
    element: <LandingPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/home",
    element: <LandingPage />,
    errorElement: <RouteErrorBoundary />,
  },
  // Interactive Demo / Persona Selection
  {
    path: "/welcome",
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  // Customer Experience
  {
    path: "/customer",
    element: <CustomerLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <Navigate to="/customer/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <CustomerDashboardPage />,
      },
      {
        path: "dues",
        element: <CustomerDuesPage />,
      },
      {
        path: "repayments",
        element: <CustomerDuesPage />,
      },
      {
        path: "pay",
        element: <CustomerPayPage />,
      },
      {
        path: "shops",
        element: <CustomerPayPage />,
      },
      {
        path: "activity",
        element: <CustomerActivityPage />,
      },
      {
        path: "profile",
        element: <CustomerProfilePage />,
      },
    ],
  },
  // Business Owner / Merchant Dashboard Experience
  {
    element: <GlassLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      // 1. Load data
      {
        path: "load",
        element: <LoadPage />,
      },
      // 2. Understand cash flow
      {
        path: "understand-cash-flow",
        element: <KnowForecastPage />,
      },
      {
        path: "forecast",
        element: <KnowForecastPage />,
      },
      {
        path: "know",
        element: <KnowForecastPage />,
      },
      // 3. Test scenarios
      {
        path: "test-scenarios",
        element: <DecideScenariosPage />,
      },
      {
        path: "scenarios",
        element: <DecideScenariosPage />,
      },
      {
        path: "simulate",
        element: <DecideScenariosPage />,
      },
      {
        path: "decide",
        element: <DecideScenariosPage />,
      },
      // 4. Compare actions
      {
        path: "compare-actions",
        element: <ActActionsPage />,
      },
      {
        path: "actions",
        element: <ActActionsPage />,
      },
      {
        path: "fixes",
        element: <ActActionsPage />,
      },
      {
        path: "act",
        element: <ActActionsPage />,
      },
      // 5. Action plan
      {
        path: "action-plan",
        element: <PlanPage />,
      },
      {
        path: "plan",
        element: <PlanPage />,
      },
      // Supporting Tools
      {
        path: "receivables",
        element: <ReceivablesPage />,
      },
      {
        path: "shop-credit",
        element: <ShopCreditPage />,
      },
      {
        path: "shopkeeper",
        element: <ShopCreditPage />,
      },
      {
        path: "shopkeeper-credit",
        element: <ShopCreditPage />,
      },
      {
        path: "calendar",
        element: <CalendarPage />,
      },
      {
        path: "cash-calendar",
        element: <CalendarPage />,
      },
      {
        path: "reliability",
        element: <TrustPage />,
      },
      {
        path: "forecast-reliability",
        element: <TrustPage />,
      },
      {
        path: "trust",
        element: <TrustPage />,
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
