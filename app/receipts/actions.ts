"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StockMovementType } from "@/app/generated/prisma/enums";

export type ReceiptState = {
  error?: string;
};

type LinePayload = {
  componentId: string;
  quantity: number;
  unitCost: number | null;
};

const ERR_NO_LINES = "Add at least one receipt line.";

function parseLinesJson(
  raw: unknown,
): { ok: true; lines: LinePayload[] } | { ok: false; error: string } {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: ERR_NO_LINES };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid line data." };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { ok: false, error: ERR_NO_LINES };
  }
  const lines: LinePayload[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") {
      return { ok: false, error: "Each line must include component and quantity." };
    }
    const componentId = String((row as { componentId?: unknown }).componentId ?? "").trim();
    const qtyRaw = (row as { quantity?: unknown }).quantity;
    const quantity = typeof qtyRaw === "number" ? qtyRaw : Number(qtyRaw);
    const uc = (row as { unitCost?: unknown }).unitCost;
    let unitCost: number | null = null;
    if (uc !== undefined && uc !== null && String(uc).trim() !== "") {
      const n = typeof uc === "number" ? uc : Number(uc);
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, error: "Unit cost must be a non-negative number when provided." };
      }
      unitCost = n;
    }
    if (!componentId) {
      return { ok: false, error: "Select a component on each line." };
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, error: "Quantity must be a positive number on each line." };
    }
    lines.push({ componentId, quantity, unitCost });
  }
  return { ok: true, lines };
}

function buildMovementNote(args: {
  supplierName: string;
  invoiceRef: string | null;
  receivedAt: Date;
  receiptNote: string | null;
  componentName: string;
  unitCost: number | null;
}): string {
  const parts: string[] = [
    args.invoiceRef ? `Inv ${args.invoiceRef}` : null,
    args.supplierName,
    `received ${args.receivedAt.toISOString().slice(0, 10)}`,
    args.componentName,
    args.receiptNote ? `hdr: ${args.receiptNote}` : null,
    args.unitCost != null ? `unit cost ${args.unitCost}` : null,
  ].filter((p): p is string => Boolean(p));
  return parts.join(" · ");
}

export async function recordReceipt(
  _prevState: ReceiptState,
  formData: FormData,
): Promise<ReceiptState> {
  const supplierName = String(formData.get("supplierName") ?? "").trim();
  const invoiceRefRaw = String(formData.get("invoiceRef") ?? "").trim();
  const receivedAtRaw = String(formData.get("receivedAt") ?? "").trim();
  const receiptNoteRaw = String(formData.get("receiptNote") ?? "").trim();
  const linesJson = formData.get("linesJson");

  if (!supplierName) {
    return { error: "Supplier name is required." };
  }

  if (!receivedAtRaw) {
    return { error: "Received date is required." };
  }

  const ymd = receivedAtRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!ymd) {
    return { error: "Use a valid received date." };
  }
  const y = Number(ymd[1]);
  const m = Number(ymd[2]);
  const d = Number(ymd[3]);
  const receivedAt = new Date(Date.UTC(y, m - 1, d));

  const invoiceRef = invoiceRefRaw.length > 0 ? invoiceRefRaw : null;
  const receiptNote = receiptNoteRaw.length > 0 ? receiptNoteRaw : null;

  const parsed = parseLinesJson(linesJson);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const componentIds = [...new Set(parsed.lines.map((l) => l.componentId))];
  const components = await prisma.component.findMany({
    where: { id: { in: componentIds } },
    select: { id: true, name: true },
  });
  const compMap = new Map(components.map((c) => [c.id, c.name]));
  if (components.length !== componentIds.length) {
    return { error: "One or more components are invalid." };
  }

  await prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.create({
      data: {
        supplierName,
        invoiceRef,
        receivedAt,
        note: receiptNote,
      },
    });

    for (const line of parsed.lines) {
      const componentName = compMap.get(line.componentId)!;
      const receiptLine = await tx.receiptLine.create({
        data: {
          receiptId: receipt.id,
          componentId: line.componentId,
          quantity: line.quantity,
          unitCost: line.unitCost,
        },
      });

      await tx.stockMovement.create({
        data: {
          componentId: line.componentId,
          type: StockMovementType.RECEIPT,
          qtyChange: line.quantity,
          sourceType: "manual_receipt",
          receiptLineId: receiptLine.id,
          note: buildMovementNote({
            supplierName,
            invoiceRef,
            receivedAt,
            receiptNote,
            componentName,
            unitCost: line.unitCost,
          }),
        },
      });
    }
  });

  revalidatePath("/receipts");
  revalidatePath("/movements");
  revalidatePath("/components");
  revalidatePath("/stock");
  revalidatePath("/reorder");
  return redirect("/stock");
}
