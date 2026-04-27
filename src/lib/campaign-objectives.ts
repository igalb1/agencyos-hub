import type { Platform } from './types';

export type CampaignObjective =
  | 'leads'
  | 'sales'
  | 'video'
  | 'awareness'
  | 'traffic'
  | 'engagement'
  | 'app'
  | 'other';

export const ALL_OBJECTIVES: CampaignObjective[] = [
  'leads', 'sales', 'video', 'awareness', 'traffic', 'engagement', 'app', 'other',
];

const LABELS: Record<CampaignObjective, { he: string; en: string; icon: string }> = {
  leads:      { he: 'לידים',     en: 'Leads',       icon: '🎯' },
  sales:      { he: 'מכירות',    en: 'Sales',       icon: '🛒' },
  video:      { he: 'וידאו',     en: 'Video',       icon: '🎬' },
  awareness:  { he: 'חשיפות',    en: 'Awareness',   icon: '📢' },
  traffic:    { he: 'תנועה',     en: 'Traffic',     icon: '🌐' },
  engagement: { he: 'מעורבות',   en: 'Engagement',  icon: '💬' },
  app:        { he: 'אפליקציה',  en: 'App',         icon: '📱' },
  other:      { he: 'אחר',       en: 'Other',       icon: '⚙️' },
};

export function objectiveLabel(o: CampaignObjective, lang: 'he' | 'en'): string {
  return LABELS[o]?.[lang] ?? o;
}

export function objectiveIcon(o: CampaignObjective): string {
  return LABELS[o]?.icon ?? '⚙️';
}

/**
 * Heuristic auto-detection of campaign objective from name + platform.
 * Returns null if nothing strongly matches (caller should default to 'leads').
 */
export function detectObjective(name: string, platform: Platform): CampaignObjective | null {
  const n = (name || '').toLowerCase();

  // Hebrew + English keyword maps (order matters — most specific first)
  const rules: Array<[CampaignObjective, RegExp]> = [
    ['video',      /\b(video|views?|vv|youtube|tvc|reel|reels|shorts)\b|וידאו|וידיאו|צפיות|צפיה/],
    ['sales',      /\b(sales?|purchase|conversion|conversions|roas|ecom|ecommerce|shop|checkout|revenue)\b|מכירות|מכירה|רכישה|רכישות|הכנסות/],
    ['leads',      /\b(lead|leads|leadgen|lead[\s-]?gen|signup|signups|register|registration|form)\b|לידים|ליד|הרשמה|הרשמות|טופס/],
    ['app',        /\b(app|install|installs|appinstall|mai|app[\s-]?promo)\b|אפליקציה|התקנה|התקנות/],
    ['engagement', /\b(engagement|engage|likes?|follow|followers|comments?|share|shares)\b|מעורבות|לייקים|עוקבים|תגובות|שיתוף/],
    ['traffic',    /\b(traffic|clicks?|visit|visits|landing|lp)\b|תנועה|קליקים|ביקורים|לדף|לאתר/],
    ['awareness',  /\b(awareness|reach|brand|impressions?|cpm|branding)\b|חשיפה|חשיפות|מודעות|מותג|ברנדינג/],
  ];

  for (const [obj, re] of rules) {
    if (re.test(n)) return obj;
  }

  // Platform fallbacks (still null = unknown, but give weak hints)
  if (platform === 'LinkedIn') return 'leads'; // B2B default
  return null;
}

/** Number formatter that doesn't append currency, used for non-money metrics like views/impressions. */
function fmtBig(n: number): string {
  if (!isFinite(n)) return '—';
  return Math.round(n).toLocaleString();
}

function fmtMoney(n: number): string {
  if (!isFinite(n)) return '—';
  return `₪${Math.round(n).toLocaleString()}`;
}

function fmtMoney2(n: number): string {
  if (!isFinite(n)) return '—';
  return `₪${n.toFixed(2)}`;
}

export interface ObjectiveMetric {
  /** Headline value displayed in the cell (e.g. "₪32"). */
  primary: string;
  /** Short label below the value (e.g. "CPL"). */
  label: string;
  /** Secondary value (e.g. count of leads/sales/views). */
  secondary?: string;
  /** Long tooltip explaining the calculation. */
  tooltip: string;
}

export interface CampaignMetricsInput {
  spend: number;
  leads: number;
  conversions: number;
  impressions: number;
  clicks: number;
}

