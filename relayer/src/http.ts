/**
 * Minimal HTTP surface on node:http (no framework, nothing to configure).
 *
 *   GET  /health             -> { ok, relayer, core, passport, network }
 *   POST /register           -> { publicKey } | { accountId }   -> RegisterResult
 *   POST /relay              -> { payload: <base64 SignedDelegate> } -> RelayResult
 *   GET  /quests             -> every lesson with its public text (bonus quests carry the AI signature)
 *   POST /admin/quest        -> { date?: "YYYY-MM-DD" } + header x-admin-token -> generate + seed now, then post the day's bounty
 *   POST /ask                -> { question, lessonId?, accountId? } -> { answer, generated_by }  (Ask Bloq, grounded, signed)
 *
 * Wrap `handle()` in a Vercel/Netlify function if you host it serverless.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { registerExistingAccount, registerLearner } from "./accounts.js";
import { PolicyError } from "./policy.js";
import { relay } from "./relay.js";
import { generateDailyQuest } from "./quests.js";
import { syncDailyBounty } from "./bounties.js";
import { createAskBloq, type AskBloq } from "./ask.js";
import { view, type NearContext } from "./near.js";

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
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

/** Who is asking: the learner account when it looks like one, else the client IP. */
export function askerKey(req: IncomingMessage, accountId: unknown): string {
  if (typeof accountId === "string" && /^[a-z0-9._-]{2,64}\.(testnet|near)$/.test(accountId)) return accountId;
  const fwd = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  return `ip:${ip}`;
}

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

    if (req.method === "POST" && url.pathname === "/register") {
      const body = await readJson(req);
      const started = Date.now();
      let result;
      if (typeof body.publicKey === "string") result = await registerLearner(ctx, body.publicKey);
      else if (typeof body.accountId === "string") result = await registerExistingAccount(ctx, body.accountId);
      else throw new PolicyError("Send { publicKey } or { accountId }");
      console.log(`[relayer] register ${result.accountId} created=${result.created} registered=${result.registered} ${Date.now() - started}ms`);
      return send(res, 200, result, origin, allowed);
    }

    if (req.method === "POST" && url.pathname === "/relay") {
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
