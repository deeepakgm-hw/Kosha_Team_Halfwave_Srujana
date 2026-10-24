export type MSMEClassification = "Micro" | "Small" | "Medium";

export interface BusinessSummary {
  id: string;
  name: string;
  industry: string;
  category: MSMEClassification;
  currentCash: number;
  monthlyBurn: number;
  runwayDays: number;
  shortfallRisk: "LOW" | "MODERATE" | "CRITICAL";
  isSynthetic: boolean;
}

export interface CashForecastPoint {
  date: string;
  startingCash: number;
  expectedInflow: number;
  committedOutflow: number;
  endingCash: number;
  isShortfall: boolean;
  confidenceLower?: number;
  confidenceUpper?: number;
}

export interface CorrectiveAction {
  id: string;
  title: string;
  description: string;
  estimatedYield: number;
  daysToCash: number;
  costInr: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface ReceivableItem {
  id: string;
  customerName: string;
  amount: number;
  dueDate: string;
  status: "current" | "overdue" | "disputed";
  daysOverdue: number;
  msmedViolated: boolean;
  accruedPenalInterest: number;
  isSynthetic: boolean;
}
