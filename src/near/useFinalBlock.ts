/**
 * The height of the latest final block on the configured network, read from the RPC the app
 * already uses. Polls every `everyMs` while the tab is visible; null until the first answer or
 * if the RPC can't be reached. Read-only: it never signs or sends anything.
 *
 *   const height = useFinalBlock();     // 189402117 | null
 */
import { useEffect, useState } from "react";
import { NEAR_CONFIG } from "./config";

export async function fetchFinalBlockHeight(signal?: AbortSignal): Promise<number | null> {
  try {
    const res = await fetch(NEAR_CONFIG.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "bloqvia-height", method: "block", params: { finality: "final" } }),
      ...(signal ? { signal } : {}),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { header?: { height?: unknown } } };
    const h = json.result?.header?.height;
    return typeof h === "number" && Number.isFinite(h) ? h : null;
  } catch {
    return null;
  }
}

export function useFinalBlock(everyMs = 4000): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    let ctrl: AbortController | null = null;
    const tick = async () => {
      if (document.hidden) return;
      ctrl?.abort();
      ctrl = new AbortController();
      const h = await fetchFinalBlockHeight(ctrl.signal);
      if (alive && h !== null) setHeight((prev) => (prev === null || h > prev ? h : prev));
    };
    void tick();
    const id = window.setInterval(() => void tick(), Math.max(1500, everyMs));
    return () => { alive = false; ctrl?.abort(); window.clearInterval(id); };
  }, [everyMs]);
  return height;
}
