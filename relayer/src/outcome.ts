/**
 * A meta-transaction's final status is the relayer's own transaction, which
 * succeeds even when the delegated call panics: the panic sits in a receipt
 * executed by the core contract. near-api-js only throws on the final status,
 * so the relayer must read the receipts itself and turn a contract panic into
 * the error the player should see ("Wrong answer", "Shop closed: …").
 */

interface ReceiptOutcomeLike {
  outcome: {
    executor_id: string;
    status: unknown;
  };
}

export interface OutcomeLike {
  receipts_outcome?: ReceiptOutcomeLike[];
}

const PANIC_PREFIX = "Smart contract panicked: ";

/** The first failed receipt's message, or null when every receipt succeeded. */
export function receiptFailure(outcome: OutcomeLike): { executor: string; message: string } | null {
  for (const r of outcome.receipts_outcome ?? []) {
    const status = r.outcome.status as { Failure?: unknown } | string;
    if (typeof status !== "object" || status === null || !("Failure" in status)) continue;
    return { executor: r.outcome.executor_id, message: failureMessage(status.Failure) };
  }
  return null;
}

function failureMessage(failure: unknown): string {
  const text = findString(failure, ["ExecutionError", "MethodNotFound", "CompilationError", "LinkError", "WasmTrap", "HostError"]);
  if (text) return text.startsWith(PANIC_PREFIX) ? text.slice(PANIC_PREFIX.length) : text;
  return `Transaction failed: ${JSON.stringify(failure).slice(0, 200)}`;
}

/** Depth-first search for the first string under any of the given keys. */
function findString(node: unknown, keys: string[]): string | null {
  if (!node || typeof node !== "object") return null;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (keys.includes(k)) return typeof v === "string" ? v : JSON.stringify(v);
    const nested = findString(v, keys);
    if (nested) return nested;
  }
  return null;
}
