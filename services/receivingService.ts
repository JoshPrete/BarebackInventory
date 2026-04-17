/**
 * Receiving service — handles inbound goods: creates receipt headers,
 * receipt lines, and the corresponding raw stock movements.
 *
 * Task 1: stubs only.
 */

export interface ReceiptLineInput {
  componentId: string;
  quantity: number;
  unitCost?: number;
}

export interface ReceiveStockInput {
  supplierName: string;
  invoiceRef?: string;
  receivedAt: string; // ISO date
  note?: string;
  lines: ReceiptLineInput[];
}

export interface ReceiveStockResult {
  receiptId: string;
  linesCreated: number;
  movementsCreated: number;
}

/**
 * Record a supplier delivery: persist receipt header + lines and
 * create positive stock movements for each component received.
 */
export async function receiveStock(
  _input: ReceiveStockInput,
): Promise<ReceiveStockResult> {
  // TODO: prisma.receipt.create with nested lines + StockMovement writes
  return { receiptId: "", linesCreated: 0, movementsCreated: 0 };
}
