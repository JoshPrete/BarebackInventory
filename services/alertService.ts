/**
 * Alert service — evaluates stock levels against reorder points and
 * surfaces actionable alerts. Writes to the alerts table; pages read
 * from here, never from the DB directly.
 *
 * Task 1: stubs only.
 */

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType = "low_stock" | "out_of_stock" | "reorder_due";

export interface Alert {
  alertId: string;
  type: AlertType;
  severity: AlertSeverity;
  componentId?: string;
  componentName?: string;
  sellableSkuId?: string;
  skuName?: string;
  currentLevel: number;
  reorderPoint: number;
  resolvedAt: string | null;
  createdAt: string;
}

/**
 * Return all unresolved low-stock alerts.
 */
export async function getLowStockAlerts(): Promise<Alert[]> {
  // TODO: query alerts table where resolvedAt is null
  return [];
}

/**
 * Evaluate current stock levels and create new alerts where thresholds
 * are breached. Idempotent — safe to run on a schedule.
 */
export async function evaluateAlerts(): Promise<{ alertsCreated: number }> {
  // TODO: compare inventoryService.getComponentStockLevels() vs reorderPoint
  return { alertsCreated: 0 };
}
