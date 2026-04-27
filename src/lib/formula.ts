// Safe formula evaluator for custom calculated columns.
// Supports: + - * / ( ) numbers and named variables.
// No function calls, no property access, no statements.

export const FORMULA_VARIABLES = [
  'budget',
  'spend',
  'leads',
  'impressions',
  'clicks',
  'conversions',
] as const;

export type FormulaVariable = (typeof FORMULA_VARIABLES)[number];

const TOKEN_RE = /\s*([0-9]+(?:\.[0-9]+)?|[a-zA-Z_][a-zA-Z0-9_]*|[+\-*/()%])\s*/y;

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  let pos = 0;
  while (pos < input.length) {
    TOKEN_RE.lastIndex = pos;
    m = TOKEN_RE.exec(input);
    if (!m || m.index !== pos) throw new Error(`Unexpected character at ${pos}`);
    tokens.push(m[1]);
    pos = TOKEN_RE.lastIndex;
  }
  return tokens;
}

// Recursive-descent parser → evaluator, single pass.
function parse(tokens: string[], vars: Record<string, number>): number {
  let i = 0;
  const peek = () => tokens[i];
  const eat = (t?: string) => {
    const cur = tokens[i];
    if (t !== undefined && cur !== t) throw new Error(`Expected "${t}", got "${cur ?? 'EOF'}"`);
    i++;
    return cur;
  };

  function parseExpr(): number {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = eat();
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }
  function parseTerm(): number {
    let left = parseFactor();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = eat();
      const right = parseFactor();
      if (op === '*') left = left * right;
      else if (op === '/') left = right === 0 ? NaN : left / right;
      else left = right === 0 ? NaN : left % right;
    }
    return left;
  }
  function parseFactor(): number {
    const tok = peek();
    if (tok === undefined) throw new Error('Unexpected end of formula');
    if (tok === '(') {
      eat('(');
      const v = parseExpr();
      eat(')');
      return v;
    }
    if (tok === '-') { eat(); return -parseFactor(); }
    if (tok === '+') { eat(); return parseFactor(); }
    if (/^[0-9]/.test(tok)) { eat(); return Number(tok); }
    if (/^[a-zA-Z_]/.test(tok)) {
      eat();
      if (!(tok in vars)) throw new Error(`Unknown variable: ${tok}`);
      return vars[tok];
    }
    throw new Error(`Unexpected token: ${tok}`);
  }

  const result = parseExpr();
  if (i !== tokens.length) throw new Error(`Unexpected trailing input: "${tokens.slice(i).join(' ')}"`);
  return result;
}

export function evaluateFormula(formula: string, vars: Record<string, number>): number | null {
  if (!formula || !formula.trim()) return null;
  try {
    const tokens = tokenize(formula);
    const v = parse(tokens, vars);
    if (typeof v !== 'number' || !isFinite(v)) return null;
    return v;
  } catch {
    return null;
  }
}

export function validateFormula(formula: string): { ok: boolean; error?: string } {
  if (!formula || !formula.trim()) return { ok: false, error: 'Empty formula' };
  try {
    const tokens = tokenize(formula);
    // Use sample vars (1) so division/parse works.
    const vars: Record<string, number> = {};
    FORMULA_VARIABLES.forEach(v => { vars[v] = 1; });
    parse(tokens, vars);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Invalid formula' };
  }
}