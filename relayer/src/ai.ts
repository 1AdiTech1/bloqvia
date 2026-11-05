/**
 * NEAR AI Cloud client (OpenAI-compatible) with signature capture.
 *
 * Every completion keeps the exact request and response bytes so the reply's
 * signature can be fetched (`GET /v1/signature/<id>`) and later verified by
 * anyone: the signed text is `<model>:<sha256(request)>:<sha256(response)>`
 * for a model running in a NEAR TEE (`provider_tee`), or
 * `<sha256(request)>:<sha256(response)>` for a gateway-signed reply.
 * See https://docs.near.ai/cloud/verification.
 *
 * No model output ever reaches a reward: this module only produces text.
 */
import { createHash } from "node:crypto";

export interface AiConfig {
  apiKey: string;
  baseUrl: string; // https://cloud-api.near.ai/v1
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Signature {
  text: string;
  signature: string;
  signing_address: string;
  signing_algo: string;
  signature_kind: "provider_tee" | "gateway" | string;
}

export interface Completion {
  id: string;
  model: string;
  content: string;
  requestSha256: string;
  responseSha256: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  /** `stop` is the healthy value; `length` means the answer was cut off by max_tokens. */
  finishReason?: string;
  /** Characters of hidden reasoning the model produced (0 when thinking is off). */
  reasoningChars: number;
  /** Filled by `fetchSignature`; null when the gateway reports none. */
  signature: Signature | null;
}

export interface ChatOptions {
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  maxTokens?: number;
  temperature?: number;
  /**
   * Reasoning models (Qwen3.6, GLM-5.1) think before answering and that
   * thinking eats the token budget. `false` sends
   * `chat_template_kwargs.enable_thinking=false` (NEAR AI docs: reasoning-models).
   */
  thinking?: boolean;
  /** For models that only take a dial (GLM-5.3 Flash, GPT-OSS): "low" | "medium" | "high". */
  reasoningEffort?: "low" | "medium" | "high";
}

/**
 * Pull the JSON object out of a reply: drops any `<think>…</think>` block a
 * model wrote into `content` and trims prose around the outermost `{…}`.
 */
export function extractJson(content: string): string {
  const noThink = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const start = noThink.indexOf("{");
  const end = noThink.lastIndexOf("}");
  return start >= 0 && end > start ? noThink.slice(start, end + 1) : noThink;
}

const sha256 = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");

export function aiConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AiConfig | null {
  const apiKey = env.NEAR_AI_API_KEY?.trim();
  if (!apiKey) return null;
  return { apiKey, baseUrl: (env.NEAR_AI_BASE_URL ?? "https://cloud-api.near.ai/v1").replace(/\/$/, "") };
}

/**
 * One chat completion. `jsonSchema` switches on structured output so the
 * model must answer with JSON matching the schema.
 */
export async function chat(cfg: AiConfig, model: string, messages: ChatMessage[], opts: ChatOptions = {}): Promise<Completion> {
  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.jsonSchema) {
    body.response_format = { type: "json_schema", json_schema: { name: opts.jsonSchema.name, schema: opts.jsonSchema.schema, strict: true } };
  }
  if (opts.thinking === false) body.chat_template_kwargs = { enable_thinking: false };
  if (opts.reasoningEffort) body.reasoning_effort = opts.reasoningEffort;
  const raw = JSON.stringify(body);
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
      // The signature covers these exact bytes; no compression, no model aliasing.
      "Accept-Encoding": "identity",
      "x-no-aliasing": "true",
    },
    body: raw,
  });
  const rawRes = Buffer.from(await res.arrayBuffer());
  if (!res.ok) throw new Error(`NEAR AI ${res.status}: ${rawRes.toString("utf8").slice(0, 300)}`);
  const json = JSON.parse(rawRes.toString("utf8")) as {
    id: string;
    model: string;
    choices: { finish_reason?: string; message: { content: string | null; reasoning_content?: string | null } }[];
    usage?: Completion["usage"];
  };
  const choice = json.choices?.[0];
  const content = choice?.message?.content ?? "";
  const reasoningChars = choice?.message?.reasoning_content?.length ?? 0;
  const finishReason = choice?.finish_reason;
  if (!content) {
    throw new Error(`NEAR AI returned an empty message (finish_reason=${finishReason ?? "?"}, reasoning=${reasoningChars} chars; pass thinking:false or raise max_tokens)`);
  }
  return {
    id: json.id,
    model: json.model,
    content,
    requestSha256: sha256(raw),
    responseSha256: sha256(rawRes),
    usage: json.usage,
    finishReason,
    reasoningChars,
    signature: null,
  };
}

/** Fetch the reply's signature; the gateway may need a moment, so retry briefly. */
export async function fetchSignature(cfg: AiConfig, completion: Completion, algo = "ecdsa"): Promise<Signature | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(`${cfg.baseUrl}/signature/${encodeURIComponent(completion.id)}?signing_algo=${algo}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    });
    if (res.status === 404) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) return null;
    const sig = (await res.json()) as Signature & { error_code?: string; message?: string };
    if (sig.error_code) return null;
    return { text: sig.text, signature: sig.signature, signing_address: sig.signing_address, signing_algo: sig.signing_algo, signature_kind: sig.signature_kind };
  }
  return null;
}

/**
 * Does the signed text match what we sent and received? This is the local
 * half of verification (the other half, checking the signer against the TEE
 * attestation, is what the Verification Center does for the reader).
 */
export function signatureMatches(completion: Completion, sig: Signature): boolean {
  const expected =
    sig.signature_kind === "provider_tee"
      ? `${completion.model}:${completion.requestSha256}:${completion.responseSha256}`
      : `${completion.requestSha256}:${completion.responseSha256}`;
  return sig.text === expected;
}
