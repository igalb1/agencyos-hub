import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type Step = 'upload' | 'analyzing' | 'review' | 'duplicates' | 'importing' | 'done';
type DupAction = 'skip' | 'update' | 'create';

interface ParsedData {
  clients: any[];
  projects: any[];
  campaigns: any[];
  tasks: any[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function ImportDataDialog({ open, onOpenChange }: Props) {
  const { organization } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [duplicates, setDuplicates] = useState<{ type: string; existing: any; incoming: any }[]>([]);
  const [dupAction, setDupAction] = useState<DupAction>('skip');
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ clients: 0, projects: 0, campaigns: 0, tasks: 0 });

  const reset = () => {
    setStep('upload');
    setFileName('');
    setParsed(null);
    setDuplicates([]);
    setError('');
    setStats({ clients: 0, projects: 0, campaigns: 0, tasks: 0 });
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(reset, 300);
  };

  const parseFile = async (file: File): Promise<any[]> => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => resolve(res.data as any[]),
          error: reject,
        });
      });
    }
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStep('analyzing');
    setError('');

    try {
      const rows = await parseFile(file);
      if (rows.length === 0) throw new Error('הקובץ ריק');

      const { data, error } = await supabase.functions.invoke('ai-import-data', {
        body: { rows },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setParsed(data);

      // Detect duplicates by name (clients only — they're the anchors)
      const { data: existingClients } = await supabase
        .from('clients')
        .select('id, name')
        .eq('organization_id', organization!.id);

      const dups: typeof duplicates = [];
      for (const c of data.clients ?? []) {
        const match = existingClients?.find(
          (x) => x.name.trim().toLowerCase() === c.name?.trim().toLowerCase(),
        );
        if (match) dups.push({ type: 'client', existing: match, incoming: c });
      }

      if (dups.length > 0) {
        setDuplicates(dups);
        setStep('duplicates');
      } else {
        setStep('review');
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'שגיאה בעיבוד הקובץ');
      setStep('upload');
    }
  };

  const handleImport = async () => {
    if (!parsed || !organization) return;
    setStep('importing');
    try {
      const orgId = organization.id;
      const dupClientNames = new Set(
        dupAction === 'skip' ? duplicates.map((d) => d.incoming.name?.trim().toLowerCase()) : [],
      );

      // 1. Insert clients
      const clientsToInsert = (parsed.clients ?? []).filter(
        (c) => c.name && !dupClientNames.has(c.name.trim().toLowerCase()),
      );
      let insertedClients: any[] = [];
      if (clientsToInsert.length > 0) {
        const { data, error } = await supabase
          .from('clients')
          .insert(
            clientsToInsert.map((c) => ({
              organization_id: orgId,
              name: c.name,
              industry: c.industry ?? null,
              budget: c.budget ?? 0,
              spend: c.spend ?? 0,
              leads: c.leads ?? 0,
              status: c.status === 'paused' ? 'paused' : 'active',
            })),
          )
          .select();
        if (error) throw error;
        insertedClients = data ?? [];
      }

      // Build name -> id map (existing + new)
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, name')
        .eq('organization_id', orgId);
      const clientByName = new Map<string, string>();
      (allClients ?? []).forEach((c) => clientByName.set(c.name.trim().toLowerCase(), c.id));

      // 2. Insert projects
      const projectsToInsert = (parsed.projects ?? []).filter((p) => p.name);
      let insertedProjects: any[] = [];
      if (projectsToInsert.length > 0) {
        const { data, error } = await supabase
          .from('projects')
          .insert(
            projectsToInsert.map((p) => ({
              organization_id: orgId,
              client_id: p.client_name
                ? clientByName.get(p.client_name.trim().toLowerCase()) ?? null
                : null,
              name: p.name,
              status: p.status ?? 'active',
              budget: p.budget ?? 0,
              spend: p.spend ?? 0,
              start_date: p.start_date || null,
              end_date: p.end_date || null,
            })),
          )
          .select();
        if (error) throw error;
        insertedProjects = data ?? [];
      }

      const { data: allProjects } = await supabase
        .from('projects')
        .select('id, name')
        .eq('organization_id', orgId);
      const projectByName = new Map<string, string>();
      (allProjects ?? []).forEach((p) => projectByName.set(p.name.trim().toLowerCase(), p.id));

      // 3. Insert campaigns
      const campaignsToInsert = (parsed.campaigns ?? []).filter((c) => c.name);
      let insertedCampaigns: any[] = [];
      if (campaignsToInsert.length > 0) {
        const { data, error } = await supabase
          .from('campaigns')
          .insert(
            campaignsToInsert.map((c) => ({
              organization_id: orgId,
              client_id: c.client_name
                ? clientByName.get(c.client_name.trim().toLowerCase()) ?? null
                : null,
              project_id: c.project_name
                ? projectByName.get(c.project_name.trim().toLowerCase()) ?? null
                : null,
              name: c.name,
              platform: c.platform ?? null,
              status: c.status ?? 'Planned',
              budget: c.budget ?? 0,
              spend: c.spend ?? 0,
              leads: c.leads ?? 0,
              impressions: c.impressions ?? 0,
              clicks: c.clicks ?? 0,
              conversions: c.conversions ?? 0,
              start_date: c.start_date || null,
              end_date: c.end_date || null,
            })),
          )
          .select();
        if (error) throw error;
        insertedCampaigns = data ?? [];
      }

      const { data: allCampaigns } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('organization_id', orgId);
      const campaignByName = new Map<string, string>();
      (allCampaigns ?? []).forEach((c) => campaignByName.set(c.name.trim().toLowerCase(), c.id));

      // 4. Insert tasks
      const tasksToInsert = (parsed.tasks ?? []).filter((t) => t.title);
      let insertedTasks: any[] = [];
      if (tasksToInsert.length > 0) {
        const { data, error } = await supabase
          .from('tasks')
          .insert(
            tasksToInsert.map((t) => ({
              organization_id: orgId,
              client_id: t.client_name
                ? clientByName.get(t.client_name.trim().toLowerCase()) ?? null
                : null,
              project_id: t.project_name
                ? projectByName.get(t.project_name.trim().toLowerCase()) ?? null
                : null,
              campaign_id: t.campaign_name
                ? campaignByName.get(t.campaign_name.trim().toLowerCase()) ?? null
                : null,
              title: t.title,
              description: t.description ?? null,
              status: t.status ?? 'todo',
              priority: t.priority ?? 'medium',
              due_date: t.due_date || null,
              assignee: t.assignee ?? null,
            })),
          )
          .select();
        if (error) throw error;
        insertedTasks = data ?? [];
      }

      setStats({
        clients: insertedClients.length,
        projects: insertedProjects.length,
        campaigns: insertedCampaigns.length,
        tasks: insertedTasks.length,
      });
      setStep('done');
      toast.success('הייבוא הסתיים בהצלחה!');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'שגיאה בייבוא');
      setStep('review');
      toast.error('שגיאה בייבוא: ' + (e.message || ''));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-primary" />
            ייבוא חכם מאקסל / CSV
          </DialogTitle>
          <DialogDescription>
            העלה קובץ והמערכת תזהה אוטומטית לקוחות, פרויקטים, קמפיינים ומשימות
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary hover:bg-muted/30 transition"
            >
              <Upload size={36} className="mx-auto mb-3 text-muted-foreground" />
              <p className="text-foreground font-medium">לחץ כדי לבחור קובץ</p>
              <p className="text-sm text-muted-foreground mt-1">
                Excel (.xlsx, .xls) או CSV — עד 500 שורות
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFile}
            />
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'analyzing' && (
          <div className="py-12 text-center">
            <Loader2 size={36} className="mx-auto mb-3 text-primary animate-spin" />
            <p className="text-foreground font-medium">ה-AI מנתח את הקובץ...</p>
            <p className="text-sm text-muted-foreground mt-1">{fileName}</p>
          </div>
        )}

        {step === 'duplicates' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-500 bg-amber-500/10 p-3 rounded-lg text-sm">
              <AlertCircle size={16} />
              נמצאו {duplicates.length} לקוחות שכבר קיימים במערכת
            </div>
            <ScrollArea className="max-h-40 border border-border rounded-lg p-3">
              <ul className="text-sm space-y-1">
                {duplicates.map((d, i) => (
                  <li key={i} className="text-foreground">• {d.incoming.name}</li>
                ))}
              </ul>
            </ScrollArea>
            <div>
              <Label className="text-sm font-medium mb-2 block">מה לעשות עם הכפילויות?</Label>
              <RadioGroup value={dupAction} onValueChange={(v) => setDupAction(v as DupAction)}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="skip" id="skip" />
                  <Label htmlFor="skip" className="cursor-pointer">דלג — ייבא רק חדשים</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="create" id="create" />
                  <Label htmlFor="create" className="cursor-pointer">צור בכל זאת (יווצרו כפולים)</Label>
                </div>
              </RadioGroup>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>ביטול</Button>
              <Button onClick={() => setStep('review')}>המשך</Button>
            </DialogFooter>
          </div>
        )}

        {step === 'review' && parsed && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">ה-AI זיהה את הפריטים הבאים:</p>
            <div className="grid grid-cols-2 gap-3">
              <PreviewCard label="לקוחות" count={parsed.clients?.length ?? 0} />
              <PreviewCard label="פרויקטים" count={parsed.projects?.length ?? 0} />
              <PreviewCard label="קמפיינים" count={parsed.campaigns?.length ?? 0} />
              <PreviewCard label="משימות" count={parsed.tasks?.length ?? 0} />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>ביטול</Button>
              <Button onClick={handleImport}>ייבא הכל</Button>
            </DialogFooter>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 text-center">
            <Loader2 size={36} className="mx-auto mb-3 text-primary animate-spin" />
            <p className="text-foreground font-medium">מייבא נתונים...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <div className="py-6 text-center">
              <CheckCircle2 size={48} className="mx-auto mb-3 text-green-500" />
              <p className="text-foreground font-medium text-lg">הייבוא הושלם!</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <PreviewCard label="לקוחות נוצרו" count={stats.clients} />
              <PreviewCard label="פרויקטים נוצרו" count={stats.projects} />
              <PreviewCard label="קמפיינים נוצרו" count={stats.campaigns} />
              <PreviewCard label="משימות נוצרו" count={stats.tasks} />
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>סיום</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewCard({ label, count }: { label: string; count: number }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-muted/20">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold text-foreground mt-1">{count}</div>
    </div>
  );
}
