import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { format, subYears, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { CalendarIcon, ArrowRight, ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CampaignLike {
  id: string;
  clientName: string;
  spend: number;
  budget: number;
  leads: number;
  clicks: number;
  impressions: number;
  conversions: number;
  startDate?: string;
  endDate?: string;
}

interface Props {
  campaigns: CampaignLike[];
  clients: string[];
  isHe: boolean;
}

const overlaps = (cStart: string | undefined, cEnd: string | undefined, from: Date, to: Date) => {
  const s = cStart ? new Date(cStart) : new Date(-8640000000000000);
  const e = cEnd ? new Date(cEnd) : new Date(8640000000000000);
  return s <= to && e >= from;
};

const DAY_MS = 86400000;

/**
 * Returns the fraction of the campaign run that overlaps [from..to].
 * - If campaign has no start AND no end date, returns 1 (counted in full).
 * - If overlapDays / totalDays can be computed, returns that ratio (0..1).
 */
const overlapFraction = (cStart: string | undefined, cEnd: string | undefined, from: Date, to: Date): number => {
  if (!cStart && !cEnd) return 1;
  const s = cStart ? new Date(cStart) : new Date(-8640000000000000);
  const e = cEnd ? new Date(cEnd) : new Date(8640000000000000);
  if (s > to || e < from) return 0;
  const overlapStart = s > from ? s : from;
  const overlapEnd = e < to ? e : to;
  const overlapDays = Math.max(1, Math.round((overlapEnd.getTime() - overlapStart.getTime()) / DAY_MS) + 1);
  // Total run length: if either side missing, fallback to overlap (treat as fully attributed).
  if (!cStart || !cEnd) return 1;
  const totalDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / DAY_MS) + 1);
  return Math.min(1, overlapDays / totalDays);
};

const aggregate = (
  campaigns: CampaignLike[],
  client: string,
  from: Date,
  to: Date,
  proRata: boolean
) => {
  const filtered = campaigns
    .filter((c) => (client === 'all' || c.clientName === client) && overlaps(c.startDate, c.endDate, from, to))
    .map((c) => ({ c, w: proRata ? overlapFraction(c.startDate, c.endDate, from, to) : 1 }));

  const sum = (k: keyof CampaignLike) =>
    filtered.reduce((s, { c, w }) => s + (Number(c[k]) || 0) * w, 0);

  const spend = sum('spend');
  const leads = sum('leads');
  const clicks = sum('clicks');
  const impressions = sum('impressions');
  const conversions = sum('conversions');
  const budget = sum('budget');
  return {
    count: proRata
      ? filtered.reduce((s, { w }) => s + w, 0) // fractional "campaign-equivalents"
      : filtered.length,
    spend, leads, clicks, impressions, conversions, budget,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpl: leads > 0 ? spend / leads : 0,
    cvr: clicks > 0 ? (conversions / clicks) * 100 : 0,
    usage: budget > 0 ? (spend / budget) * 100 : 0,
  };
};

type Stats = ReturnType<typeof aggregate>;

const fmtN = (n: number) => (n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toFixed(0));
const fmtMoney = (n: number) => `$${fmtN(n)}`;
const fmtPct = (n: number) => `${n.toFixed(2)}%`;
const fmtCpx = (n: number) => `$${n.toFixed(2)}`;

const delta = (a: number, b: number) => {
  if (b === 0) return a === 0 ? 0 : 100;
  return ((a - b) / Math.abs(b)) * 100;
};

const DeltaPill = ({ value, invert = false }: { value: number; invert?: boolean }) => {
  const rounded = Math.round(value * 10) / 10;
  const isUp = rounded > 0.05;
  const isDown = rounded < -0.05;
  // For "lower is better" metrics like CPC/CPL, invert color.
  const goodUp = invert ? isDown : isUp;
  const goodDown = invert ? isUp : isDown;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded',
        goodUp && 'bg-emerald-500/15 text-emerald-500',
        goodDown && 'bg-destructive/15 text-destructive',
        !isUp && !isDown && 'bg-muted text-muted-foreground'
      )}
    >
      <Icon size={10} />
      {rounded > 0 ? '+' : ''}{rounded}%
    </span>
  );
};

