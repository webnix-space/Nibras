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
 * Fixed below. If loadModel() throws an unknown-modelType error on-device,
 * this is the first thing to re-check.
 *
 * UNVERIFIED beyond the modelType rename: whether modelConfig shape
 * ({ device, ctx_size }), the tools param on completion(), or run.toolCalls
 * still work identically. Docs samples don't show tools/modelConfig in
 * 0.16 examples — could mean unchanged, could mean undocumented-here.
 * First device run on 0.16 IS the test for this, not this rewrite.
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
      modelType: 'llm', // 0.16.0: renamed from 'llamacpp-completion'
      modelConfig: { device: 'cpu', ctx_size: 2048 }, // UNVERIFIED on 0.16 — confirm on device
      onProgress: (p: any) => onProgress?.(Math.round(p?.percentage ?? (p ?? 0) * 100)),
    });
    llmModelId = id;
  } finally {
    loading = false;
  }
}

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
      { role: 'user', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: true,
    tools: opts.tools ?? [],
  });

  let raw = '';
  let tokens = 0;
  for await (const token of run.tokenStream) {
    raw += token;
    tokens++;
  }

  const toolCalls = (await run.toolCalls?.catch(() => [])) || [];
  const durationMs = Date.now() - t0;
  const tokensPerSecond = tokens / (durationMs / 1000);

  return {
    text: raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim(),
    tokensPerSecond,
    durationMs,
    toolCalls: toolCalls.map((c: any) => ({ name: c.name, arguments: c.arguments || c.input || {} })),
  };
}

/**
 * Re-test of the throughput number. Run this the moment loadModel() succeeds
 * on a real device and log it — this is the single most important number
 * per the Business Case doc, and it resets every time the model changes.
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
