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
import { LoginPage } from "../features/auth/LoginPage";

export const router = createBrowserRouter([
  {
    path: "/welcome",
    element: <LoginPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <GlassLayout />,
    children: [
      {
        index: true,
        element: <LoadPage />,
      },
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
        element: <Navigate to="/load" replace />,
      },
    ],
  },
]);
