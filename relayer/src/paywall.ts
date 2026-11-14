/**
 * The page a browser sees on a desk route (Nov 14). x402 answers a program with a 402, a PAYMENT-REQUIRED header and
 * a JSON body; when the request comes from a browser (Accept: text/html, a Mozilla user agent) the core asks a
 * "paywall provider" for HTML instead, and without one it serves its generic page ("install @x402/paywall").
 * This is Bloqvia's own: the same price, payee, token and network the header carries, what the route sells, and the
 * two commands that show it. No script, no font, no wallet: the page asks nothing of the reader, because the buyers
 * are programs with purses. The headers and the JSON body for programs are untouched (desk.ts).
 */
import type { PaymentRequired, PaymentRequirements } from "@x402/core/types";
import { fmt } from "./purse.js";

export const README_DESK = "https://github.com/1AdiTech1/bloqvia#c-the-market-desk--x402-on-near-no-account-no-money-needed-to-see-it";

/** What each route says about itself, in the reader's words. */
const ROUTES: Record<string, { kicker: string; sells: string; see: (host: string) => string }> = {
  "/desk/signal": {
    kicker: "market desk",
    sells: "the market's prices now, the day's average, the price-call round and the traders' last moves — what the chain already holds, read for you and sold per request. A signal changes nothing in the game's prices or rewards.",
    see: (host) => `# the 402 and its header
curl -i ${host}/desk/signal

# buy it from a purse (repository, scripts/)
npm run desk:buy -- --relayer ${host}
→ signal bought for 0.01 wNEAR  tx …`,
  },
  "/passport/proof": {
    kicker: "passport proof",
    sells: "a signed statement of one Passport as the chain holds it — sealed or not, level, stamps, quests completed — signed with the relayer's key, which is an access key on chain, so anyone checks it with the public key alone.",
    see: (host) => `# the 402 and its header
curl -i "${host}/passport/proof?accountId=<learner account>"

# buy and verify it from a purse (repository, scripts/)
npm run desk:buy -- --relayer ${host} --proof <learner account>
→ verifies here with the public key alone: true`,
  },
  "/sponsor/quest": {
    kicker: "sponsored slot",
    sells: "today's sponsored quest slot on the map: one a day, the first payment wins it. The sponsor's quest passes the same validator as the daily quest and is seeded on chain with the sponsor's name and the payment's transaction; the reward is the contract's, never the sponsor's.",
    see: (host) => `# is today's slot open?
curl -s ${host}/sponsor/today

# the 402 (or 403 when the slot is taken)
curl -i -X POST ${host}/sponsor/quest

# buy it from a purse (repository, scripts/)
npm run sponsor:buy -- --relayer ${host} \\
  --name "…" --url https://… --quest q.json
→ slot bought for 0.5 wNEAR  tx …`,
  },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Shell comments grey, the "→ …" result line lime; everything escaped first. */
function pre(text: string): string {
  return text.split("\n").map((l) => (l.startsWith("#") ? `<span class="c">${esc(l)}</span>` : l.startsWith("→") ? `<span class="c">→ </span><span class="l">${esc(l.slice(2))}</span>` : esc(l))).join("\n");
}

const CSS = `:root{--navy:#0B1322;--panel:#16243A;--line:#24364F;--cream:#F6F3EC;--muted:#A9B4C6;--lime:#D4F033;--purple:#B47FF0}
*{box-sizing:border-box}body{margin:0;background:var(--navy);color:var(--cream);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:56px 20px 64px}
.brand{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:15px;letter-spacing:.02em}.brand b{color:var(--cream);font-size:17px;letter-spacing:.04em}
.brand .dot{width:8px;height:8px;border-radius:50%;background:var(--lime);box-shadow:0 0 12px var(--lime)}
h1{margin:28px 0 6px;font-size:34px;line-height:1.15;letter-spacing:-.01em}h1 .code{color:var(--lime);font-variant-numeric:tabular-nums}
.sub{margin:0 0 28px;color:var(--muted)}
.price{display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:22px}
.price div{min-width:0}.price .k{color:var(--muted);font-size:12px;letter-spacing:.08em;text-transform:uppercase}
.price .v{font-family:ui-monospace,"JetBrains Mono",Menlo,Consolas,monospace;font-size:15px;word-break:break-all}.price .v.big{font-size:26px;color:var(--lime);font-weight:600}
p{margin:0 0 14px}h2{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--purple);margin:30px 0 10px}
pre{margin:0 0 10px;background:#070C16;border:1px solid var(--line);border-radius:10px;padding:12px 14px;overflow:auto;font:13px/1.5 ui-monospace,"JetBrains Mono",Menlo,Consolas,monospace;color:var(--cream)}
pre .c{color:var(--muted)}pre .l{color:var(--lime)}
a{color:var(--lime);text-decoration:none;border-bottom:1px solid rgba(212,240,51,.35)}a:hover{border-bottom-color:var(--lime)}
footer{margin-top:36px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:13px;display:flex;flex-wrap:wrap;gap:8px 18px}
@media(max-width:520px){h1{font-size:28px}.price{grid-template-columns:1fr}main{padding-top:40px}}`;

/** The page for one 402: pure, from the PaymentRequired the header carries. */
export function paywallHtml(pr: PaymentRequired): string {
  const url = new URL(pr.resource.url);
  const host = `${url.protocol}//${url.host}`;
  const route = ROUTES[url.pathname] ?? { kicker: "desk", sells: pr.resource.description ?? "what the chain already holds, sold per request.", see: (h: string) => `curl -i ${h}${url.pathname}` };
  const a: PaymentRequirements | undefined = pr.accepts[0];
  const price = a ? fmt(BigInt(a.amount)) : "—";
  const status = pr.error === "permit2_allowance_required" ? 412 : 402;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${status} Payment Required · Bloqvia ${esc(route.kicker)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
  <div class="brand"><span class="dot"></span><b>Bloqvia</b><span>· ${esc(route.kicker)}</span></div>

  <h1><span class="code">${status}</span> Payment Required</h1>
  <p class="sub">This is a thing for sale, priced per request over x402 on NEAR. The price is in this reply's <code>PAYMENT-REQUIRED</code> header, and below.</p>

  <div class="price">
    <div><div class="k">Price</div><div class="v big">${esc(price)}</div></div>
    <div><div class="k">Pay to</div><div class="v">${esc(a?.payTo ?? "—")}</div></div>
    <div><div class="k">Network</div><div class="v">${esc(a?.network ?? "—")}</div></div>
    <div><div class="k">Token</div><div class="v">${esc(a?.asset ?? "—")} (NEP-141)</div></div>
  </div>

  <p><b>What it sells:</b> ${esc(route.sells)}</p>
  <p><b>This page asks nothing of you.</b> The buyer is a program: it reads the header, signs a wrapped-NEAR transfer from its purse and asks again; the relayer settles the payment and pays the gas. Bloqvia's three NPC traders do exactly that, from purses whose rules they cannot change.</p>

  <h2>See it</h2>
  <pre>${pre(route.see(host))}</pre>

  <h2>Read more</h2>
  <p><a href="${README_DESK}">README · C. The market desk — x402 on NEAR</a> &nbsp;·&nbsp; <a href="https://bloqvia.app">bloqvia.app</a></p>

  <footer><span>x402 v${pr.x402Version} · scheme <code>${esc(a?.scheme ?? "exact")}</code></span><span>facilitator: the relayer, ${esc(a?.payTo ?? "")}</span><span>NEAR testnet only</span></footer>
</main>
</body>
</html>
`;
}
