"use server";
/**
 * Inventory server actions — UI entry points for component management,
 * BOM rules, and stock receiving. Delegates to service layer only.
 */

import {
  createComponent as _createComponent,
  createSkuComponentRule as _createSkuComponentRule,
  type CreateComponentInput,
  type CreateComponentResult,
  type CreateSkuComponentRuleInput,
  type CreateSkuComponentRuleResult,
} from "@/services/bomService";
import {
  receiveStock as _receiveStock,
  type ReceiveStockInput,
  type ReceiveStockResult,
} from "@/services/receivingService";

export async function createComponent(
  input: CreateComponentInput,
): Promise<CreateComponentResult> {
  return _createComponent(input);
}

export async function createSkuComponentRule(
  input: CreateSkuComponentRuleInput,
): Promise<CreateSkuComponentRuleResult> {
  return _createSkuComponentRule(input);
}

export async function receiveStock(
  input: ReceiveStockInput,
): Promise<ReceiveStockResult> {
  return _receiveStock(input);
}
