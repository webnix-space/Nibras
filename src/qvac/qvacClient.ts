/**
 * QVAC inference wrapper for Nibras. Pinned to @qvac/sdk 0.16.0.
 *
 * ⚠️ VERSION RISK, LOGGED PER DISCUSSION: your only proven-working reference
 * (Webnix, in production) is on 0.13.3, not 0.16.0. This file has NOT been
 * device-tested on 0.16.0 — treat every call path below as unverified until
 * you run benchmarkThroughput() on a real device and confirm it doesn't throw.
 *
 * CONFIRMED BREAKING CHANGE (0.13.3 → 0.16.0, from official docs/quickstart):
 *   modelType changed from "llamacpp-completion" to "llm".
 *   Old (Webnix, 0.13.3):  modelType: "llamacpp-completion"
 *   New (0.16.0 docs):     modelType: "llm"
 * Confirmed correct in loadModel() Overload 1 + Expo tutorial example.
 *
 * CONFIRMED CHANGE (this rewrite, v0.16.x API summary):
 *   completion() still returns a run object, but tokenStream / toolCalls /
 *   stats are now DEPRECATED legacy fields that derive internally from the
 *   canonical surfaces: `run.events` (AsyncIterable<CompletionEvent>) and
 *   `run.final` (Promise<CompletionFinal>). Legacy fields still work but
 *   this rewrite moves onto the canonical path per docs guidance, since
 *   building new code on a documented-deprecated surface on day one is a
 *   bad bet with zero local debug loop.
 *
 * FIXED BUG (this rewrite): history was sending system prompt as a second
 * `user` turn instead of `role: 'system'`. Every SDK example (Bare
 * quickstart, Expo tutorial) uses role:'system' for the system message.
 * Silent quality degradation, not a crash — the kind of thing you don't
 * notice until scan explanations are consistently mediocre.
 *
 * UNVERIFIED, CONFIRM ON FIRST DEVICE RUN:
 *   - Exact shape/field names inside `final.stats` at the SDK layer (the
 *     docs only give CompletionStats field names for the OpenAI HTTP
 *     adapter, not the raw SDK `final.stats` object). tokensPerSecond
 *     below is a best-effort read — log the full object on first run and
 *     adjust the field name if it doesn't match.
 *   - Whether skipping close() after unloadModel() leaks the Bare worker
 *     across repeated Guard Mode scans on RN. Lifecycle docs list
 *     loadModel → task → unloadModel → close() as the full flow; we
 *     deliberately skip close() to keep the model warm between scans in a
 *     resident mobile app. Watch memory across a long scan session.
 *
 * MODEL NOTE: Webnix ships Llama 3.2 1B / Qwen3 0.6B — NOT the Qwen 3.2 1B
 * your Business Case throughput number (7-11 t/s) was measured on. That
 * number does not transfer to whichever model Nibras freezes on, and doubly
 * doesn't transfer across an SDK version change. Re-benchmark with
 * benchmarkThroughput() the moment this runs on a real device — non-negotiable
 * before you trust any scan-speed claim in Guard Mode.
 */

let sdk: any = null;
let SDK_OK = true;

try {
  sdk = require('@qvac/sdk');
} catch (e) {
  console.error('[QVAC] load failed:', e);
  SDK_OK = false;
}

export type QvacModelKey = 'llama-1b' | 'qwen-0.6b';

interface ModelDef {
  key: QvacModelKey;
  label: string;
  src: string;
}

// FROZEN model list. Do not add a model picker for Shipaton scope —
// pick one, ship one. Swap the src below to whatever you actually
// bundle/download for Nibras.
const MODELS: ModelDef[] = [
  {
    key: 'llama-1b',
    label: 'Llama 3.2 1B',
    src:
      sdk?.LLAMA_3_2_1B_INST_Q4_0 ||
      'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
  },
  {
    key: 'qwen-0.6b',
    label: 'Qwen3 0.6B',
    src:
      sdk?.QWEN3_600M_INST_Q4 ||
      'https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/main/qwen3-0_6b-q4_k_m.gguf',
  },
];

const ACTIVE_MODEL_KEY: QvacModelKey = 'llama-1b'; // <- the freeze decision lives here

let llmModelId: string | null = null;
let loading = false;

export function isQvacAvailable(): boolean {
  return SDK_OK;
}

export function isModelLoaded(): boolean {
  return !!llmModelId;
}

/**
 * Load the active model. Call once at app start or lazily before first scan.
 */