/**
 * Computes the headline metric (primary KPI) for a campaign based on its objective.
 * Examples:
 *   - leads      → CPL + lead count
 *   - sales      → CPA + sales count
 *   - video      → CPV + view count (uses impressions as a proxy when no dedicated view field exists)
 *   - awareness  → CPM + impressions
 */
export function computeObjectiveMetric(
  objective: CampaignObjective,
  m: CampaignMetricsInput,
  lang: 'he' | 'en'
): ObjectiveMetric {
  const he = lang === 'he';

  switch (objective) {
    case 'leads': {
      const cpl = m.leads > 0 ? m.spend / m.leads : null;
      return {
        primary: cpl === null ? '—' : fmtMoney(cpl),
        label: 'CPL',
        secondary: `${fmtBig(m.leads)} ${he ? 'לידים' : 'leads'}`,
        tooltip: he ? 'עלות לליד = הוצאה / לידים' : 'Cost per Lead = spend / leads',
      };
    }
    case 'sales': {
      const cpa = m.conversions > 0 ? m.spend / m.conversions : null;
      return {
        primary: cpa === null ? '—' : fmtMoney(cpa),
        label: 'CPA',
        secondary: `${fmtBig(m.conversions)} ${he ? 'מכירות' : 'sales'}`,
        tooltip: he ? 'עלות לרכישה = הוצאה / מכירות' : 'Cost per Acquisition = spend / sales',
      };
    }
    case 'video': {
      // No dedicated video-views field — use impressions as proxy of plays.
      const views = m.impressions;
      const cpv = views > 0 ? m.spend / views : null;
      return {
        primary: cpv === null ? '—' : fmtMoney2(cpv),
        label: 'CPV',
        secondary: `${fmtBig(views)} ${he ? 'צפיות' : 'views'}`,
        tooltip: he
          ? 'עלות לצפייה = הוצאה / צפיות (משתמש בחשיפות כקירוב לצפיות)'
          : 'Cost per View = spend / views (uses impressions as proxy)',
      };
    }
    case 'awareness': {
      const cpm = m.impressions > 0 ? (m.spend / m.impressions) * 1000 : null;
      return {
        primary: cpm === null ? '—' : fmtMoney2(cpm),
        label: 'CPM',
        secondary: `${fmtBig(m.impressions)} ${he ? 'חשיפות' : 'impressions'}`,
        tooltip: he ? 'עלות ל-1,000 חשיפות = (הוצאה / חשיפות) × 1000' : 'Cost per Mille = (spend / impressions) × 1000',
      };
    }
    case 'traffic': {
      const cpc = m.clicks > 0 ? m.spend / m.clicks : null;
      return {
        primary: cpc === null ? '—' : fmtMoney2(cpc),
        label: 'CPC',
        secondary: `${fmtBig(m.clicks)} ${he ? 'קליקים' : 'clicks'}`,
        tooltip: he ? 'עלות לקליק = הוצאה / קליקים' : 'Cost per Click = spend / clicks',
      };
    }
    case 'engagement': {
      // Use clicks as engagement proxy (likes/comments/shares not modelled separately yet)
      const cost = m.clicks > 0 ? m.spend / m.clicks : null;
      return {
        primary: cost === null ? '—' : fmtMoney2(cost),
        label: he ? 'עלות/אינטראקציה' : 'Cost/Engagement',
        secondary: `${fmtBig(m.clicks)} ${he ? 'אינטראקציות' : 'engagements'}`,
        tooltip: he
          ? 'עלות לאינטראקציה = הוצאה / קליקים (קירוב, אין שדה ייעודי לאינטראקציות)'
          : 'Cost per Engagement = spend / clicks (clicks used as engagement proxy)',
      };
    }
    case 'app': {
      const cpi = m.conversions > 0 ? m.spend / m.conversions : null;
      return {
        primary: cpi === null ? '—' : fmtMoney(cpi),
        label: 'CPI',
        secondary: `${fmtBig(m.conversions)} ${he ? 'התקנות' : 'installs'}`,
        tooltip: he ? 'עלות להתקנה = הוצאה / המרות' : 'Cost per Install = spend / conversions',
      };
    }
    case 'other':
    default: {
      // Generic CPA fallback
      const cpa = m.conversions > 0 ? m.spend / m.conversions : null;
      return {
        primary: cpa === null ? '—' : fmtMoney(cpa),
        label: he ? 'עלות/המרה' : 'Cost/Conv.',
        secondary: `${fmtBig(m.conversions)} ${he ? 'המרות' : 'conv.'}`,
        tooltip: he ? 'עלות להמרה = הוצאה / המרות' : 'Cost per Conversion = spend / conversions',
      };
    }
  }
}