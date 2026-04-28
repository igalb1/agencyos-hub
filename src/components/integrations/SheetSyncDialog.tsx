import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, FlaskConical, User, Target, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { useClientSheetSync, type SheetSyncConfig, type SyncFrequency, type SyncMode } from '@/hooks/useClientSheetSync';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config?: SheetSyncConfig | null;
  isRtl: boolean;
}

const SKIP_FIELD = { value: '__skip__', label: { he: '— דלג —', en: '— Skip —' } };

const CLIENT_ONLY_FIELDS = [
  { value: 'name', label: { he: 'שם לקוח', en: 'Client name' } },
  { value: 'client_or_campaign_name', label: { he: 'שם לקוח / קמפיין (עמודה משותפת)', en: 'Client / Campaign name (shared column)' } },
  { value: 'industry', label: { he: 'תחום', en: 'Industry' } },
  { value: 'status', label: { he: 'סטטוס לקוח', en: 'Client status' } },
  { value: 'budget', label: { he: 'תקציב לקוח', en: 'Client budget' } },
  { value: 'color', label: { he: 'צבע', en: 'Color' } },
];

const CAMPAIGN_FIELDS = [
  { value: 'campaign_name', label: { he: 'שם קמפיין', en: 'Campaign name' } },
  { value: 'platform', label: { he: 'פלטפורמה', en: 'Platform' } },
  { value: 'objective', label: { he: 'מטרת קמפיין', en: 'Campaign objective' } },
  { value: 'budget', label: { he: 'תקציב קמפיין', en: 'Campaign budget' } },
  { value: 'spend', label: { he: 'הוצאה', en: 'Spend' } },
  { value: 'impressions', label: { he: 'חשיפות', en: 'Impressions' } },
  { value: 'clicks', label: { he: 'קליקים', en: 'Clicks' } },
  { value: 'leads', label: { he: 'לידים', en: 'Leads' } },
  { value: 'conversions', label: { he: 'המרות', en: 'Conversions' } },
  { value: 'start_date', label: { he: 'תאריך התחלה', en: 'Start date' } },
  { value: 'end_date', label: { he: 'תאריך סיום', en: 'End date' } },
];

const FREQS: { v: SyncFrequency; he: string; en: string }[] = [
  { v: 'manual', he: 'ידני בלבד', en: 'Manual only' },
  { v: 'hourly', he: 'כל שעה', en: 'Hourly' },
  { v: 'every_6_hours', he: 'כל 6 שעות', en: 'Every 6 hours' },
  { v: 'daily', he: 'יומי', en: 'Daily' },
  { v: 'weekly', he: 'שבועי', en: 'Weekly' },
];

