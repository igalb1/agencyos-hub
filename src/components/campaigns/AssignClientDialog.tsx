import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrgData } from '@/hooks/useOrgData';
import { Campaign } from '@/lib/types';
import { Lang } from '@/lib/i18n';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign | null;
  lang: Lang;
  onSaved: () => void;
}

export default function AssignClientDialog({ open, onOpenChange, campaign, lang, onSaved }: Props) {
  const { clients, projects, refresh } = useOrgData() as any;
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'select' | 'new'>('select');
  const [newClientName, setNewClientName] = useState('');

  useEffect(() => {
    if (campaign) {
      setClientId(campaign.clientId || '');
      setProjectId(campaign.projectId || '');
      setMode('select');
      setNewClientName(campaign.name || '');
    }
  }, [campaign]);

  const filteredProjects = projects.filter(p => p.clientId === clientId);

  const handleSave = async () => {
    if (!campaign) return;
    setSaving(true);
    try {
      let finalClientId = clientId;
      if (mode === 'new') {
        const name = newClientName.trim();
        if (!name) {
          toast.error(lang === 'he' ? 'יש להזין שם לקוח' : 'Please enter a client name');
          setSaving(false);
          return;
        }
        // Resolve org via existing campaign row
        const { data: campRow, error: campErr } = await supabase
          .from('campaigns').select('organization_id').eq('id', campaign.id).single();
        if (campErr) throw campErr;
        const { data: created, error: createErr } = await supabase
          .from('clients')
          .insert({ organization_id: campRow.organization_id, name, status: 'active' })
          .select('id')
          .single();
        if (createErr) throw createErr;
        finalClientId = created.id;
      } else if (!finalClientId) {
        toast.error(lang === 'he' ? 'יש לבחור לקוח' : 'Please select a client');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('campaigns')
        .update({ client_id: finalClientId, project_id: mode === 'new' ? null : (projectId || null) })
        .eq('id', campaign.id);
      if (error) throw error;
      toast.success(lang === 'he' ? 'הקמפיין שויך בהצלחה' : 'Campaign linked successfully');
      if (typeof refresh === 'function') { try { await refresh(); } catch (_) {} }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || (lang === 'he' ? 'שגיאה בשיוך' : 'Error linking'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {lang === 'he' ? 'שיוך קמפיין ללקוח' : 'Link Campaign to Client'}
          </DialogTitle>
        </DialogHeader>
        {campaign && (
          <div className="space-y-4 mt-2">
            <div className="text-sm text-muted-foreground">
              {lang === 'he' ? 'קמפיין:' : 'Campaign:'} <span className="text-foreground font-medium">{campaign.name}</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={mode === 'select' ? 'default' : 'outline'} onClick={() => setMode('select')}>
                {lang === 'he' ? 'בחר קיים' : 'Select existing'}
              </Button>
              <Button type="button" size="sm" variant={mode === 'new' ? 'default' : 'outline'} onClick={() => setMode('new')}>
                {lang === 'he' ? 'הוסף לקוח חדש' : 'Add new client'}
              </Button>
            </div>
            {mode === 'select' ? (
              <div className="space-y-1.5">
                <Label>{lang === 'he' ? 'לקוח' : 'Client'}</Label>
                <Select value={clientId} onValueChange={v => { setClientId(v); setProjectId(''); }}>
                  <SelectTrigger><SelectValue placeholder={lang === 'he' ? 'בחר לקוח' : 'Select client'} /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>{lang === 'he' ? 'שם לקוח חדש' : 'New client name'}</Label>
                <Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder={lang === 'he' ? 'לדוגמה: שם החשבון בגוגל' : 'e.g. Google account name'} />
              </div>
            )}
            {mode === 'select' && (
            <div className="space-y-1.5">
              <Label>{lang === 'he' ? 'פרויקט (אופציונלי)' : 'Project (optional)'}</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={!clientId || filteredProjects.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={
                    !clientId
                      ? (lang === 'he' ? 'בחר לקוח קודם' : 'Select client first')
                      : filteredProjects.length === 0
                        ? (lang === 'he' ? 'אין פרויקטים ללקוח' : 'No projects for client')
                        : (lang === 'he' ? 'בחר פרויקט' : 'Select project')
                  } />
                </SelectTrigger>
                <SelectContent>
                  {filteredProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {lang === 'he' ? 'ביטול' : 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? (lang === 'he' ? 'שומר...' : 'Saving...')
              : (lang === 'he' ? 'שמור' : 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}