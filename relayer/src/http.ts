/**
 * Minimal HTTP surface on node:http (no framework, nothing to configure).
 *
 *   GET  /health             -> { ok, relayer, core, passport, network }
 *   POST /register           -> { publicKey } | { accountId }   -> RegisterResult
 *   POST /relay              -> { payload: <base64 SignedDelegate> } -> RelayResult
 *   GET  /quests             -> every lesson with its public text (bonus quests carry the AI signature)
 *   POST /admin/quest        -> { date?: "YYYY-MM-DD" } + header x-admin-token -> generate + seed now, then post the day's bounty
 *   POST /ask                -> { question, lessonId?, accountId? } -> { answer, generated_by }  (Ask Bloq, grounded, signed)
 *   GET  /market             -> price snapshots (48 h), the NPC trader's last move and rules, the fast-forward's state
 *   GET  /seat?accountId=&daoPublicKey= -> { graduate, founder, canVote }: the account's seats on the cohort DAO
 *   POST /register           -> { publicKey, daoPublicKey? } (the second key is the Passport's vote, limited to the DAO)
 *   POST /propose            -> a founder's bounty proposal, signed with the second key; filed on the DAO (propose.ts)
 *   POST /fastforward        -> start "a day of trading in a minute" (six scripted learners); 429 with nextAt when gated
 *
 * Wrap `handle()` in a Vercel/Netlify function if you host it serverless.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { registerExistingAccount, registerLearner } from "./accounts.js";
import { DailyCap, PolicyError, RateLimiter } from "./policy.js";
import { relay } from "./relay.js";
import { generateDailyQuest } from "./quests.js";
import { syncDailyBounty } from "./bounties.js";
import { getSnapshots, latest } from "./market.js";
import { traderState, RULES } from "./trader.js";
import { ffState, startFastForward, FF } from "./fastforward.js";
import { reconcileSeats, seatsOf } from "./seats.js";
import { hasKey } from "./accounts.js";
import { propose, type ProposeBody } from "./propose.js";
import { createAskBloq, type AskBloq } from "./ask.js";
import { view, type NearContext } from "./near.js";

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (Number(req.headers["content-length"] ?? 0) > 64 * 1024) throw new PolicyError("Body too large", 413);
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.length > 64 * 1024) throw new PolicyError("Body too large", 413);
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

/** Exact origins, "*", or wildcard subdomains written as https://*.lovable.app */
export function originAllowed(origin: string, allowed: string[]): boolean {
  return allowed.some((a) => {
    if (a === "*" || a === origin) return true;
    if (a.includes("://*.")) {
      const [scheme, host] = a.split("://*.");
      return origin.startsWith(`${scheme}://`) && origin.endsWith(`.${host}`);
    }
    return false;
  });
}

