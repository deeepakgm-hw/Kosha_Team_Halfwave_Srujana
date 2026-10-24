import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { ScenariosPage } from "../features/scenarios/ScenariosPage";
import { ActionsPage } from "../features/actions/ActionsPage";
import { ReceivablesPage } from "../features/receivables/ReceivablesPage";
import { CalendarPage } from "../features/calendar/CalendarPage";
import { TrustPage } from "../features/trust/TrustPage";
import { ForecastPage } from "../features/forecast/ForecastPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "dashboard",
        element: <Navigate to="/" replace />,
      },
      {
        path: "forecast",
        element: <ForecastPage />,
      },
      {
        path: "scenarios",
        element: <ScenariosPage />,
      },
      {
        path: "actions",
        element: <ActionsPage />,
      },
      {
        path: "receivables",
        element: <ReceivablesPage />,
      },
      {
        path: "calendar",
        element: <CalendarPage />,
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
