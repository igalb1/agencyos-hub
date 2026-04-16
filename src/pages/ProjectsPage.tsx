import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { mockProjects, mockClients } from '@/lib/mock-data';
import { Project } from '@/lib/types';
import { fmtCurrency } from '@/lib/campaign-utils';
import { cn } from '@/lib/utils';
import { Plus, Search, Pencil, Trash2, X, FolderOpen, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const statusConfig = {
  active: { he: 'פעיל', en: 'Active', cls: 'bg-emerald-500/15 text-emerald-400' },
  planning: { he: 'תכנון', en: 'Planning', cls: 'bg-blue-500/15 text-blue-400' },
  completed: { he: 'הושלם', en: 'Completed', cls: 'bg-muted text-muted-foreground' },
};

export default function ProjectsPage() {
  const { lang } = useApp();
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'planning' | 'completed'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = projects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  // Group by client
  const grouped = filtered.reduce<Record<string, { clientName: string; clientColor: string; projects: Project[] }>>((acc, p) => {
    if (!acc[p.clientId]) {
      const client = mockClients.find(c => c.id === p.clientId);
      acc[p.clientId] = { clientName: p.clientName, clientColor: client?.color || '#00D4FF', projects: [] };
    }
    acc[p.clientId].projects.push(p);
    return acc;
  }, {});

  const handleSave = (project: Project) => {
    if (editingProject) {
      setProjects(prev => prev.map(p => p.id === project.id ? project : p));
      toast.success(lang === 'he' ? 'הפרויקט עודכן בהצלחה' : 'Project updated successfully');
    } else {
      setProjects(prev => [...prev, { ...project, id: crypto.randomUUID() }]);
      toast.success(lang === 'he' ? 'הפרויקט נוסף בהצלחה' : 'Project added successfully');
    }
    setModalOpen(false);
    setEditingProject(null);
  };

  const handleDelete = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setDeleteConfirm(null);
    toast.success(lang === 'he' ? 'הפרויקט נמחק' : 'Project deleted');
  };

  const totalBudget = filtered.reduce((s, p) => s + p.budget, 0);
  const totalSpend = filtered.reduce((s, p) => s + p.spend, 0);
  const totalCampaigns = filtered.reduce((s, p) => s + p.campaigns, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('projects', lang)}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} {lang === 'he' ? 'פרויקטים' : 'projects'} · {totalCampaigns} {lang === 'he' ? 'קמפיינים' : 'campaigns'} · {fmtCurrency(totalBudget)} {t('budget', lang)}
          </p>
        </div>
        <button
          onClick={() => { setEditingProject(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          {lang === 'he' ? 'פרויקט חדש' : 'New Project'}
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 flex-1 max-w-md">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'he' ? 'חיפוש פרויקט או לקוח...' : 'Search project or client...'}
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'planning', 'completed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                statusFilter === s ? "bg-primary/15 text-primary border-primary/30" : "bg-muted text-muted-foreground hover:text-foreground border-transparent"
              )}
            >
              {s === 'all' ? (lang === 'he' ? 'הכל' : 'All') : statusConfig[s][lang]}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Cards */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([clientId, { clientName, clientColor, projects: clientProjects }]) => (
          <div key={clientId} className="space-y-3">
            {/* Client Header */}
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                style={{ backgroundColor: `${clientColor}20`, color: clientColor }}
              >
                {clientName.charAt(0)}
              </div>
              <h2 className="text-base font-semibold text-foreground">{clientName}</h2>
              <span className="text-xs text-muted-foreground">
                {clientProjects.length} {lang === 'he' ? 'פרויקטים' : 'projects'}
              </span>
            </div>

            {/* Project Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clientProjects.map((project, i) => {
                const pct = project.budget > 0 ? Math.min((project.spend / project.budget) * 100, 100) : 0;
                const pctColor = pct > 90 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#22C55E';
                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card rounded-xl p-5 space-y-4 group"
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FolderOpen size={18} className="text-primary shrink-0" />
                        <h3 className="text-sm font-semibold text-foreground truncate">{project.name}</h3>
                      </div>
                      <span className={cn("text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap", statusConfig[project.status].cls)}>
                        {statusConfig[project.status][lang]}
                      </span>
                    </div>

                    {/* Budget bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{t('spend', lang)}</span>
                        <span className="text-foreground font-medium">{fmtCurrency(project.spend)} / {fmtCurrency(project.budget)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: pctColor }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground text-end">{pct.toFixed(0)}%</p>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} />
                        <span>{project.startDate} – {project.endDate}</span>
                      </div>
                      <span>{project.campaigns} {lang === 'he' ? 'קמפיינים' : 'campaigns'}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingProject(project); setModalOpen(true); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-xs transition-colors"
                      >
                        <Pencil size={12} />
                        {lang === 'he' ? 'עריכה' : 'Edit'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(project.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs transition-colors hover:bg-destructive/20"
                      >
                        <Trash2 size={12} />
                        {lang === 'he' ? 'מחיקה' : 'Delete'}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}

        {Object.keys(grouped).length === 0 && (
          <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
            {lang === 'he' ? 'לא נמצאו פרויקטים' : 'No projects found'}
          </div>
        )}
      </div>

      {/* Summary bar */}
      {filtered.length > 0 && (
        <div className="glass-card rounded-xl px-5 py-3 flex flex-wrap gap-6 text-sm">
          <span className="text-muted-foreground">{lang === 'he' ? 'סה"כ' : 'Total'}:</span>
          <span className="text-foreground font-medium">{fmtCurrency(totalBudget)} {t('budget', lang)}</span>
          <span className="text-foreground font-medium">{fmtCurrency(totalSpend)} {t('spend', lang)}</span>
          <span className="text-foreground font-medium">{totalCampaigns} {lang === 'he' ? 'קמפיינים' : 'campaigns'}</span>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <ProjectModal
            lang={lang}
            project={editingProject}
            onSave={handleSave}
            onClose={() => { setModalOpen(false); setEditingProject(null); }}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {deleteConfirm && (
          <ConfirmModal
            lang={lang}
            onConfirm={() => handleDelete(deleteConfirm)}
            onCancel={() => setDeleteConfirm(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProjectModal({ lang, project, onSave, onClose }: { lang: string; project: Project | null; onSave: (p: Project) => void; onClose: () => void }) {
  const [name, setName] = useState(project?.name || '');
  const [clientId, setClientId] = useState(project?.clientId || mockClients[0]?.id || '');
  const [budget, setBudget] = useState(project?.budget?.toString() || '');
  const [status, setStatus] = useState<Project['status']>(project?.status || 'planning');
  const [startDate, setStartDate] = useState(project?.startDate || '');
  const [endDate, setEndDate] = useState(project?.endDate || '');

  const selectedClient = mockClients.find(c => c.id === clientId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error(lang === 'he' ? 'שם הפרויקט נדרש' : 'Project name is required'); return; }
    onSave({
      id: project?.id || '',
      clientId,
      clientName: selectedClient?.name || '',
      name: name.trim(),
      status,
      budget: parseFloat(budget) || 0,
      spend: project?.spend || 0,
      campaigns: project?.campaigns || 0,
      startDate,
      endDate,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {project ? (lang === 'he' ? 'עריכת פרויקט' : 'Edit Project') : (lang === 'he' ? 'פרויקט חדש' : 'New Project')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label={lang === 'he' ? 'שם *' : 'Name *'}>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 ring-primary/40" />
          </Field>

          <Field label={lang === 'he' ? 'לקוח' : 'Client'}>
            <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 ring-primary/40 appearance-none">
              {mockClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <Field label={lang === 'he' ? 'תקציב (₪)' : 'Budget (₪)'}>
            <input type="number" value={budget} onChange={e => setBudget(e.target.value)} className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 ring-primary/40" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={lang === 'he' ? 'תאריך התחלה' : 'Start Date'}>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 ring-primary/40" />
            </Field>
            <Field label={lang === 'he' ? 'תאריך סיום' : 'End Date'}>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 ring-primary/40" />
            </Field>
          </div>

          <Field label={t('status', lang as any)}>
            <div className="flex gap-2 flex-wrap">
              {(['planning', 'active', 'completed'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                    status === s ? statusConfig[s].cls + ' border-current/30' : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                  )}
                >
                  {statusConfig[s][lang]}
                </button>
              ))}
            </div>
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              {project ? (lang === 'he' ? 'שמירה' : 'Save') : (lang === 'he' ? 'הוספה' : 'Add')}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:text-foreground transition-colors">
              {lang === 'he' ? 'ביטול' : 'Cancel'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function ConfirmModal({ lang, onConfirm, onCancel }: { lang: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-foreground font-medium">{lang === 'he' ? 'למחוק את הפרויקט?' : 'Delete this project?'}</p>
        <p className="text-sm text-muted-foreground">{lang === 'he' ? 'לא ניתן לבטל פעולה זו' : 'This action cannot be undone'}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors">
            {lang === 'he' ? 'מחיקה' : 'Delete'}
          </button>
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:text-foreground transition-colors">
            {lang === 'he' ? 'ביטול' : 'Cancel'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
