/**
 * Turn a chain or relayer error into one plain sentence a player can read.
 * Only the `error` string shown in the UI goes through this; the thrown Error
 * is unchanged, so callers that catch it still see the original message.
 *
 *   set({ error: humanError(e) });
 */

const MAX = 160;

/** Known NEAR failures, matched on the raw message (often JSON from the relayer). */
const RULES: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  // A contract account has no free balance left to pay for the bytes it would store.
  [/LackBalanceForState[\s\S]*?"account_id"\s*:\s*"([^"]+)"/, (m) =>
    `${short(m[1])} is out of storage space on testnet for the moment. It needs a top-up of test NEAR; try again in a few minutes.`],
  [/LackBalanceForState/, () =>
    "A game contract is out of storage space on testnet for the moment. Try again in a few minutes."],
  // The relayer (which pays everyone's gas) can't cover the transaction.
  [/NotEnoughBalance|NotEnoughAllowance|"balance"[\s\S]*"cost"/, () =>
    "The relayer that pays your gas is low on test NEAR. Try again in a few minutes."],
  // A contract refused the call on purpose: show its own reason.
  [/Smart contract panicked:\s*([^"\\}]+)/, (m) => tidy(m[1] ?? "")],
  [/FunctionCallError[\s\S]*?"ExecutionError"\s*:\s*"([^"]+)"/, (m) => tidy(m[1] ?? "")],
  // Network trouble between the browser and the relayer or RPC.
  [/Failed to fetch|NetworkError|ECONNREFUSED|ETIMEDOUT|fetch failed|Load failed/i, () =>
    "Couldn't reach NEAR just now. Check your connection and try again."],
  [/\b(502|503|504)\b|Bad Gateway|Service Unavailable|Gateway Timeout/i, () =>
    "The NEAR service is busy right now. Try again in a moment."],
  [/InvalidNonce|nonce/i, () => "Two actions crossed on the way to NEAR. Try once more."],
];

function short(account: string | undefined): string {
  if (!account) return "A game contract";
  const name = account.split(".")[0] ?? account;
  const label: Record<string, string> = { streak: "The streak contract", core: "The game contract", passport: "The Passport contract", bounties: "The Missions contract" };
  return label[name] ?? account;
}

function tidy(s: string): string {
  const t = s.replace(/\s+/g, " ").replace(/^["'\s]+|["'\s.]+$/g, "").trim();
  if (!t) return "The contract refused this action.";
  const sentence = t.charAt(0).toUpperCase() + t.slice(1);
  return clip(sentence.endsWith(".") ? sentence : `${sentence}.`);
}

function clip(s: string): string {
  return s.length <= MAX ? s : `${s.slice(0, MAX - 1).trimEnd()}…`;
}

/** The contract's refusal of a wrong quiz option ("Wrong answer", from core's complete_lesson), as the player sees it.
 *  The quiz shows a wrong answer itself (Bloq's line, the crossed-out option, the hint), so the top message skips it
 *  while a quiz is open (prompt 27e). */
export function isWrongAnswer(message: string | null | undefined): boolean {
  return !!message && /^wrong answer\.?$/i.test(message.trim());
}

export function humanError(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e ?? "");
  for (const [re, say] of RULES) {
    const m = raw.match(re);
    if (m) return say(m);
  }
  // Unknown: never show raw JSON to a player.
  if (/^\s*[{[]/.test(raw) || /"(ActionError|kind|index)"/.test(raw)) return "NEAR refused this transaction. Try again in a moment.";
  return clip(raw.trim() || "Something went wrong. Try again in a moment.");
}
