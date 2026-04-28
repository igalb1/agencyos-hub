// Auto-computed values for well-known custom columns by name.
// These columns may have been created by the Google Sheets sync, but their
// values are derived live from the campaign + the current date — no DB writes.

import type { Campaign } from './types';

export type AutoColumnKind =
  | 'days_in_month'
  | 'days_remaining'
  | 'optimal_pace'
  | 'projected_spend'
  | 'pacing_status';

const NAME_PATTERNS: Array<{ kind: AutoColumnKind; re: RegExp }> = [
  { kind: 'days_in_month',  re: /^\s*ימים\s*בחודש\s*$|days?\s*in\s*month/i },
  { kind: 'days_remaining', re: /ימים\s*שנותרו|days?\s*remaining|days?\s*left/i },
  { kind: 'optimal_pace',   re: /קצב\s*אופטימלי|optimal\s*pace|daily\s*target/i },
  { kind: 'projected_spend',re: /צפי\s*תקציב|צפי\s*הוצאה|projected\s*spend|forecast/i },
  { kind: 'pacing_status',  re: /סטטוס\s*קצב|מצב\s*קצב|pacing\s*status/i },
];

export function detectAutoColumn(name: string): AutoColumnKind | null {
  for (const { kind, re } of NAME_PATTERNS) if (re.test(name)) return kind;
  return null;
}

function todayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

export function getMonthFacts(now: Date = todayUtc()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = now.getUTCDate();
  const daysElapsed = day; // counting today as elapsed
  const daysRemaining = Math.max(0, daysInMonth - day);
  return { daysInMonth, daysElapsed, daysRemaining };
}

export interface AutoColumnResult {
  display: string;
  /** Optional severity for color coding the cell */
  severity?: 'normal' | 'warn' | 'danger';
  tooltip?: string;
}

const fmtNum = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
const fmtCur = (n: number) => `₪${fmtNum(Math.round(n))}`;

export function computeAutoColumn(
  kind: AutoColumnKind,
  campaign: Pick<Campaign, 'budget' | 'spend'>,
  lang: 'he' | 'en' = 'he',
  now: Date = todayUtc(),
): AutoColumnResult {
  const { daysInMonth, daysElapsed, daysRemaining } = getMonthFacts(now);
  const budget = Number(campaign.budget) || 0;
  const spend = Number(campaign.spend) || 0;

  switch (kind) {
    case 'days_in_month':
      return { display: String(daysInMonth) };
    case 'days_remaining':
      return { display: String(daysRemaining) };
    case 'optimal_pace': {
      if (budget <= 0) return { display: '—' };
      const optimal = budget / daysInMonth;
      return { display: fmtCur(optimal), tooltip: lang === 'he' ? 'הוצאה יומית רצויה' : 'Optimal daily spend' };
    }
    case 'projected_spend': {
      if (daysElapsed <= 0 || spend <= 0) return { display: '—' };
      const projected = (spend / daysElapsed) * daysInMonth;
      const severity: AutoColumnResult['severity'] =
        budget > 0 && projected > budget * 1.10 ? 'danger'
        : budget > 0 && projected < budget * 0.90 ? 'warn'
        : 'normal';
      const ratio = budget > 0 ? Math.round((projected / budget) * 100) : null;
      return {
        display: fmtCur(projected),
        severity,
        tooltip: lang === 'he'
          ? `צפי הוצאה לסוף החודש${ratio !== null ? ` · ${ratio}% מהתקציב` : ''}`
          : `Forecast end-of-month spend${ratio !== null ? ` · ${ratio}% of budget` : ''}`,
      };
    }
    case 'pacing_status': {
      if (budget <= 0 || daysElapsed <= 0 || spend <= 0)
        return { display: lang === 'he' ? 'אין מספיק נתונים' : 'No data' };
      const projected = (spend / daysElapsed) * daysInMonth;
      const ratio = projected / budget;
      if (ratio > 1.10) return {
        display: lang === 'he' ? `חריגה צפויה (+${Math.round((ratio - 1) * 100)}%)` : `Over budget (+${Math.round((ratio - 1) * 100)}%)`,
        severity: 'danger',
      };
      if (ratio < 0.90) return {
        display: lang === 'he' ? `תת־ניצול (-${Math.round((1 - ratio) * 100)}%)` : `Under-pacing (-${Math.round((1 - ratio) * 100)}%)`,
        severity: 'warn',
      };
      return { display: lang === 'he' ? 'בקצב' : 'On track', severity: 'normal' };
    }
  }
}