export function SheetSyncDialog({ open, onOpenChange, config, isRtl }: Props) {
  const { fetchMetadata, upsertConfig } = useClientSheetSync();

  const [name, setName] = useState(config?.name ?? (isRtl ? 'סנכרון לקוחות' : 'Clients sync'));
  const [urlOrId, setUrlOrId] = useState(config?.spreadsheet_id ?? '');
  const [sheetName, setSheetName] = useState(config?.sheet_name ?? '');
  const [headerRow, setHeaderRow] = useState(config?.header_row ?? 1);
  const [rangeA1, setRangeA1] = useState(config?.range_a1 ?? 'A1:Z1000');
  const [frequency, setFrequency] = useState<SyncFrequency>(config?.frequency ?? 'manual');
  const [syncMode, setSyncMode] = useState<SyncMode>(config?.sync_mode ?? 'flat');
  const [matchField, setMatchField] = useState(config?.match_field ?? 'name');
  const [mapping, setMapping] = useState<Record<string, string>>(config?.column_mapping ?? {});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [preview, setPreview] = useState<
    | { kind: 'client' | 'campaign' | 'skip'; label: string; reason?: string; data: Record<string, any> }[]
    | null
  >(null);
  const [sheets, setSheets] = useState<{ title: string }[]>(
    config?.sheet_name ? [{ title: config.sheet_name }] : []
  );
  const [headers, setHeaders] = useState<string[]>(Object.keys(config?.column_mapping ?? {}));
  const [sample, setSample] = useState<string[][]>([]);
  const [resolvedId, setResolvedId] = useState(config?.spreadsheet_id ?? '');

  const loadSheet = async () => {
    if (!urlOrId.trim()) { toast.error(isRtl ? 'יש להזין קישור או מזהה' : 'Enter URL or ID'); return; }
    setLoading(true);
    try {
      const meta = await fetchMetadata(urlOrId.trim(), sheetName || undefined, headerRow);
      setResolvedId(meta.spreadsheet_id);
      setSheets(meta.sheets);
      const chosen = sheetName || meta.sheets[0]?.title || 'Sheet1';
      setSheetName(chosen);
      setHeaders(meta.headers);
      setSample(meta.sample);
      setPreview(null);
      // Pre-fill mapping by header name match
      const next: Record<string, string> = { ...mapping };
      // Detect potential "name" columns to enable shared-column auto-mapping
      const nameLikeIdx: number[] = [];
      meta.headers.forEach((h) => {
        if (next[h]) return;
        const lc = h.toLowerCase();
        if (/campaign|קמפיין/i.test(lc) && /name|שם/i.test(lc)) next[h] = 'campaign_name';
        else if (/platform|פלטפורמה|מקור/i.test(lc)) next[h] = 'platform';
        else if (/objective|מטרה|יעד/i.test(lc)) next[h] = 'objective';
        else if (/spend|הוצאה|בוזבז/i.test(lc)) next[h] = 'spend';
        else if (/impression|חשיפ/i.test(lc)) next[h] = 'impressions';
        else if (/click|קליק/i.test(lc)) next[h] = 'clicks';
        else if (/lead|ליד/i.test(lc)) next[h] = 'leads';
        else if (/conversion|המר/i.test(lc)) next[h] = 'conversions';
        else if (/start|התחלה/i.test(lc)) next[h] = 'start_date';
        else if (/end|סיום/i.test(lc)) next[h] = 'end_date';
        else if (/client|לקוח|name|שם/i.test(lc)) next[h] = 'name';
        else if (/industry|תחום/i.test(lc)) next[h] = 'industry';
        else if (/status|סטטוס/i.test(lc)) next[h] = 'status';
        else if (/budget|תקציב/i.test(lc)) next[h] = 'budget';
        else if (/color|צבע/i.test(lc)) next[h] = 'color';
      });
      meta.headers.forEach((h) => {
        if (/client|לקוח|name|שם/i.test(h.toLowerCase())) nameLikeIdx.push(meta.headers.indexOf(h));
      });
      // Smart auto: in hierarchical mode with exactly one name-like column AND no campaign_name,
      // promote it to the shared "client_or_campaign_name" target.
      if (syncMode === 'hierarchical') {
        const targets = Object.values(next);
        const nameMappings = Object.entries(next).filter(([, v]) => v === 'name');
        const hasCampaignName = targets.includes('campaign_name');
        if (nameMappings.length === 1 && !hasCampaignName) {
          next[nameMappings[0][0]] = 'client_or_campaign_name';
        }
      }
      setMapping(next);
      toast.success(isRtl ? `נטענו ${meta.headers.length} עמודות` : `Loaded ${meta.headers.length} columns`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const buildPreview = useMemo(() => () => {
    if (headers.length === 0 || sample.length === 0) return null;
    const CLIENT_FIELDS = new Set(['name', 'industry', 'status', 'color', 'budget']);
    const CAMPAIGN_FIELDS = new Set([
      'campaign_name', 'platform', 'objective', 'status', 'budget',
      'spend', 'impressions', 'clicks', 'leads', 'conversions',
      'start_date', 'end_date',
    ]);
    const targetsByIndex = headers.map((h) => mapping[h] ?? null);
    const clientIdx = targetsByIndex.findIndex((t) => t === 'name');
    const campIdx = targetsByIndex.findIndex((t) => t === 'campaign_name');
    const sharedIdx = targetsByIndex.findIndex((t) => t === 'client_or_campaign_name');
    const campaignDataIdx = headers
      .map((h, i) => ({ i, t: mapping[h] }))
      .filter(({ t }) => t && CAMPAIGN_FIELDS.has(t) && t !== 'campaign_name')
      .map(({ i }) => i);

    const out: { kind: 'client' | 'campaign' | 'skip'; label: string; reason?: string; data: Record<string, any> }[] = [];
    const recOf = (row: string[], allowed: Set<string>) => {
      const r: Record<string, any> = {};
      headers.forEach((h, i) => {
        const t = mapping[h];
        if (!t || t === '__skip__' || !allowed.has(t)) return;
        const v = row[i];
        if (v === undefined || v === null || v === '') return;
        r[t] = String(v).trim();
      });
      return r;
    };

    let activeClient: string | null = null;
    for (const row of sample.slice(0, 8)) {
      // FLAT
      if (syncMode === 'flat') {
        const rec = recOf(row, CLIENT_FIELDS);
        if (!rec.name) {
          out.push({ kind: 'skip', label: '—', reason: isRtl ? 'חסר שם לקוח' : 'missing client name', data: {} });
        } else {
          out.push({ kind: 'client', label: rec.name, data: rec });
        }
        continue;
      }

      // HIERARCHICAL — shared column
      if (sharedIdx >= 0 && clientIdx < 0 && campIdx < 0) {
        const name = String(row[sharedIdx] ?? '').trim();
        if (!name) {
          activeClient = null;
          out.push({ kind: 'skip', label: '—', reason: isRtl ? 'שורה ריקה' : 'empty row', data: {} });
          continue;
        }
        const hasCampaign = campaignDataIdx.some((idx) => {
          const v = row[idx]; return v !== undefined && v !== null && String(v).trim() !== '';
        });
        if (!activeClient || !hasCampaign) {
          activeClient = name;
          const rec = recOf(row, CLIENT_FIELDS);
          rec.name = name;
          out.push({ kind: 'client', label: name, data: rec });
        } else {
          const rec = recOf(row, CAMPAIGN_FIELDS);
          delete rec.campaign_name;
          rec.name = name;
          out.push({ kind: 'campaign', label: `${activeClient} / ${name}`, data: rec });
        }
        continue;
      }

      // HIERARCHICAL — separate columns
      const cn = clientIdx >= 0 ? String(row[clientIdx] ?? '').trim() : '';
      const mn = campIdx >= 0 ? String(row[campIdx] ?? '').trim() : '';
      if (cn && !mn) {
        const rec = recOf(row, CLIENT_FIELDS);
        activeClient = cn;
        out.push({ kind: 'client', label: cn, data: rec });
      } else if (mn) {
        if (!activeClient) {
          out.push({ kind: 'skip', label: mn, reason: isRtl ? 'אין הקשר לקוח' : 'no client context', data: {} });
        } else {
          const rec = recOf(row, CAMPAIGN_FIELDS);
          delete rec.campaign_name;
          rec.name = mn;
          out.push({ kind: 'campaign', label: `${activeClient} / ${mn}`, data: rec });
        }
      } else {
        out.push({ kind: 'skip', label: '—', reason: isRtl ? 'אין שם' : 'no name', data: {} });
      }
    }
    return out;
  }, [headers, sample, mapping, syncMode, isRtl]);

  const runDryTest = () => {
    if (headers.length === 0) {
      toast.error(isRtl ? 'יש לטעון את הגיליון תחילה' : 'Load the sheet first');
      return;
    }
    setTesting(true);
    try {
      const rows = buildPreview();
      setPreview(rows);
      const clientCount = rows?.filter((r) => r.kind === 'client').length ?? 0;
      const campCount = rows?.filter((r) => r.kind === 'campaign').length ?? 0;
      toast.success(isRtl
        ? `תצוגה מקדימה: ${clientCount} לקוחות, ${campCount} קמפיינים`
        : `Preview: ${clientCount} clients, ${campCount} campaigns`);
    } finally {
      setTesting(false);
    }
  };

  // Auto-refresh preview whenever mapping/mode/sample changes and a name target exists
  useEffect(() => {
    if (headers.length === 0 || sample.length === 0) return;
    const hasAnyName = Object.values(mapping).some((v) =>
      v === 'name' || v === 'client_or_campaign_name',
    );
    if (!hasAnyName) { setPreview(null); return; }
    setPreview(buildPreview());
  }, [mapping, syncMode, headers, sample, buildPreview]);

  const handleSave = async () => {
    if (!resolvedId) { toast.error(isRtl ? 'יש לטעון את הגיליון תחילה' : 'Load the sheet first'); return; }
    const cleanMapping: Record<string, string> = {};
    Object.entries(mapping).forEach(([k, v]) => {
      if (v && v !== '__skip__') cleanMapping[k] = v;
    });
    if (!Object.values(cleanMapping).includes('name')) {
      // Allow client_or_campaign_name as alternative in hierarchical mode
      if (syncMode === 'hierarchical' && Object.values(cleanMapping).includes('client_or_campaign_name')) {
        // OK — shared column mode
      } else {
        toast.error(isRtl ? 'חובה למפות עמודה ל"שם לקוח"' : 'You must map a column to "Client name"');
        return;
      }
    }
    if (syncMode === 'hierarchical'
      && !Object.values(cleanMapping).includes('campaign_name')
      && !Object.values(cleanMapping).includes('client_or_campaign_name')) {
      toast.error(isRtl
        ? 'במצב היררכי חובה למפות עמודה ל"שם קמפיין" או להשתמש בעמודה משותפת'
        : 'In hierarchical mode you must map a column to "Campaign name" or use a shared column');
      return;
    }
    setSaving(true);
    try {
      await upsertConfig({
        id: config?.id, name, spreadsheet_id: resolvedId,
        sheet_name: sheetName, range_a1: rangeA1, header_row: headerRow,
        column_mapping: cleanMapping, match_field: matchField,
        frequency, sync_mode: syncMode, is_active: true,
      });
      toast.success(isRtl ? 'נשמר' : 'Saved');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>
            {config
              ? (isRtl ? 'עריכת סנכרון Google Sheets' : 'Edit Google Sheets sync')
              : (isRtl ? 'הוספת סנכרון Google Sheets' : 'Add Google Sheets sync')}
          </DialogTitle>
          <DialogDescription>
            {isRtl
              ? 'חבר גיליון Google Sheets שיטען לקוחות לתוך המערכת.'
              : 'Connect a Google Sheet that will sync clients into the system.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>{isRtl ? 'שם להגדרה' : 'Name'}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>{isRtl ? 'מבנה הגיליון' : 'Sheet structure'}</Label>
            <Select value={syncMode} onValueChange={(v) => setSyncMode(v as SyncMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">
                  {isRtl ? 'שורה אחת לכל לקוח (פשוט)' : 'One row per client (flat)'}
                </SelectItem>
                <SelectItem value="hierarchical">
                  {isRtl ? 'כותרת לקוח + שורות קמפיינים מתחתיה (היררכי)' : 'Client header + campaign rows below (hierarchical)'}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isRtl
                ? 'במצב היררכי: שורה שיש בה רק שם לקוח (בלי שם קמפיין) מזוהה ככותרת לקוח, וכל שורה אחריה עם "שם קמפיין" משויכת אליו.'
                : 'Hierarchical: a row with a client name and no campaign name is treated as a client header; following rows with a campaign name are attached to it.'}
            </p>
          </div>

          <div className="space-y-1">
            <Label>{isRtl ? 'קישור גיליון או מזהה' : 'Spreadsheet URL or ID'}</Label>
            <div className="flex gap-2">
              <Input
                value={urlOrId}
                onChange={(e) => setUrlOrId(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
              <Button onClick={loadSheet} disabled={loading} variant="secondary" className="gap-2 shrink-0">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                {isRtl ? 'טען' : 'Load'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isRtl
                ? 'שתף את הגיליון כקריא לחשבון Google המחובר באינטגרציות.'
                : 'Share the sheet as viewer with the Google account linked in connectors.'}
            </p>
          </div>

          {sheets.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>{isRtl ? 'גיליון משנה' : 'Worksheet'}</Label>
                <Select value={sheetName} onValueChange={(v) => { setSheetName(v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sheets.map((s) => (
                      <SelectItem key={s.title} value={s.title}>{s.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{isRtl ? 'שורת כותרות' : 'Header row'}</Label>
                <Input type="number" min={1} value={headerRow}
                  onChange={(e) => setHeaderRow(Math.max(1, Number(e.target.value)))} />
              </div>
              <div className="space-y-1">
                <Label>{isRtl ? 'טווח' : 'Range'}</Label>
                <Input value={rangeA1} onChange={(e) => setRangeA1(e.target.value)} />
              </div>
            </div>
          )}

          {headers.length > 0 && (
            <div className="space-y-2">
              <Label>{isRtl ? 'מיפוי עמודות' : 'Column mapping'}</Label>
              <div className="rounded-md border border-border/60 divide-y divide-border/40">
                {headers.map((h) => (
                  <div key={h} className="grid grid-cols-2 gap-3 items-center p-2">
                    <div className="text-sm">
                      <div className="font-medium truncate">{h || <span className="text-muted-foreground">—</span>}</div>
                      {sample[0]?.[headers.indexOf(h)] && (
                        <div className="text-xs text-muted-foreground truncate">
                          {isRtl ? 'דוגמה: ' : 'Sample: '}{sample[0][headers.indexOf(h)]}
                        </div>
                      )}
                    </div>
                    <Select
                      value={mapping[h] ?? '__skip__'}
                      onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP_FIELD.value}>{SKIP_FIELD.label[isRtl ? 'he' : 'en']}</SelectItem>
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {isRtl ? 'לקוח' : 'Client'}
                        </div>
                        {CLIENT_ONLY_FIELDS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label[isRtl ? 'he' : 'en']}
                          </SelectItem>
                        ))}
                        {syncMode === 'hierarchical' && (
                          <>
                            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground border-t border-border/40 mt-1">
                              {isRtl ? 'קמפיין' : 'Campaign'}
                            </div>
                            {CAMPAIGN_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label[isRtl ? 'he' : 'en']}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{isRtl ? 'התאמה לפי שדה' : 'Match by field'}</Label>
              <Select value={matchField} onValueChange={setMatchField}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">{isRtl ? 'שם לקוח' : 'Client name'}</SelectItem>
                  <SelectItem value="industry">{isRtl ? 'תחום' : 'Industry'}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isRtl ? 'לקוחות קיימים יזוהו ויעודכנו לפי השדה הזה.' : 'Existing clients are matched and updated by this field.'}
              </p>
            </div>
            <div className="space-y-1">
              <Label>{isRtl ? 'תדירות סנכרון אוטומטי' : 'Auto-sync frequency'}</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as SyncFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQS.map((f) => (
                    <SelectItem key={f.v} value={f.v}>{isRtl ? f.he : f.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {preview && (
            <div className="space-y-2">
              <Label>{isRtl ? 'תצוגה מקדימה — סיווג שורות' : 'Preview — row classification'}</Label>
              <p className="text-xs text-muted-foreground">
                {isRtl
                  ? 'כך השורות יפורשו בעת סנכרון. ודא שהסיווג נכון לפני שמירה.'
                  : 'How rows will be parsed during sync. Verify before saving.'}
              </p>
              {preview.length === 0 ? (
                <div className="text-xs text-muted-foreground rounded-md border border-border/60 p-3">
                  {isRtl
                    ? 'אין שורות תקפות. ודא שמופה עמודה ל"שם לקוח" ושיש נתונים בדוגמה.'
                    : 'No valid rows. Make sure a column is mapped to "Client name" and sample has data.'}
                </div>
              ) : (
                <div className="rounded-md border border-border/60 divide-y divide-border/40 text-xs overflow-hidden">
                  {preview.map((row, i) => {
                    const Icon = row.kind === 'client' ? User : row.kind === 'campaign' ? Target : Minus;
                    const tone =
                      row.kind === 'client' ? 'text-primary' :
                      row.kind === 'campaign' ? 'text-[#A78BFA]' :
                      'text-muted-foreground';
                    const bg =
                      row.kind === 'client' ? 'bg-primary/5' :
                      row.kind === 'campaign' ? 'bg-secondary/5 ps-6' :
                      'bg-transparent opacity-60';
                    return (
                      <div key={i} className={`flex items-center gap-2 px-2 py-1.5 ${bg}`}>
                        <Icon size={12} className={tone} />
                        <span className={`uppercase tracking-wide text-[10px] ${tone} shrink-0`}>
                          {row.kind === 'client'
                            ? (isRtl ? 'לקוח' : 'Client')
                            : row.kind === 'campaign'
                              ? (isRtl ? 'קמפיין' : 'Campaign')
                              : (isRtl ? 'דילוג' : 'Skip')}
                        </span>
                        <span className="truncate flex-1">{row.label}</span>
                        {row.reason && (
                          <span className="text-muted-foreground text-[10px] shrink-0">({row.reason})</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {isRtl ? 'ביטול' : 'Cancel'}
          </Button>
          <Button
            variant="outline"
            onClick={runDryTest}
            disabled={testing || headers.length === 0}
            className="gap-2"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
            {isRtl ? 'בדיקה (סימולציה)' : 'Test (dry-run)'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin mr-2" />}
            {isRtl ? 'שמור' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}