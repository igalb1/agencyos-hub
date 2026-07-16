import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { useOrgData } from '@/hooks/useOrgData';
import { Client } from '@/lib/types';
import { fmtCurrency, fmtNum } from '@/lib/campaign-utils';
import { cn } from '@/lib/utils';
import { Plus, Search, Pencil, Trash2, MoreHorizontal, X, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useEffectivePlan, getPlanClientLimit } from '@/hooks/useEffectivePlan';
import { useNavigate } from 'react-router-dom';

const industries = ['SaaS', 'E-Commerce', 'Health', 'Media', 'Analytics', 'Finance', 'Education', 'Real Estate'];
const defaultColors = ['#00D4FF', '#22C55E', '#A78BFA', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];

export default function ClientsPage() {
  const { lang } = useApp();
  const { plan } = useEffectivePlan();
  const navigate = useNavigate();
  const { clients: dbClients, loaded, upsertClient, deleteClient } = useOrgData();
  const clients = dbClients;
  // local state removed — DB is the source of truth
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);

  const maxClients = getPlanClientLimit(plan);
  const atLimit = clients.length >= maxClients;

  const handleNewClient = () => {
    if (atLimit) {
      setLimitDialogOpen(true);
      return;
    }
    setEditingClient(null);
    setModalOpen(true);
  };

  const filtered = clients.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.industry.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  const handleSave = async (client: Client) => {
    try {
      await upsertClient(client);
      toast.success(
        editingClient
          ? (lang === 'he' ? 'הלקוח עודכן בהצלחה' : 'Client updated successfully')
          : (lang === 'he' ? 'הלקוח נוסף בהצלחה' : 'Client added successfully')
      );
      setModalOpen(false);
      setEditingClient(null);
    } catch (e: any) {
      toast.error(e?.message || (lang === 'he' ? 'שגיאה בשמירת הלקוח' : 'Error saving client'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteClient(id);
      setDeleteConfirm(null);
      toast.success(lang === 'he' ? 'הלקוח נמחק' : 'Client deleted');
    } catch (e: any) {
      toast.error(e?.message || (lang === 'he' ? 'שגיאה במחיקה' : 'Error deleting'));
    }
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setModalOpen(true);
    setOpenMenu(null);
  };

  const totalBudget = filtered.reduce((s, c) => s + c.budget, 0);
  const totalSpend = filtered.reduce((s, c) => s + c.spend, 0);
  const totalLeads = filtered.reduce((s, c) => s + c.leads, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('clients', lang)}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} {lang === 'he' ? 'לקוחות' : 'clients'} · {fmtCurrency(totalBudget)} {t('budget', lang)} · {fmtNum(totalLeads)} {t('leads', lang)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {clients.length}{Number.isFinite(maxClients) ? `/${maxClients}` : ''} {lang === 'he' ? 'לקוחות' : 'clients'}
          </span>
          <button
            onClick={handleNewClient}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {atLimit ? <Lock size={16} /> : <Plus size={16} />}
            {lang === 'he' ? 'לקוח חדש' : 'New Client'}
          </button>
        </div>
      </div>

      {/* Search & Status Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 flex-1 max-w-md">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'he' ? 'חיפוש לקוח...' : 'Search clients...'}
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'paused'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                statusFilter === s ? "bg-primary/15 text-primary border-primary/30" : "bg-muted text-muted-foreground hover:text-foreground border-transparent"
              )}
            >
              {s === 'all' ? (lang === 'he' ? 'הכל' : 'All') : s === 'active' ? (lang === 'he' ? 'פעיל' : 'Active') : (lang === 'he' ? 'מושהה' : 'Paused')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        {/* Desktop Header */}
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_100px_60px] gap-x-4 px-5 py-3 border-b border-border bg-muted/20 text-xs font-medium text-muted-foreground">
          <span>{t('name', lang)}</span>
          <span className="text-end">{lang === 'he' ? 'תחום' : 'Industry'}</span>
          <span className="text-end">{t('budget', lang)}</span>
          <span className="text-end">{t('spend', lang)}</span>
          <span className="text-end">{t('leads', lang)}</span>
          <span className="text-center">{t('status', lang)}</span>
          <span />
        </div>

        <div className="divide-y divide-border/30">
          {filtered.map((client, i) => {
            const spendPct = client.budget > 0 ? Math.min((client.spend / client.budget) * 100, 100) : 0;
            return (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_100px_60px] gap-x-4 px-5 py-4 hover:bg-muted/20 transition-colors items-center"
              >
                {/* Name + avatar */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ backgroundColor: `${client.color}20`, color: client.color }}
                  >
                    {client.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground lg:hidden">{client.industry}</p>
                  </div>
                </div>

                <p className="hidden lg:block text-sm text-foreground/70 text-end">{client.industry}</p>

                <div className="hidden lg:block text-end">
                  <p className="text-sm text-foreground">{fmtCurrency(client.budget)}</p>
                  <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${spendPct}%`, backgroundColor: spendPct > 90 ? '#EF4444' : spendPct > 70 ? '#F59E0B' : '#22C55E' }}
                    />
                  </div>
                </div>

                <p className="hidden lg:block text-sm text-foreground text-end">{fmtCurrency(client.spend)}</p>
                <p className="hidden lg:block text-sm text-foreground text-end">{fmtNum(client.leads)}</p>

                <div className="hidden lg:flex justify-center">
                  <span className={cn(
                    "text-[11px] font-medium px-2.5 py-1 rounded-full",
                    client.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                  )}>
                    {client.status === 'active' ? (lang === 'he' ? 'פעיל' : 'Active') : (lang === 'he' ? 'מושהה' : 'Paused')}
                  </span>
                </div>

                {/* Actions */}
                <div className="hidden lg:flex justify-end relative">
                  <button
                    onClick={() => setOpenMenu(openMenu === client.id ? null : client.id)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  <AnimatePresence>
                    {openMenu === client.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute top-8 end-0 z-20 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[140px]"
                      >
                        <button
                          onClick={() => openEdit(client)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                          <Pencil size={14} />
                          {lang === 'he' ? 'עריכה' : 'Edit'}
                        </button>
                        <button
                          onClick={() => { setDeleteConfirm(client.id); setOpenMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 size={14} />
                          {lang === 'he' ? 'מחיקה' : 'Delete'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Mobile bottom row */}
                <div className="lg:hidden flex items-center justify-between mt-2">
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{fmtCurrency(client.budget)}</span>
                    <span>{fmtCurrency(client.spend)} {t('spend', lang)}</span>
                    <span>{fmtNum(client.leads)} {t('leads', lang)}</span>
                    <span className={client.status === 'active' ? 'text-emerald-400' : 'text-amber-400'}>
                      {client.status === 'active' ? (lang === 'he' ? 'פעיל' : 'Active') : (lang === 'he' ? 'מושהה' : 'Paused')}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(client)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><Pencil size={14} /></button>
                    <button onClick={() => setDeleteConfirm(client.id)} className="p-1.5 rounded-md hover:bg-muted text-destructive"><Trash2 size={14} /></button>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              {lang === 'he' ? 'לא נמצאו לקוחות' : 'No clients found'}
            </div>
          )}
        </div>

        {/* Totals row */}
        {filtered.length > 0 && (
          <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_100px_60px] gap-x-4 px-5 py-3 border-t border-border bg-muted/20 text-sm font-semibold text-foreground">
            <span>{lang === 'he' ? 'סה"כ' : 'Total'}</span>
            <span />
            <span className="text-end">{fmtCurrency(totalBudget)}</span>
            <span className="text-end">{fmtCurrency(totalSpend)}</span>
            <span className="text-end">{fmtNum(totalLeads)}</span>
            <span />
            <span />
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <ClientModal
            lang={lang}
            client={editingClient}
            onSave={handleSave}
            onClose={() => { setModalOpen(false); setEditingClient(null); }}
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

      <AnimatePresence>
        {limitDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setLimitDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                  <Lock size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{lang === 'he' ? 'הגעת למגבלה' : 'Plan limit reached'}</h3>
                  <p className="text-sm text-muted-foreground">
                    {lang === 'he'
                      ? `תוכנית ${plan} תומכת בעד ${maxClients} לקוחות. שדרג כדי להוסיף עוד.`
                      : `Your ${plan} plan allows up to ${maxClients} clients. Upgrade to add more.`}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => { setLimitDialogOpen(false); navigate('/settings'); }}
                  className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                >
                  {lang === 'he' ? 'שדרג תוכנית' : 'Upgrade plan'}
                </button>
                <button
                  onClick={() => setLimitDialogOpen(false)}
                  className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:text-foreground"
                >
                  {lang === 'he' ? 'ביטול' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ClientModal({ lang, client, onSave, onClose }: { lang: string; client: Client | null; onSave: (c: Client) => void; onClose: () => void }) {
  const [name, setName] = useState(client?.name || '');
  const [industry, setIndustry] = useState(client?.industry || industries[0]);
  const [color, setColor] = useState(client?.color || defaultColors[0]);
  const [budget, setBudget] = useState(client?.budget?.toString() || '');
  const [status, setStatus] = useState<'active' | 'paused'>(client?.status || 'active');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error(lang === 'he' ? 'שם הלקוח נדרש' : 'Client name is required'); return; }
    onSave({
      id: client?.id || '',
      name: name.trim(),
      industry,
      color,
      budget: parseFloat(budget) || 0,
      spend: client?.spend || 0,
      leads: client?.leads || 0,
      status,
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
            {client ? (lang === 'he' ? 'עריכת לקוח' : 'Edit Client') : (lang === 'he' ? 'לקוח חדש' : 'New Client')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label={lang === 'he' ? 'שם *' : 'Name *'}>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 ring-primary/40" />
          </Field>

          <Field label={lang === 'he' ? 'תחום' : 'Industry'}>
            <select value={industry} onChange={e => setIndustry(e.target.value)} className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 ring-primary/40 appearance-none">
              {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
            </select>
          </Field>

          <Field label={lang === 'he' ? 'צבע' : 'Color'}>
            <div className="flex gap-2 flex-wrap">
              {defaultColors.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn("w-8 h-8 rounded-lg transition-all", color === c ? "ring-2 ring-primary ring-offset-2 ring-offset-card scale-110" : "hover:scale-105")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </Field>

          <Field label={lang === 'he' ? 'תקציב (₪)' : 'Budget (₪)'}>
            <input type="number" value={budget} onChange={e => setBudget(e.target.value)} className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 ring-primary/40" />
          </Field>

          <Field label={t('status', lang as any)}>
            <div className="flex gap-3">
              {(['active', 'paused'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                    status === s
                      ? s === 'active' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                  )}
                >
                  {s === 'active' ? (lang === 'he' ? 'פעיל' : 'Active') : (lang === 'he' ? 'מושהה' : 'Paused')}
                </button>
              ))}
            </div>
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              {client ? (lang === 'he' ? 'שמירה' : 'Save') : (lang === 'he' ? 'הוספה' : 'Add')}
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
        className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {lang === 'he' ? 'מחיקת לקוח' : 'Delete Client'}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {lang === 'he' ? 'האם אתה בטוח? לא ניתן לבטל פעולה זו.' : 'Are you sure? This action cannot be undone.'}
        </p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors">
            {lang === 'he' ? 'מחק' : 'Delete'}
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
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