function send(res: ServerResponse, status: number, body: unknown, origin: string | undefined, allowed: string[]): void {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (origin && originAllowed(origin, allowed)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS";
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

let askBloq: AskBloq | null = null;

/** The client's address: the first hop of x-forwarded-for behind Railway's proxy, else the socket. */
export function clientIp(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

/** Who is asking: the learner account when it looks like one, else the client IP. */
export function askerKey(req: IncomingMessage, accountId: unknown): string {
  if (typeof accountId === "string" && /^[a-z0-9._-]{2,64}\.(testnet|near)$/.test(accountId)) return accountId;
  return `ip:${clientIp(req)}`;
}

/**
 * Abuse limits (Nov 11). The relayer pays for every account it creates (0.01 NEAR funding, two transactions, storage on
 * core and the Passport) and for every call it relays, so the two paid endpoints are limited per client address and
 * registrations per day as well; the per-sender limit in relay.ts stays. Built once per config.
 */
export function makeLimits(l: { registerPerIpPerHour: number; registerPerDay: number; relayPerIpPerMin: number }) {
  return {
    registerIp: new RateLimiter(l.registerPerIpPerHour, 60 * 60_000, `At most ${l.registerPerIpPerHour} new accounts an hour from one address; try again later`),
    registerDay: new DailyCap(l.registerPerDay, "The relayer has created today's share of accounts; tomorrow again"),
    relayIp: new RateLimiter(l.relayPerIpPerMin, 60_000, "Too many calls from one address, slow down"),
  };
}
let limits: ReturnType<typeof makeLimits> | null = null;

export async function handle(ctx: NearContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = req.headers.origin;
  const allowed = ctx.config.corsOrigins;
  try {
    if (req.method === "OPTIONS") return send(res, 204, {}, origin, allowed);
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, {
        ok: true,
        network: ctx.config.network,
        relayer: ctx.config.relayerAccountId,
        core: ctx.config.coreContractId,
        passport: ctx.config.passportContractId,
        ai: ctx.config.ai ? { questModel: ctx.config.ai.questModel, chatModel: ctx.config.ai.chatModel } : null,
      }, origin, allowed);
    }

    if (req.method === "GET" && url.pathname === "/market") {
      const t = traderState(), ff = ffState();
      return send(res, 200, {
        now: Date.now(),
        snapshots: getSnapshots(),
        latest: latest(),
        trader: { accountId: t.accountId, on: t.on, mind: t.mind, last: t.last, lastThought: t.lastThought, lastTick: t.lastTick, note: t.note, rules: { sellAbove: (t.lines?.sellAbove ?? 0n).toString(), buyBelow: (t.lines?.buyBelow ?? 0n).toString(), band: RULES.band.toString(), keepGold: RULES.keepGold.toString(), keepItems: RULES.keepItems.toString(), intervalMin: RULES.intervalMin } },
        fastForward: { ...ff, players: FF.players, everyMin: FF.everyMin },
      }, origin, allowed);
    }

    if (req.method === "POST" && url.pathname === "/fastforward") {
      try {
        const s = startFastForward(ctx);
        return send(res, 202, { started: true, rounds: s.rounds, players: FF.players, nextAt: s.nextAt }, origin, allowed);
      } catch (e) {
        return send(res, 429, { error: (e as Error).message, nextAt: ffState().nextAt }, origin, allowed);
      }
    }

    if (req.method === "GET" && url.pathname === "/quests") {
      const lessons = await view<unknown[]>(ctx, ctx.config.coreContractId, "get_lessons_with_text");
      return send(res, 200, { lessons }, origin, allowed);
    }

    if (req.method === "POST" && url.pathname === "/admin/quest") {
      if (!ctx.config.adminToken || req.headers["x-admin-token"] !== ctx.config.adminToken) throw new PolicyError("Forbidden", 403);
      if (!ctx.config.ai) throw new PolicyError("NEAR_AI_API_KEY is not set", 503);
      const body = await readJson(req);
      const date = typeof body.date === "string" ? new Date(`${body.date}T12:00:00Z`) : new Date();
      if (Number.isNaN(date.getTime())) throw new PolicyError("date must be YYYY-MM-DD");
      const result = await generateDailyQuest(ctx, ctx.config.ai, ctx.config.ai.questModel, date);
      const bounty = await syncDailyBounty(ctx, date);
      return send(res, 200, { ...result, bounty }, origin, allowed);
    }

    if (req.method === "POST" && url.pathname === "/ask") {
      if (!ctx.config.ai) throw new PolicyError("Ask Bloq is off: NEAR_AI_API_KEY is not set", 503);
      askBloq ??= createAskBloq(ctx, ctx.config.ai, ctx.config.ai.chatModel, { dailyCap: ctx.config.ai.askDailyCap });
      const body = await readJson(req);
      const result = await askBloq.ask(
        { question: body.question as string, lessonId: typeof body.lessonId === "string" ? body.lessonId : undefined },
        askerKey(req, body.accountId),
      );
      return send(res, 200, result, origin, allowed);
    }

    if (req.method === "GET" && url.pathname === "/seat") {
      const accountId = url.searchParams.get("accountId") ?? "", publicKey = url.searchParams.get("daoPublicKey");
      if (!accountId) throw new PolicyError("Send ?accountId=");
      const [policy, canVote] = await Promise.all([reconcileSeats(ctx, accountId), publicKey ? hasKey(ctx, accountId, publicKey) : Promise.resolve(false)]);
      return send(res, 200, { daoId: ctx.config.daoId, ...seatsOf(policy, accountId), canVote }, origin, allowed);
    }

    if (req.method === "POST" && url.pathname === "/propose") {
      const body = (await readJson(req)) as unknown as ProposeBody;
      const result = await propose(ctx, body);
      return send(res, 200, result, origin, allowed);
    }

    if (req.method === "POST" && url.pathname === "/register") {
      limits ??= makeLimits(ctx.config.limits);
      limits.registerIp.check(clientIp(req));
      limits.registerDay.take();
      const body = await readJson(req);
      const started = Date.now();
      let result;
      if (typeof body.publicKey === "string") result = await registerLearner(ctx, body.publicKey, typeof body.daoPublicKey === "string" ? body.daoPublicKey : undefined);
      else if (typeof body.accountId === "string") result = await registerExistingAccount(ctx, body.accountId);
      else throw new PolicyError("Send { publicKey } or { accountId }");
      console.log(`[relayer] register ${result.accountId} created=${result.created} registered=${result.registered} ${Date.now() - started}ms`);
      return send(res, 200, result, origin, allowed);
    }

    if (req.method === "POST" && url.pathname === "/relay") {
      limits ??= makeLimits(ctx.config.limits);
      limits.relayIp.check(clientIp(req));
      const body = await readJson(req);
      if (typeof body.payload !== "string") throw new PolicyError("Send { payload: <base64> }");
      const started = Date.now();
      const result = await relay(ctx, body.payload);
      console.log(`[relayer] relay ${result.senderId} ${result.methods.join(",")} tx=${result.txHash} ${Date.now() - started}ms`);
      return send(res, 200, result, origin, allowed);
    }

    return send(res, 404, { error: "Not found" }, origin, allowed);
  } catch (e) {
    const status = e instanceof PolicyError ? e.status : 500;
    const message = (e as Error).message ?? String(e);
    if (status === 500) console.error(`[relayer] ${req.method} ${req.url} failed:`, e);
    else console.log(`[relayer] ${req.method} ${req.url} rejected ${status}: ${message}`);
    return send(res, status, { error: message }, origin, allowed);
  }
}

export function startServer(ctx: NearContext): ReturnType<typeof createServer> {
  const server = createServer((req, res) => void handle(ctx, req, res));
  server.listen(ctx.config.port, () => {
    console.log(`[relayer] ${ctx.config.relayerAccountId} on ${ctx.config.network} listening on :${ctx.config.port}`);
    console.log(`[relayer] core=${ctx.config.coreContractId} passport=${ctx.config.passportContractId}`);
  });
  return server;
}
