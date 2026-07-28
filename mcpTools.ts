/**
 * MCP tool executor for Nibras' chat/assist surface (if you add one on top
 * of Guard/Vault modes, following the Webnix pattern). Calculator uses
 * safeEval — deliberately NOT eval()/new Function() — see safeEval.ts header.
 */
import { safeEval } from '../rules/safeEval';

export interface McpToolDef {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export const NIBRAS_MCP_TOOLS: McpToolDef[] = [
  {
    name: 'calculator',
    description: 'Evaluate a math expression. Use for any arithmetic or percentage calculation.',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: "Math expression e.g. '(15 * 8) / 3 + 12'" },
      },
      required: ['expression'],
    },
  },
  {
    name: 'get_datetime',
    description: 'Get the current date, time, or day of week.',
    parameters: {
      type: 'object',
      properties: {
        format: { type: 'string', description: "'full', 'date', 'time', or 'day'" },
      },
      required: ['format'],
    },
  },
  {
    name: 'severity_summary',
    description: 'Summarize scan findings by severity for the current project.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];

export async function executeNibrasTool(
  name: string,
  args: Record<string, any>,
  ctx: { getSeveritySummary?: () => Record<string, number> } = {}
): Promise<string> {
  try {
    switch (name) {
      case 'calculator': {
        const result = safeEval(args.expression || '');
        return `${args.expression} = ${result}`;
      }
      case 'get_datetime': {
        const now = new Date();
        const fmt = args.format || 'full';
        if (fmt === 'date') return now.toLocaleDateString();
        if (fmt === 'time') return now.toLocaleTimeString();
        if (fmt === 'day') return now.toLocaleDateString(undefined, { weekday: 'long' });
        return now.toLocaleString();
      }
      case 'severity_summary': {
        const counts = ctx.getSeveritySummary?.();
        if (!counts) return 'No scan results available yet.';
        return Object.entries(counts)
          .map(([sev, n]) => `${sev}: ${n}`)
          .join(', ');
      }
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (e: any) {
    return `Tool error: ${e.message}`;
  }
}