export async function loadModel(onProgress?: (pct: number) => void): Promise<void> {
  if (!SDK_OK) throw new Error('QVAC SDK not available on this device/build.');
  if (llmModelId || loading) return;
  loading = true;

  try {
    const model = MODELS.find((m) => m.key === ACTIVE_MODEL_KEY)!;
    const id = await sdk.loadModel({
      modelSrc: model.src,
      modelType: 'llm', // 0.16.0: renamed from 'llamacpp-completion' — confirmed correct
      modelConfig: { device: 'cpu', ctx_size: 2048 }, // confirmed shape via LlmLlamacpp config + Expo example
      onProgress: (p: any) => onProgress?.(Math.round(p?.percentage ?? (p ?? 0) * 100)),
    });
    llmModelId = id;
  } finally {
    loading = false;
  }
}

/**
 * Unloads the model. Deliberately does NOT call sdk.close() — see header
 * note. Call close() explicitly at full app teardown if you add that path.
 */
export async function unloadModel(): Promise<void> {
  if (!llmModelId) return;
  await sdk.unloadModel({ modelId: llmModelId, clearStorage: false }).catch(() => {});
  llmModelId = null;
}

export interface QvacToolDef {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface QvacGenerateResult {
  text: string;
  tokensPerSecond: number;
  durationMs: number;
  toolCalls: { name: string; arguments: Record<string, any> }[];
}

/**
 * Run inference. Used for the QVAC deep-scan layer — contextual antipattern
 * review, hallucinated-package reasoning, plain-English explanations —
 * layered ON TOP of the fast regex pass in patternRules.ts, never as the
 * first-pass scan.
 *
 * Rewritten onto the canonical events/final surface (see header). Manual
 * token accumulation via contentDelta events replaces the deprecated
 * tokenStream; final stats/toolCalls come from `run.final`.
 */
export async function generate(
  systemPrompt: string,
  userPrompt: string,
  opts: { tools?: QvacToolDef[]; maxTokens?: number } = {}
): Promise<QvacGenerateResult> {
  if (!llmModelId) throw new Error('QVAC model not loaded — call loadModel() first');

  const t0 = Date.now();
  const run = sdk.completion({
    modelId: llmModelId,
    history: [
      { role: 'system', content: systemPrompt }, // FIXED: was role:'user' — degraded instruction-following
      { role: 'user', content: userPrompt },
    ],
    stream: true,
    tools: opts.tools ?? [],
  });

  let raw = '';
  let deltaTokenCount = 0;

  for await (const event of run.events) {
    // contentDelta is the token-by-token text surface on the new API.
    // toolCall events pass through untouched — final.toolCalls picks them up.
    if (event.type === 'contentDelta') {
      raw += event.text;
      deltaTokenCount++;
    }
  }

  const final = await run.final;
  const durationMs = Date.now() - t0;

  // UNVERIFIED FIELD NAME: docs don't give final.stats' exact shape at the
  // SDK layer (only the HTTP-adapter CompletionStats). Try the documented
  // field name first, fall back to a delta-count/time estimate so this
  // never throws — log the raw object on first device run and correct
  // this fallback chain once you see the real shape.
  const statsAny: any = (final as any)?.stats ?? {};
  const tokensPerSecond =
    typeof statsAny.tokensPerSecond === 'number'
      ? statsAny.tokensPerSecond
      : deltaTokenCount / (durationMs / 1000);

  const toolCallsRaw = (final as any)?.toolCalls ?? [];
  const toolCalls = (Array.isArray(toolCallsRaw) ? toolCallsRaw : []).map((c: any) => ({
    name: c.name ?? c.call?.name,
    arguments: c.arguments || c.input || c.call?.arguments || {},
  }));

  const finalText = ((final as any)?.content ?? raw) as string;

  return {
    text: finalText.replace(/<think>[\s\S]*?<\/think>/g, '').trim(),
    tokensPerSecond,
    durationMs,
    toolCalls,
  };
}

/**
 * Re-test of the throughput number. Run this the moment loadModel() succeeds
 * on a real device and log it — this is the single most important number
 * per the Business Case doc, and it resets every time the model changes.
 *
 * Also log the raw `final.stats` object here on first run — this is your
 * one chance to confirm the tokensPerSecond field name in generate() above
 * before it silently falls back to the estimate.
 */
export async function benchmarkThroughput(): Promise<number> {
  await loadModel();
  const probe = await generate(
    'You are a benchmark probe. Respond with exactly one short sentence.',
    'Say hello.',
    { maxTokens: 32 }
  );
  return probe.tokensPerSecond;
}
