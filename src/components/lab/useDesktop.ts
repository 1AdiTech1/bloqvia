import { useEffect, useState } from "react";

/** True at the `dk:` breakpoint (≥1100px). False during SSR and the first client render. */
export function useIsDesktop() {
  const [dk, setDk] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1100px)");
    const on = () => setDk(mql.matches);
    on();
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, []);
  return dk;
}

/** NEAR AI's verify page with the model filled in. */
export function verifyUrl(model: string | null | undefined) {
  return model ? `https://cloud.near.ai/verify?model=${encodeURIComponent(model)}` : "https://cloud.near.ai/verify";
}
