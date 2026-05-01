import type { QASectionDef } from '@/types/qa';

export const QA_DEFAULT_SECTIONS: QASectionDef[] = [
  {
    id: 'creative',
    title: 'קריאטיב ומדיה',
    icon: '🎨',
    colorVar: 'qa-creative',
    scope: 'ad',
    items: [
      { id: 'c1', text: 'מידות תמונה/וידאו מתאימות לפלייסמנט (1080x1080, 1080x1920, 1200x628)', priority: 'critical' },
      { id: 'c2', text: 'Advantage+ Creative — Flexible Media מכובה (אם לא רלוונטי)', priority: 'critical' },
      { id: 'c3', text: 'Advantage+ Creative — Standard Enhancements מכובה (בהירות, ניגודיות, תבניות)', priority: 'high' },
      { id: 'c4', text: 'Preview נבדק בכל הפלייסמנטים: Feed, Stories, Reels, Right Column', priority: 'critical' },
      { id: 'c5', text: 'טקסט במודעה לא חתוך בשום פלייסמנט', priority: 'critical' },
      { id: 'c6', text: 'לוגו ומיתוג מופיעים נכון', priority: 'high' },
      { id: 'c7', text: 'וידאו — סאבטיטלים תקינים (אם רלוונטי)', priority: 'medium' },
      { id: 'c8', text: 'Carousel — סדר הכרטיסים נכון', priority: 'medium' },
    ],
  },
  {
    id: 'copy',
    title: 'קופי ותוכן',
    icon: '✍️',
    colorVar: 'qa-copy',
    scope: 'ad',
    items: [
      { id: 'co1', text: 'Primary Text — ללא שגיאות כתיב', priority: 'critical' },
      { id: 'co2', text: 'Headline — תואם למסר ולדף הנחיתה', priority: 'critical' },
      { id: 'co3', text: 'Description — ממלא ולא ריק', priority: 'high' },
      { id: 'co4', text: 'CTA Button — נכון (Learn More / Sign Up / Contact Us וכו׳)', priority: 'critical' },
      { id: 'co5', text: 'מספרי טלפון / כתובות — מאומתים', priority: 'critical' },
      { id: 'co6', text: 'אין תוכן מלקוח אחר (קופי פייסט בטעות)', priority: 'critical' },
    ],
  },
  {
    id: 'targeting',
    title: 'קהלי יעד וטרגוט',
    icon: '🎯',
    colorVar: 'qa-targeting',
    scope: 'campaign',
    items: [
      { id: 't1', text: 'קהל יעד מוגדר נכון (גיל, מגדר, מיקום)', priority: 'critical' },
      { id: 't2', text: 'Advantage+ Audience — מודעות למצב (פתוח/סגור)', priority: 'high' },
      { id: 't3', text: 'Lookalike/Custom Audience — נכון ועדכני', priority: 'high' },
      { id: 't4', text: 'Exclusions — מוגדרים (לקוחות קיימים, רוכשים)', priority: 'high' },
      { id: 't5', text: 'שפת קהל — תואמת לשפת המודעה', priority: 'critical' },
      { id: 't6', text: 'Placements — ידני או Advantage+ (בהתאם לאסטרטגיה)', priority: 'medium' },
    ],
  },
  {
    id: 'budget',
    title: 'תקציב ותזמון',
    icon: '💰',
    colorVar: 'qa-budget',
    scope: 'campaign',
    items: [
      { id: 'b1', text: 'תקציב יומי / כולל — תואם לתוכנית', priority: 'critical' },
      { id: 'b2', text: 'תאריך התחלה — נכון', priority: 'critical' },
      { id: 'b3', text: 'תאריך סיום — מוגדר (אם רלוונטי)', priority: 'high' },
      { id: 'b4', text: 'Bid Strategy — נכונה (Lowest Cost / Cost Cap / Bid Cap)', priority: 'high' },
      { id: 'b5', text: 'Ad Scheduling — מוגדר אם נדרש', priority: 'medium' },
      { id: 'b6', text: 'תקציב לא חורג מהמסגרת החודשית של הלקוח', priority: 'critical' },
    ],
  },
  {
    id: 'tracking',
    title: 'מעקב וטראקינג',
    icon: '📊',
    colorVar: 'qa-tracking',
    scope: 'campaign',
    items: [
      { id: 'tr1', text: 'Pixel — מחובר ופעיל', priority: 'critical' },
      { id: 'tr2', text: 'Conversion Event — נכון (Lead / Purchase / ViewContent)', priority: 'critical' },
      { id: 'tr3', text: 'UTM Parameters — מוגדרים ותקינים', priority: 'high' },
      { id: 'tr4', text: 'URL דף נחיתה — תקין ונטען (בדיקת 404)', priority: 'critical' },
      { id: 'tr5', text: 'Conversion API (CAPI) — מחובר', priority: 'high' },
      { id: 'tr6', text: 'Attribution Window — מוגדר נכון', priority: 'medium' },
    ],
  },
  {
    id: 'final',
    title: 'בדיקה סופית',
    icon: '✅',
    colorVar: 'qa-final',
    scope: 'ad',
    items: [
      { id: 'f1', text: 'Campaign Name — תואם לקונבנציית השמות', priority: 'high' },
      { id: 'f2', text: 'Ad Set Name — תואם לקונבנציה', priority: 'high' },
      { id: 'f3', text: 'Ad Name — תואם לקונבנציה', priority: 'medium' },
      { id: 'f4', text: 'Campaign Objective — נכון', priority: 'critical' },
      { id: 'f5', text: 'הקמפיין ב-Draft — לא פורסם בטעות', priority: 'critical' },
      { id: 'f6', text: 'אישור מנהל/לקוח התקבל (אם נדרש)', priority: 'critical' },
    ],
  },
];

export function computeProgress(
  sections: QASectionDef[],
  checked: Record<string, boolean>,
): { progress: number; criticalComplete: boolean; criticalDone: number; criticalTotal: number; total: number; done: number } {
  let total = 0;
  let done = 0;
  let criticalTotal = 0;
  let criticalDone = 0;
  sections.forEach((s) =>
    s.items.forEach((it) => {
      total++;
      if (it.priority === 'critical') criticalTotal++;
      if (checked[it.id]) {
        done++;
        if (it.priority === 'critical') criticalDone++;
      }
    }),
  );
  return {
    progress: total === 0 ? 0 : Math.round((done / total) * 100),
    criticalComplete: criticalTotal === 0 || criticalDone === criticalTotal,
    criticalDone,
    criticalTotal,
    total,
    done,
  };
}

export const QA_PRIORITY_LABEL: Record<'critical' | 'high' | 'medium', string> = {
  critical: 'קריטי',
  high: 'גבוה',
  medium: 'בינוני',
};

export const QA_PLATFORM_LABEL: Record<'meta' | 'google' | 'tiktok', string> = {
  meta: 'Meta Ads',
  google: 'Google Ads',
  tiktok: 'TikTok Ads',
};