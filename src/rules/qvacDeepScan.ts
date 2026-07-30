/**
 * QVAC-powered semantic analysis — the categories regex genuinely cannot
 * detect: null pointer risk, race conditions, performance bottlenecks.
 *
 * Labeled "AI Analysis" in the UI, never merged with pattern-match findings.
 * This is inherently probabilistic — the model can miss things or flag
 * false positives. Don't let UI copy imply certainty this tier doesn't have.
 */

import { generate, isModelLoaded, loadModel, isQvacAvailable } from '../qvac/qvacClient';

export type SemanticCategory = 'null-pointer' | 'race-condition' | 'performance';

export interface SemanticFinding {
  category: SemanticCategory;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  suggestedFix: string;
  lineHint?: string; // model's best-effort line reference, not guaranteed accurate
}

const SYSTEM_PROMPT = `You are a code review assistant analyzing a code snippet for three specific issue types:
1. null-pointer: accessing a property/method on a value that could be null/undefined
2. race-condition: shared state modified without synchronization, or async operations with ordering assumptions that may not hold
3. performance: obvious bottlenecks — O(n^2)+ where better exists, unnecessary re-renders, blocking calls in hot paths

Respond ONLY with a JSON array, no markdown fences, no preamble. Each element:
{"category": "null-pointer"|"race-condition"|"performance", "confidence": "high"|"medium"|"low", "explanation": "one sentence", "suggestedFix": "one sentence", "lineHint": "approximate location or code fragment"}

If you find nothing in a category, omit it. If you find nothing at all, respond with an empty array: []
Do not invent issues that aren't present. Only report what you can actually see in the code.`;

export interface DeepScanResult {
  findings: SemanticFinding[];
  tokensPerSecond: number;
  modelLoadedThisRun: boolean;
}

export async function runSemanticScan(
  code: string,
  onModelLoadProgress?: (pct: number) => void
): Promise<DeepScanResult> {
  if (!isQvacAvailable()) {
    throw new Error('QVAC unavailable on this build.');
  }

  let modelLoadedThisRun = false;
  if (!isModelLoaded()) {
    modelLoadedThisRun = true;
    await loadModel(onModelLoadProgress);
  }

  // Cap input size — this is a code-review pass, not a full-file dump.
  // Long pastes get truncated with a visible note rather than silently
  // failing or blowing the context window.
  const MAX_CHARS = 6000;
  const truncated = code.length > MAX_CHARS;
  const codeForPrompt = truncated ? code.slice(0, MAX_CHARS) : code;

  const userPrompt = `${truncated ? '[Note: code truncated to first 6000 characters]\n\n' : ''}Analyze this code:\n\n${codeForPrompt}`;

  const result = await generate(SYSTEM_PROMPT, userPrompt, { maxTokens: 600 });

  let findings: SemanticFinding[] = [];
  try {
    const cleaned = result.text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      findings = parsed.filter(
        (f) =>
          f &&
          typeof f.category === 'string' &&
          typeof f.explanation === 'string' &&
          ['null-pointer', 'race-condition', 'performance'].includes(f.category)
      );
    }
  } catch {
    // Model didn't return valid JSON — fail to empty rather than crash
    // the scan. The pattern-match findings still stand on their own.
    findings = [];
  }

  return {
    findings,
    tokensPerSecond: result.tokensPerSecond,
    modelLoadedThisRun,
  };
}
