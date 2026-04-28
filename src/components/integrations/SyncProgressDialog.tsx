import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Loader2, Plus, RefreshCw, Minus, AlertTriangle, FileSpreadsheet, Eye } from 'lucide-react';
import { useClientSheetSync, type SyncStreamEvent, type SheetSyncConfig } from '@/hooks/useClientSheetSync';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  configId: string | null;
  configName: string;
  isRtl: boolean;
}

interface LogLine {
  key: string;
  icon: 'create' | 'update' | 'skip' | 'error' | 'info';
  text: string;
  detail?: string;
}

export function SyncProgressDialog({ open, onOpenChange, configId, configName, isRtl }: Props) {
  const { runSyncStream, fetchMetadata, configs } = useClientSheetSync();
  const [stage, setStage] = useState<'idle' | 'preview' | 'running' | 'success' | 'error'>('idle');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    sheetName: string;
    headerRow: number;
    rangeA1: string;
    headers: string[];
    sample: string[][];
    mapping: Record<string, string>;
    syncMode: 'flat' | 'hierarchical';
  } | null>(null);
  const [stageLabel, setStageLabel] = useState<string>('');
  const [total, setTotal] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [counts, setCounts] = useState({ created: 0, updated: 0, skipped: 0, failed: 0 });
  const [lines, setLines] = useState<LogLine[]>([]);
  const [doneError, setDoneError] = useState<string | null>(null);
  const startedRef = useRef<string | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // When opened: load preview (do NOT auto-sync)
  useEffect(() => {
    if (!open || !configId) return;
    if (startedRef.current === configId) return;
    startedRef.current = configId;

    const cfg: SheetSyncConfig | undefined = configs.find((c) => c.id === configId);
    if (!cfg) return;

    setStage('preview');
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);
    setStageLabel('');
    setTotal(0); setProcessed(0);
    setCounts({ created: 0, updated: 0, skipped: 0, failed: 0 });
    setLines([]);
    setDoneError(null);

    fetchMetadata(cfg.spreadsheet_id, cfg.sheet_name, cfg.header_row)
      .then((meta) => {
        setPreviewData({
          sheetName: meta.sheet_name || cfg.sheet_name,
          headerRow: meta.effective_header_row ?? cfg.header_row,
          rangeA1: meta.effective_range_a1 ?? cfg.range_a1,
          headers: meta.headers,
          sample: meta.sample.slice(0, 5),
          mapping: cfg.column_mapping,
          syncMode: cfg.sync_mode,
        });
      })
      .catch((err) => {
        setPreviewError(err instanceof Error ? err.message : 'Failed to load preview');
      })
      .finally(() => setPreviewLoading(false));
  }, [open, configId, configs, fetchMetadata]);

  const startSync = () => {
    if (!configId) return;
    setStage('running');
    setStageLabel(isRtl ? 'מתחיל…' : 'Starting…');

    const handle = (evt: SyncStreamEvent) => {
      if (evt.type === 'stage') {
        const map: Record<string, { he: string; en: string }> = {
          loading_config: { he: 'טוען הגדרות…', en: 'Loading configuration…' },
          fetching_sheet: { he: 'מושך נתונים מהגיליון…', en: 'Fetching sheet data…' },
          empty: { he: 'הגיליון ריק', en: 'Sheet is empty' },
        };
        const lbl = map[evt.stage]?.[isRtl ? 'he' : 'en'] ?? evt.stage;
        setStageLabel(lbl);
        setLines((prev) => [...prev, {
          key: `s-${prev.length}`, icon: 'info',
          text: lbl, detail: evt.sheet,
        }]);
      } else if (evt.type === 'rows_read') {
        setTotal(evt.total);
        setStageLabel(isRtl ? `מעבד ${evt.total} שורות…` : `Processing ${evt.total} rows…`);
        setLines((prev) => [...prev, {
          key: `r-${prev.length}`, icon: 'info',
          text: isRtl ? `נקראו ${evt.total} שורות נתונים` : `Read ${evt.total} data rows`,
          detail: isRtl ? `כותרות: ${evt.headers.join(', ')}` : `Headers: ${evt.headers.join(', ')}`,
        }]);
      } else if (evt.type === 'row') {
        setProcessed((p) => p + 1);
        setCounts((c) => {
          const next = { ...c };
          if (evt.action === 'created') next.created++;
          else if (evt.action === 'updated') next.updated++;
          else if (evt.action === 'skipped') next.skipped++;
          else if (evt.action === 'error') next.failed++;
          return next;
        });
        const iconMap = {
          created: 'create', updated: 'update', skipped: 'skip', error: 'error',
        } as const;
        const verbHe = {
          created: 'נוצר', updated: 'עודכן', skipped: 'דולג', error: 'שגיאה',
        };
        const verbEn = {
          created: 'created', updated: 'updated', skipped: 'skipped', error: 'error',
        };
        const verb = (isRtl ? verbHe : verbEn)[evt.action];
        setLines((prev) => [...prev, {
          key: `row-${evt.row}-${prev.length}`,
          icon: iconMap[evt.action],
          text: isRtl
            ? `שורה ${evt.row}: ${verb}${evt.name ? ` — ${evt.name}` : ''}`
            : `Row ${evt.row}: ${verb}${evt.name ? ` — ${evt.name}` : ''}`,
          detail: evt.error || evt.reason,
        }]);
      } else if (evt.type === 'done') {
        if (evt.success) {
          setStage('success');
          setStageLabel(isRtl ? 'סנכרון הושלם' : 'Sync completed');
          setLines((prev) => [...prev, {
            key: `done-${prev.length}`, icon: 'info',
            text: isRtl
              ? `סיום: ${evt.created ?? 0} נוצרו · ${evt.updated ?? 0} עודכנו · ${evt.skipped ?? 0} דולגו · ${evt.failed ?? 0} שגיאות`
              : `Done: ${evt.created ?? 0} created · ${evt.updated ?? 0} updated · ${evt.skipped ?? 0} skipped · ${evt.failed ?? 0} errors`,
          }]);
        } else {
          setStage('error');
          setDoneError(evt.error ?? 'Unknown error');
          setStageLabel(isRtl ? 'סנכרון נכשל' : 'Sync failed');
          setLines((prev) => [...prev, {
            key: `err-${prev.length}`, icon: 'error',
            text: isRtl ? 'הסנכרון נכשל' : 'Sync failed',
            detail: evt.error,
          }]);
        }
      }
    };

    runSyncStream(configId, handle);
  };

  // Reset start guard when closed
  useEffect(() => {
    if (!open) startedRef.current = null;
  }, [open]);

  // Auto-scroll log to bottom on new lines
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lines.length]);

  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : (stage === 'success' ? 100 : 0);
  const running = stage === 'running';
  const isPreview = stage === 'preview';

  const renderIcon = (kind: LogLine['icon']) => {
    switch (kind) {
      case 'create': return <Plus size={14} className="text-primary shrink-0 mt-0.5" />;
      case 'update': return <RefreshCw size={14} className="text-secondary shrink-0 mt-0.5" />;
      case 'skip':   return <Minus size={14} className="text-muted-foreground shrink-0 mt-0.5" />;
      case 'error':  return <AlertTriangle size={14} className="text-destructive shrink-0 mt-0.5" />;
      default:       return <Loader2 size={14} className="text-muted-foreground shrink-0 mt-0.5" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!running) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPreview ? <Eye size={18} className="text-primary" />
              : stage === 'success' ? <CheckCircle2 size={18} className="text-primary" />
              : stage === 'error' ? <XCircle size={18} className="text-destructive" />
              : <Loader2 size={18} className="animate-spin text-primary" />}
            {isPreview
              ? (isRtl ? 'אישור לפני סנכרון' : 'Confirm before sync')
              : (isRtl ? 'סנכרון Google Sheets' : 'Google Sheets sync')}
          </DialogTitle>
          <DialogDescription className="truncate">{configName}</DialogDescription>
        </DialogHeader>

        {isPreview ? (
          <div className="space-y-4">
            {previewLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 size={16} className="animate-spin" />
                {isRtl ? 'טוען תצוגה מקדימה מהגיליון…' : 'Loading preview from sheet…'}
              </div>
            )}
            {previewError && (
              <div className="text-xs text-destructive p-3 rounded-md bg-destructive/10 border border-destructive/20">
                {previewError}
              </div>
            )}
            {previewData && (
              <>
                <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <FileSpreadsheet size={14} className="text-primary" />
                    {isRtl ? 'גיליון שזוהה' : 'Detected sheet'}: <span className="text-primary">{previewData.sheetName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2">
                    <div>{isRtl ? 'שורת כותרות' : 'Header row'}: <span className="text-foreground tabular-nums">{previewData.headerRow}</span></div>
                    <div>{isRtl ? 'טווח' : 'Range'}: <span className="text-foreground font-mono">{previewData.rangeA1}</span></div>
                    <div>{isRtl ? 'עמודות' : 'Columns'}: <span className="text-foreground tabular-nums">{previewData.headers.length}</span></div>
                    <div>{isRtl ? 'שורות לדוגמה' : 'Sample rows'}: <span className="text-foreground tabular-nums">{previewData.sample.length}</span></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {isRtl ? 'דוגמת שדות ממופים' : 'Mapped fields sample'}
                  </div>
                  {previewData.sample.length === 0 ? (
                    <div className="text-xs text-muted-foreground rounded-md border border-border/60 p-3">
                      {isRtl ? 'אין שורות נתונים בגיליון.' : 'No data rows in the sheet.'}
                    </div>
                  ) : (
                    <div className="rounded-md border border-border/60 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40">
                            <tr>
                              {previewData.headers.map((h, i) => {
                                const target = previewData.mapping[h];
                                const mapped = target && target !== '__skip__';
                                return (
                                  <th key={i} className={`text-start px-2 py-1.5 font-medium border-b border-border/60 whitespace-nowrap ${mapped ? '' : 'opacity-40'}`}>
                                    <div className="truncate max-w-[160px]">{h}</div>
                                    <div className={`text-[10px] font-normal ${mapped ? 'text-primary' : 'text-muted-foreground'}`}>
                                      {mapped ? `→ ${target}` : (isRtl ? '— דילוג —' : '— skip —')}
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.sample.map((row, ri) => (
                              <tr key={ri} className="border-b border-border/30 last:border-0">
                                {previewData.headers.map((h, ci) => {
                                  const mapped = previewData.mapping[h] && previewData.mapping[h] !== '__skip__';
                                  return (
                                    <td key={ci} className={`px-2 py-1.5 align-top whitespace-nowrap ${mapped ? '' : 'opacity-40'}`}>
                                      <div className="truncate max-w-[160px]">{row[ci] ?? ''}</div>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {isRtl
                      ? 'בדוק שהגיליון, שורת הכותרות והשדות הממופים נכונים. עמודות לא ממופות יסומנו עמומות.'
                      : 'Check the sheet, header row and mapped fields are correct. Unmapped columns are dimmed.'}
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{stageLabel}</span>
            {total > 0 && (
              <span className="text-muted-foreground tabular-nums">
                {processed}/{total}
              </span>
            )}
          </div>

          <Progress value={pct} className="h-2" />

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="gap-1">
              <Plus size={11} className="text-primary" />
              {isRtl ? 'נוצרו' : 'Created'}: {counts.created}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <RefreshCw size={11} className="text-secondary" />
              {isRtl ? 'עודכנו' : 'Updated'}: {counts.updated}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Minus size={11} className="text-muted-foreground" />
              {isRtl ? 'דולגו' : 'Skipped'}: {counts.skipped}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <AlertTriangle size={11} className="text-destructive" />
              {isRtl ? 'שגיאות' : 'Errors'}: {counts.failed}
            </Badge>
          </div>

          {doneError && (
            <div className="text-xs text-destructive p-2 rounded-md bg-destructive/10 border border-destructive/20">
              {doneError}
            </div>
          )}

          <div className="rounded-md border border-border/60 bg-muted/20 max-h-72 overflow-y-auto p-2 text-xs font-mono">
            {lines.length === 0 ? (
              <div className="text-muted-foreground p-2">
                {isRtl ? 'ממתין לעדכונים…' : 'Waiting for updates…'}
              </div>
            ) : (
              <ul className="space-y-1">
                {lines.map((l) => (
                  <li key={l.key} className="flex items-start gap-2">
                    {renderIcon(l.icon)}
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{l.text}</div>
                      {l.detail && (
                        <div className="text-[10px] text-muted-foreground truncate">{l.detail}</div>
                      )}
                    </div>
                  </li>
                ))}
                <div ref={logEndRef} />
              </ul>
            )}
          </div>
        </div>
        )}

        <DialogFooter>
          {isPreview ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {isRtl ? 'ביטול' : 'Cancel'}
              </Button>
              <Button
                onClick={startSync}
                disabled={previewLoading || !!previewError || !previewData}
                className="gap-2"
              >
                <RefreshCw size={14} />
                {isRtl ? 'אשר וסנכרן' : 'Confirm & sync'}
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)} disabled={running} variant={stage === 'success' ? 'default' : 'outline'}>
              {running
                ? (isRtl ? 'מסנכרן…' : 'Syncing…')
                : (isRtl ? 'סגור' : 'Close')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
