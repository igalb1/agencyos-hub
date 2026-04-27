import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Plus, RefreshCw, Loader2, Trash2, Pencil, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useClientSheetSync, type SheetSyncConfig } from '@/hooks/useClientSheetSync';
import { SheetSyncDialog } from './SheetSyncDialog';

const FREQ_LABEL: Record<string, { he: string; en: string }> = {
  manual: { he: 'ידני בלבד', en: 'Manual only' },
  hourly: { he: 'כל שעה', en: 'Hourly' },
  every_6_hours: { he: 'כל 6 שעות', en: 'Every 6h' },
  daily: { he: 'יומי', en: 'Daily' },
  weekly: { he: 'שבועי', en: 'Weekly' },
};

export function GoogleSheetsCard({ isRtl }: { isRtl: boolean }) {
  const { configs, logs, loading, syncing, runSync, deleteConfig } = useClientSheetSync();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SheetSyncConfig | null>(null);

  const lastLogFor = (cid: string) => logs.find((l) => l.config_id === cid);

  return (
    <>
      <Card className="bg-card/50 backdrop-blur border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText size={18} style={{ color: '#0F9D58' }} />
                {isRtl ? 'סנכרון Google Sheets — לקוחות' : 'Google Sheets Sync — Clients'}
              </CardTitle>
              <CardDescription className="mt-1">
                {isRtl
                  ? 'משוך נתוני לקוחות מגיליון Google Sheets, הגדר מיפוי עמודות ותדירות עדכון.'
                  : 'Pull client data from a Google Sheet, configure column mapping and update frequency.'}
              </CardDescription>
            </div>
            <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus size={14} />
              {isRtl ? 'הוסף גיליון' : 'Add sheet'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : configs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {isRtl
                ? 'עדיין אין גיליונות מחוברים. לחץ "הוסף גיליון" כדי להתחיל.'
                : 'No sheets connected yet. Click "Add sheet" to get started.'}
            </p>
          ) : (
            configs.map((cfg) => {
              const lastLog = lastLogFor(cfg.id);
              return (
                <div key={cfg.id} className="rounded-md border border-border/60 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{cfg.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span className="truncate">{cfg.sheet_name} · {cfg.range_a1}</span>
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Clock size={10} />
                          {(FREQ_LABEL[cfg.frequency] ?? FREQ_LABEL.manual)[isRtl ? 'he' : 'en']}
                        </Badge>
                        {cfg.last_synced_at && (
                          <span>
                            {isRtl ? 'אחרון: ' : 'Last: '}
                            {format(new Date(cfg.last_synced_at), 'dd/MM HH:mm')}
                          </span>
                        )}
                      </div>
                      {lastLog && (
                        <div className="text-xs mt-1">
                          {lastLog.status === 'success' ? (
                            <span className="text-primary">
                              {isRtl
                                ? `${lastLog.clients_created ?? 0} נוצרו · ${lastLog.clients_updated ?? 0} עודכנו`
                                : `${lastLog.clients_created ?? 0} created · ${lastLog.clients_updated ?? 0} updated`}
                            </span>
                          ) : (
                            <span className="text-destructive truncate block">{lastLog.error_message}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="default" className="gap-1" disabled={syncing === cfg.id}
                        onClick={() => runSync(cfg.id)}>
                        {syncing === cfg.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        {isRtl ? 'סנכרן' : 'Sync'}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(cfg); setOpen(true); }}>
                        <Pencil size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive"
                        onClick={() => {
                          if (confirm(isRtl ? 'למחוק את הגדרת הסנכרון?' : 'Delete this sync config?')) {
                            deleteConfig(cfg.id);
                          }
                        }}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {open && (
        <SheetSyncDialog
          open={open}
          onOpenChange={setOpen}
          config={editing}
          isRtl={isRtl}
        />
      )}
    </>
  );
}