/**
 * Safe arithmetic expression evaluator.
 *
 * Exists specifically so Nibras' own MCP calculator tool (if/when you add
 * chat tools like Webnix's) never uses eval() or new Function() — both are
 * CRITICAL findings in Nibras' own rule engine (see patternRules.ts:
 * 'inj-eval', 'inj-new-function') and automatic App Store rejection risks
 * per your own docs. Don't ship a security scanner that fails its own scan.
 *
 * Supports: + - * / % ( ) and decimals. No variables, no function calls.
 */

type TokenType = 'num' | 'op' | 'lparen' | 'rparen';
interface Token {
  type: TokenType;
  value: string;
}

function tokenize(expr: string): Token[] {
  const re = /\d+\.?\d*|[+\-*/%()]/g;
  const tokens: Token[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr))) {
    const v = m[0];
    if (/^\d/.test(v)) tokens.push({ type: 'num', value: v });
    else if (v === '(') tokens.push({ type: 'lparen', value: v });
    else if (v === ')') tokens.push({ type: 'rparen', value: v });
    else tokens.push({ type: 'op', value: v });
  }
  return tokens;
}

// Precedence-climbing parser — deterministic, no dynamic code execution.
class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  parseExpression(): number {
    let left = this.parseTerm();
    while (this.peek()?.type === 'op' && (this.peek()!.value === '+' || this.peek()!.value === '-')) {
      const op = this.next()!.value;
      const right = this.parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  private parseTerm(): number {
    let left = this.parseFactor();
    while (
      this.peek()?.type === 'op' &&
      (this.peek()!.value === '*' || this.peek()!.value === '/' || this.peek()!.value === '%')
    ) {
      const op = this.next()!.value;
      const right = this.parseFactor();
      if (op === '*') left = left * right;
      else if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        left = left / right;
      } else left = left % right;
    }
    return left;
  }

  private parseFactor(): number {
    const tok = this.peek();
    if (!tok) throw new Error('Unexpected end of expression');

    if (tok.type === 'op' && tok.value === '-') {
      this.next();
      return -this.parseFactor();
    }
    if (tok.type === 'lparen') {
      this.next();
      const val = this.parseExpression();
      if (this.peek()?.type !== 'rparen') throw new Error('Missing closing parenthesis');
      this.next();
      return val;
    }
    if (tok.type === 'num') {
      this.next();
      return parseFloat(tok.value);
    }
    throw new Error('Invalid expression');
  }
}

export function safeEval(expression: string): number {
  const sanitized = String(expression).replace(/[^0-9+\-*/().%\s]/g, '');
  if (!sanitized.trim()) throw new Error('Invalid expression');

  const tokens = tokenize(sanitized);
  if (tokens.length === 0) throw new Error('Invalid expression');

  const parser = new Parser(tokens);
  const result = parser.parseExpression();

  if (!Number.isFinite(result)) throw new Error('Invalid result');
  return result;
}