export function ComparisonPanel({ campaigns, clients, isHe }: Props) {
  const today = new Date();
  // Default A: current month. Default B: same month previous year.
  const defStartA = startOfMonth(today);
  const defEndA = endOfMonth(today);
  const defStartB = startOfMonth(subYears(today, 1));
  const defEndB = endOfMonth(subYears(today, 1));

  const [clientA, setClientA] = useState('all');
  const [clientB, setClientB] = useState('all');
  const [fromA, setFromA] = useState<Date>(defStartA);
  const [toA, setToA] = useState<Date>(defEndA);
  const [fromB, setFromB] = useState<Date>(defStartB);
  const [toB, setToB] = useState<Date>(defEndB);
  const [proRata, setProRata] = useState<boolean>(true);

  const statsA = useMemo(() => aggregate(campaigns, clientA, fromA, toA, proRata), [campaigns, clientA, fromA, toA, proRata]);
  const statsB = useMemo(() => aggregate(campaigns, clientB, fromB, toB, proRata), [campaigns, clientB, fromB, toB, proRata]);

  const applyPreset = (preset: 'yoy_month' | 'mom' | 'qoq' | 'ytd_lytd') => {
    if (preset === 'yoy_month') {
      setFromA(startOfMonth(today)); setToA(endOfMonth(today));
      setFromB(startOfMonth(subYears(today, 1))); setToB(endOfMonth(subYears(today, 1)));
    } else if (preset === 'mom') {
      setFromA(startOfMonth(today)); setToA(endOfMonth(today));
      setFromB(startOfMonth(subMonths(today, 1))); setToB(endOfMonth(subMonths(today, 1)));
    } else if (preset === 'qoq') {
      setFromA(subMonths(today, 3)); setToA(today);
      setFromB(subMonths(today, 6)); setToB(subMonths(today, 3));
    } else if (preset === 'ytd_lytd') {
      const yStart = new Date(today.getFullYear(), 0, 1);
      const lyStart = new Date(today.getFullYear() - 1, 0, 1);
      const lyEnd = subYears(today, 1);
      setFromA(yStart); setToA(today);
      setFromB(lyStart); setToB(lyEnd);
    }
  };

  const Arrow = isHe ? ArrowLeft : ArrowRight;

  const rows: { label: string; key: keyof Stats; format: (n: number) => string; invertDelta?: boolean }[] = [
    { label: isHe ? (proRata ? 'קמפיינים (יחסי)' : 'מס׳ קמפיינים') : (proRata ? 'Campaigns (pro-rata)' : 'Campaigns'), key: 'count', format: (n) => proRata ? n.toFixed(1) : fmtN(n) },
    { label: isHe ? 'הוצאה' : 'Spend', key: 'spend', format: fmtMoney },
    { label: isHe ? 'תקציב' : 'Budget', key: 'budget', format: fmtMoney },
    { label: isHe ? 'ניצול תקציב' : 'Budget usage', key: 'usage', format: (n) => `${n.toFixed(0)}%` },
    { label: isHe ? 'חשיפות' : 'Impressions', key: 'impressions', format: fmtN },
    { label: isHe ? 'קליקים' : 'Clicks', key: 'clicks', format: fmtN },
    { label: isHe ? 'לידים' : 'Leads', key: 'leads', format: fmtN },
    { label: isHe ? 'המרות' : 'Conversions', key: 'conversions', format: fmtN },
    { label: 'CTR', key: 'ctr', format: fmtPct },
    { label: 'CPC', key: 'cpc', format: fmtCpx, invertDelta: true },
    { label: 'CPL', key: 'cpl', format: fmtCpx, invertDelta: true },
    { label: 'CVR', key: 'cvr', format: fmtPct },
  ];

  const PeriodPicker = ({ from, to, onFrom, onTo, label }: {
    from: Date; to: Date; onFrom: (d: Date) => void; onTo: (d: Date) => void; label: string;
  }) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground w-12 shrink-0">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 font-normal">
            <CalendarIcon size={12} />
            {format(from, 'dd/MM/yy')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={from} onSelect={(d) => d && onFrom(d)} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      <Arrow size={12} className="text-muted-foreground" />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 font-normal">
            <CalendarIcon size={12} />
            {format(to, 'dd/MM/yy')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={to} onSelect={(d) => d && onTo(d)} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/50">
      <CardContent className="p-4 space-y-4">
        {/* Presets + Pro-rata toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{isHe ? 'תבניות מהירות:' : 'Quick presets:'}</span>
            <Button size="sm" variant="outline" onClick={() => applyPreset('yoy_month')}>{isHe ? 'חודש נוכחי מול שנה שעברה' : 'This month vs last year'}</Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset('mom')}>{isHe ? 'חודש נוכחי מול חודש קודם' : 'MoM'}</Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset('qoq')}>{isHe ? 'רבעון מול רבעון' : 'QoQ'}</Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset('ytd_lytd')}>{isHe ? 'YTD מול שנה שעברה' : 'YTD vs LYTD'}</Button>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-1.5">
            <Switch id="pro-rata" checked={proRata} onCheckedChange={setProRata} />
            <Label htmlFor="pro-rata" className="text-xs font-medium cursor-pointer">
              {isHe ? 'חישוב יחסי לימים בחפיפה' : 'Pro-rata by overlapping days'}
            </Label>
          </div>
        </div>

        {/* Two side-by-side period+client selectors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15 border-0">A</Badge>
              <Select value={clientA} onValueChange={setClientA}>
                <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isHe ? 'כל הלקוחות' : 'All clients'}</SelectItem>
                  {clients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <PeriodPicker from={fromA} to={toA} onFrom={setFromA} onTo={setToA} label={isHe ? 'תקופה' : 'Period'} />
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline">B</Badge>
              <Select value={clientB} onValueChange={setClientB}>
                <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isHe ? 'כל הלקוחות' : 'All clients'}</SelectItem>
                  {clients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <PeriodPicker from={fromB} to={toB} onFrom={setFromB} onTo={setToB} label={isHe ? 'תקופה' : 'Period'} />
          </div>
        </div>

        {/* Comparison table */}
        <div className="overflow-x-auto rounded-md border border-border/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="py-2 px-3 text-start text-xs font-medium text-muted-foreground">{isHe ? 'מדד' : 'Metric'}</th>
                <th className="py-2 px-3 text-start text-xs font-medium text-primary">
                  A · {clientA === 'all' ? (isHe ? 'הכל' : 'All') : clientA} · {format(fromA, 'dd/MM/yy')}–{format(toA, 'dd/MM/yy')}
                </th>
                <th className="py-2 px-3 text-start text-xs font-medium text-muted-foreground">
                  B · {clientB === 'all' ? (isHe ? 'הכל' : 'All') : clientB} · {format(fromB, 'dd/MM/yy')}–{format(toB, 'dd/MM/yy')}
                </th>
                <th className="py-2 px-3 text-start text-xs font-medium text-muted-foreground">{isHe ? 'שינוי' : 'Change'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const a = statsA[row.key];
                const b = statsB[row.key];
                return (
                  <tr key={row.key} className="border-b border-border/30 hover:bg-muted/10">
                    <td className="py-2 px-3 font-medium text-foreground">{row.label}</td>
                    <td className="py-2 px-3 text-foreground">{row.format(a)}</td>
                    <td className="py-2 px-3 text-muted-foreground">{row.format(b)}</td>
                    <td className="py-2 px-3"><DeltaPill value={delta(a, b)} invert={row.invertDelta} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {isHe
            ? proRata
              ? 'חישוב יחסי פעיל: לכל קמפיין נספר רק החלק היחסי לפי מספר הימים שחופפים לתקופה (למשל קמפיין 30 יום שחופף 10 ימים יתרום שליש מהמדדים שלו). שינוי באחוזים: A מול B. עבור CPC/CPL — ירידה היא חיובית.'
              : 'חישוב יחסי כבוי: כל קמפיין שחופף לתקופה (אפילו ביום אחד) נספר במלואו. שינוי באחוזים: A מול B. עבור CPC/CPL — ירידה היא חיובית.'
            : proRata
              ? 'Pro-rata on: each campaign contributes only the share of its metrics matching its overlapping days with the window. Delta: A vs B. For CPC/CPL a drop is positive.'
              : 'Pro-rata off: any campaign that touches the window is counted in full. Delta: A vs B. For CPC/CPL a drop is positive.'}
        </p>
      </CardContent>
    </Card>
  );
}
