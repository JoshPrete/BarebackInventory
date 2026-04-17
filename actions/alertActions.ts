"use server";
/**
 * Alert server actions — UI entry point for alert reads and evaluation
 * triggers. Delegates to alertService only.
 */

import {
  getLowStockAlerts as _getLowStockAlerts,
  evaluateAlerts as _evaluateAlerts,
  type Alert,
} from "@/services/alertService";

export async function getLowStockAlerts(): Promise<Alert[]> {
  return _getLowStockAlerts();
}

export async function evaluateAlerts(): Promise<{ alertsCreated: number }> {
  return _evaluateAlerts();
}
