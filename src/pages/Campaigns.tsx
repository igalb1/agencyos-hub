import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { useOrgData } from '@/hooks/useOrgData';
import { Ad, Campaign, Platform, CampaignStatus } from '@/lib/types';
import NewCampaignDialog from '@/components/campaigns/NewCampaignDialog';
import EditableCell from '@/components/campaigns/EditableCell';
import AssignClientDialog from '@/components/campaigns/AssignClientDialog';
import ManageColumnsDialog from '@/components/campaigns/ManageColumnsDialog';
import { useCustomColumns } from '@/hooks/useCustomColumns';
import { evaluateFormula } from '@/lib/formula';
import { detectAutoColumn, computeAutoColumn } from '@/lib/auto-columns';
import { useCampaignQAStatus } from '@/hooks/useCampaignQAStatus';
import QAStatusCell from '@/components/campaigns/QAStatusCell';
import { toast } from 'sonner';
import { getPlatformColor, getStatusColor, getAdStatusColor, calcPacing, fmtCurrency, fmtNum, calcCtr, calcCpl } from '@/lib/campaign-utils';
import {
  ALL_OBJECTIVES,
  computeObjectiveMetric,
  detectObjective,
  objectiveIcon,
  objectiveLabel,
  type CampaignObjective,
} from '@/lib/campaign-objectives';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ChevronLeft, ChevronRight, Filter, Plus, Search, Image, Video, Trash2, Link2, Settings2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const platformIcons: Record<Platform, string> = {
  Meta: '📘',
  Google: '🔍',
  TikTok: '🎵',
  LinkedIn: '💼',
};

const allPlatforms: Platform[] = ['Meta', 'Google', 'TikTok', 'LinkedIn'];
const allStatuses: CampaignStatus[] = ['Live', 'Planned', 'Paused'];

interface GroupedData {
  clientId: string;
  clientName: string;
  projects: {
    projectId: string;
    projectName: string;
    campaigns: Campaign[];
  }[];
}

function groupCampaigns(campaigns: Campaign[]): GroupedData[] {
  const map = new Map<string, Map<string, Campaign[]>>();
  const clientNames = new Map<string, string>();
  const projectNames = new Map<string, string>();

  for (const c of campaigns) {
    const cid = c.clientId || '__unassigned__';
    const pid = c.projectId || '__no_project__';
    clientNames.set(cid, c.clientId ? c.clientName : '');
    projectNames.set(pid, c.projectId ? c.projectName : '');
    if (!map.has(cid)) map.set(cid, new Map());
    const pm = map.get(cid)!;
    if (!pm.has(pid)) pm.set(pid, []);
    pm.get(pid)!.push(c);
  }

  return Array.from(map.entries()).map(([clientId, projects]) => ({
    clientId,
    clientName: clientNames.get(clientId) || '',
    projects: Array.from(projects.entries()).map(([projectId, campaigns]) => ({
      projectId,
      projectName: projectNames.get(projectId) || '',
      campaigns,
    })),
  }));
}

export default function CampaignsPage() {
  const { lang } = useApp();
  const isRtl = lang === 'he';

  const { campaigns: dbCampaigns, clients: dbClients, loaded, upsertCampaign, updateCampaignField, deleteCampaigns } = useOrgData();
  const campaigns = dbCampaigns;
  void loaded;
  const { columns: customColumns, values: customValues, addColumn, renameColumn, updateFormula, deleteColumn, setValue: setCustomValue } = useCustomColumns();
  const { get: getQAStatus } = useCampaignQAStatus();
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showColumnsDialog, setShowColumnsDialog] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Campaign | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const deleteSelected = async () => {
    const ids = Array.from(selected);
    try {
      await deleteCampaigns(ids);
      toast.success(lang === 'he' ? `${ids.length} קמפיינים נמחקו` : `${ids.length} campaigns deleted`);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message || (lang === 'he' ? 'שגיאה במחיקה' : 'Error deleting'));
    }
  };

  const deleteOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteCampaigns([id]);
      toast.success(lang === 'he' ? 'הקמפיין נמחק' : 'Campaign deleted');
      setSelected(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      toast.error(err?.message || (lang === 'he' ? 'שגיאה במחיקה' : 'Error deleting'));
    }
  };

  const handleCampaignCreated = async (campaign: Campaign) => {
    try {
      await upsertCampaign(campaign);
      // toast already shown by dialog; refetch happens inside upsertCampaign
    } catch (e: any) {
      toast.error(e?.message || (lang === 'he' ? 'שגיאה בשמירת קמפיין' : 'Error saving campaign'));
    }
  };

  const updateCampaign = async (id: string, field: keyof Campaign, value: number | string) => {
    try {
      await updateCampaignField(id, field as string, value);
      toast.success(lang === 'he' ? 'הערך עודכן' : 'Value updated');
    } catch (e: any) {
      toast.error(e?.message || (lang === 'he' ? 'שגיאה בעדכון' : 'Error updating'));
    }
  };

  const filtered = useMemo(() => {
    return campaigns.filter(c => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.clientName.toLowerCase().includes(search.toLowerCase())) return false;
      if (platformFilter !== 'all' && c.platform !== platformFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (clientFilter !== 'all') {
        if (clientFilter === '__unassigned__') {
          if (c.clientId) return false;
        } else if (c.clientId !== clientFilter) {
          return false;
        }
      }
      return true;
    });
  }, [campaigns, search, platformFilter, statusFilter, clientFilter]);

  const grouped = useMemo(() => groupCampaigns(filtered), [filtered]);

  const toggleExpand = (campaignId: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  };

  const totalBudget = filtered.reduce((s, c) => s + c.budget, 0);
  const totalSpend = filtered.reduce((s, c) => s + c.spend, 0);
  const totalLeads = filtered.reduce((s, c) => s + c.leads, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('campaigns', lang)}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} {lang === 'he' ? 'קמפיינים' : 'campaigns'} · {fmtCurrency(totalBudget)} {t('budget', lang)} · {fmtCurrency(totalSpend)} {t('spend', lang)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowColumnsDialog(true)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={lang === 'he' ? 'ניהול עמודות' : 'Manage columns'}
          >
            <Settings2 size={16} />
            <span className="hidden sm:inline">{lang === 'he' ? 'עמודות' : 'Columns'}</span>
          </button>
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={deleteSelected}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
              >
                <Trash2 size={16} />
                {lang === 'he' ? `מחק (${selected.size})` : `Delete (${selected.size})`}
              </motion.button>
            )}
          </AnimatePresence>
          <button
            onClick={() => setShowNewDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            {lang === 'he' ? 'קמפיין חדש' : 'New Campaign'}
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 flex-1 max-w-md">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'he' ? 'חיפוש קמפיין או לקוח...' : 'Search campaign or client...'}
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
            showFilters ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Filter size={16} />
          {lang === 'he' ? 'סינון' : 'Filters'}
        </button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-xl p-4 flex flex-wrap gap-6">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">{lang === 'he' ? 'פלטפורמה' : 'Platform'}</label>
                <div className="flex gap-2 flex-wrap">
                  <FilterChip active={platformFilter === 'all'} onClick={() => setPlatformFilter('all')}>{lang === 'he' ? 'הכל' : 'All'}</FilterChip>
                  {allPlatforms.map(p => (
                    <FilterChip key={p} active={platformFilter === p} onClick={() => setPlatformFilter(p)}>
                      {platformIcons[p]} {p}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">{t('status', lang)}</label>
                <div className="flex gap-2 flex-wrap">
                  <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>{lang === 'he' ? 'הכל' : 'All'}</FilterChip>
                  {allStatuses.map(s => (
                    <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s}</FilterChip>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">{lang === 'he' ? 'לקוח' : 'Client'}</label>
                <div className="flex gap-2 flex-wrap">
                  <FilterChip active={clientFilter === 'all'} onClick={() => setClientFilter('all')}>{lang === 'he' ? 'הכל' : 'All'}</FilterChip>
                  {dbClients.map(c => (
                    <FilterChip key={c.id} active={clientFilter === c.id} onClick={() => setClientFilter(c.id)}>
                      {c.name}
                    </FilterChip>
                  ))}
                  {campaigns.some(c => !c.clientId) && (
                    <FilterChip active={clientFilter === '__unassigned__'} onClick={() => setClientFilter('__unassigned__')}>
                      {lang === 'he' ? 'לא משויך' : 'Unassigned'}
                    </FilterChip>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grouped Table */}
      <div className="space-y-4">
        {grouped.map(group => (
          <div key={group.clientId} className="glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
            {/* Client Header */}
            {(() => {
              const isUnassigned = group.clientId === '__unassigned__';
              const headerLabel = isUnassigned
                ? (lang === 'he' ? 'לא משויך ללקוח' : 'Unassigned')
                : (group.clientName || (lang === 'he' ? 'ללא שם' : 'Untitled'));
              return (
                <div className={cn(
                  "px-5 py-3 border-b border-border flex items-center gap-3",
                  isUnassigned ? "bg-amber-500/10" : "bg-muted/30"
                )}>
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                      isUnassigned && "bg-amber-500/20 text-amber-500"
                    )}
                    style={!isUnassigned ? { backgroundColor: `${mockClients_color(group.clientId)}20`, color: mockClients_color(group.clientId) } : undefined}
                  >
                    {isUnassigned ? <AlertCircle size={16} /> : headerLabel.charAt(0)}
                  </div>
                  <span className="text-sm font-semibold text-foreground">{headerLabel}</span>
                  <span className="text-xs text-muted-foreground">
                    {group.projects.reduce((s, p) => s + p.campaigns.length, 0)} {lang === 'he' ? 'קמפיינים' : 'campaigns'}
                  </span>
                  {isUnassigned && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 ms-auto">
                      {lang === 'he' ? 'לחץ על האייקון 🔗 כדי לשייך ידנית' : 'Click the 🔗 icon to link manually'}
                    </span>
                  )}
                </div>
              );
            })()}

            {group.projects.map(project => (
              <div key={project.projectId}>
                {/* Project sub-header */}
                <div className="px-5 py-2 border-b border-border/50 bg-muted/10 flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    📁 {project.projectName || (lang === 'he' ? 'ללא פרויקט' : 'No project')}
                  </span>
                </div>

                {/* Table header - visible on desktop only */}
                <div
                  className="hidden lg:grid gap-x-3 px-5 py-2 bg-muted/10 text-[11px] font-medium text-muted-foreground border-b border-border/20"
                  style={{ gridTemplateColumns: `36px minmax(200px,2fr) 110px 100px 100px 120px 120px 80px 80px 100px 140px 130px ${customColumns.map(() => '110px ').join('')}40px` }}
                >
                  <span></span>
                  <span>{lang === 'he' ? 'שם' : 'Name'}</span>
                  <span>{lang === 'he' ? 'סוג קמפיין' : 'Objective'}</span>
                  <span className="text-end">{t('budget', lang)}</span>
                  <span className="text-end">{t('spend', lang)}</span>
                  <span className="text-center">{lang === 'he' ? 'התקדמות' : 'Progress'}</span>
                  <span className="text-center">{lang === 'he' ? 'קצב' : 'Pacing'}</span>
                  <span className="text-end">{t('leads', lang)}</span>
                  <span className="text-end">CTR</span>
                  <span className="text-end">{lang === 'he' ? 'המרות' : 'Conv.'}</span>
                  <span className="text-end">{lang === 'he' ? 'מדד מטרה' : 'Goal KPI'}</span>
                  <span className="text-center">QA</span>
                  {customColumns.map(col => (
                    <span key={col.id} className="text-end truncate" title={col.name}>{col.name}</span>
                  ))}
                  <span></span>
                </div>

                {/* Campaign rows */}
                <div className="divide-y divide-border/30">
                  {project.campaigns.map(campaign => {
                    const pace = calcPacing(campaign.spend, campaign.budget, campaign.startDate, campaign.endDate);
                    const statusStyle = getStatusColor(campaign.status);
                    const ctr = calcCtr(campaign.clicks, campaign.impressions);
                    // No per-ad table for this org; keep an empty list so the
                    // expandable ad-row UI stays a no-op.
                    const ads: Ad[] = [];
                    const isExpanded = expandedCampaigns.has(campaign.id);
                    const spendPct = campaign.budget > 0 ? Math.min((campaign.spend / campaign.budget) * 100, 100) : 0;
                    const Chevron = isRtl ? ChevronLeft : ChevronRight;

                    return (
                      <div key={campaign.id}>
                        <div
                          className={cn(
                            "grid grid-cols-[1fr_auto] items-center gap-x-3 px-5 py-3 hover:bg-muted/20 transition-colors cursor-pointer group",
                            "lg:[grid-template-columns:var(--cols)]",
                            selected.has(campaign.id) && "bg-primary/5"
                          )}
                          style={{ ['--cols' as any]: `36px minmax(200px,2fr) 110px 100px 100px 120px 120px 80px 80px 100px 140px 130px ${customColumns.map(() => '110px ').join('')}40px` }}
                          onClick={() => ads.length > 0 && toggleExpand(campaign.id)}
                        >
                          {/* Checkbox */}
                          <div className="hidden lg:flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={selected.has(campaign.id)}
                              onChange={() => {}}
                              onClick={e => toggleSelect(campaign.id, e)}
                              className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                            />
                          </div>
                          {/* Name + Platform */}
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-base shrink-0">{platformIcons[campaign.platform]}</span>
                            <div className="min-w-0 flex-1">
                              <EditableCell
                                value={campaign.name}
                                type="text"
                                formatDisplay={v => String(v)}
                                onSave={v => updateCampaign(campaign.id, 'name', v)}
                                className="text-start font-medium"
                              />
                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                  style={{ backgroundColor: `${getPlatformColor(campaign.platform)}20`, color: getPlatformColor(campaign.platform) }}
                                >
                                  {campaign.platform}
                                </span>
                                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", statusStyle.bg, statusStyle.text)}>
                                  {campaign.status}
                                </span>
                              </div>
                            </div>
                            {selected.has(campaign.id) && (
                              <button
                                onClick={e => deleteOne(campaign.id, e)}
                                title={lang === 'he' ? 'מחק קמפיין' : 'Delete campaign'}
                                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors text-xs font-medium"
                              >
                                <Trash2 size={14} />
                                <span className="hidden sm:inline">{lang === 'he' ? 'מחק' : 'Delete'}</span>
                              </button>
                            )}
                          </div>

                          {/* Objective selector */}
                          <div className="hidden lg:block" onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 hover:bg-muted text-xs font-medium text-foreground transition-colors w-full justify-start"
                                  title={lang === 'he' ? 'שנה סוג קמפיין' : 'Change campaign objective'}
                                >
                                  <span className="text-sm">{objectiveIcon(campaign.objective)}</span>
                                  <span className="truncate">{objectiveLabel(campaign.objective, lang === 'he' ? 'he' : 'en')}</span>
                                  <ChevronDown size={12} className="ms-auto opacity-60 shrink-0" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="bg-popover">
                                {ALL_OBJECTIVES.map(o => (
                                  <DropdownMenuItem
                                    key={o}
                                    onClick={() => updateCampaign(campaign.id, 'objective' as keyof Campaign, o)}
                                    className={cn(
                                      'gap-2 cursor-pointer',
                                      campaign.objective === o && 'bg-primary/10 text-primary'
                                    )}
                                  >
                                    <span>{objectiveIcon(o)}</span>
                                    <span>{objectiveLabel(o, lang === 'he' ? 'he' : 'en')}</span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Desktop columns - hidden on small */}
                          <div className="hidden lg:block text-end">
                            <EditableCell
                              value={campaign.budget}
                              type="number"
                              formatDisplay={v => fmtCurrency(Number(v))}
                              onSave={v => updateCampaign(campaign.id, 'budget', v)}
                            />
                          </div>
                          <div className="hidden lg:block text-end">
                            <EditableCell
                              value={campaign.spend}
                              type="number"
                              formatDisplay={v => fmtCurrency(Number(v))}
                              onSave={v => updateCampaign(campaign.id, 'spend', v)}
                            />
                          </div>
                          {/* Budget bar */}
                          <div className="hidden lg:block">
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${spendPct}%`,
                                  backgroundColor: spendPct > 90 ? '#EF4444' : spendPct > 70 ? '#F59E0B' : '#22C55E',
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 text-center">{Math.round(spendPct)}%</p>
                          </div>
                          {/* Pacing */}
                          <div className="hidden lg:block text-center">
                            <span className={cn("text-xs font-medium px-2 py-1 rounded", pace.bgColor, pace.color)}>
                              {isRtl ? pace.labelHe : pace.label}
                            </span>
                          </div>
                          <div className="hidden lg:block text-end">
                            <EditableCell
                              value={campaign.leads}
                              type="number"
                              formatDisplay={v => fmtNum(Number(v))}
                              onSave={v => updateCampaign(campaign.id, 'leads', v)}
                            />
                          </div>
                          <div className="hidden lg:block text-end">
                            <p className="text-sm text-foreground">{ctr}</p>
                            <p className="text-[10px] text-muted-foreground">CTR</p>
                          </div>
                          <div className="hidden lg:block text-end">
                            <EditableCell
                              value={campaign.conversions}
                              type="number"
                              formatDisplay={v => fmtNum(Number(v))}
                              onSave={v => updateCampaign(campaign.id, 'conversions', v)}
                            />
                          </div>
                          {/* Goal KPI — primary metric for the campaign objective */}
                          {(() => {
                            const metric = computeObjectiveMetric(campaign.objective, {
                              spend: campaign.spend,
                              leads: campaign.leads,
                              conversions: campaign.conversions,
                              impressions: campaign.impressions,
                              clicks: campaign.clicks,
                            }, lang === 'he' ? 'he' : 'en');
                            return (
                              <div className="hidden lg:block text-end" onClick={e => e.stopPropagation()}>
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="cursor-help">
                                        <p className="text-sm font-semibold text-primary tabular-nums">{metric.primary}</p>
                                        <p className="text-[10px] text-muted-foreground truncate">
                                          {metric.label}{metric.secondary ? ` · ${metric.secondary}` : ''}
                                        </p>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[260px] text-xs">
                                      {metric.tooltip}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            );
                          })()}

                          {/* QA status */}
                          <div className="hidden lg:block" onClick={e => e.stopPropagation()}>
                            <QAStatusCell
                              qa={getQAStatus(campaign.name, campaign.clientId || null)}
                              campaignName={campaign.name}
                              clientId={campaign.clientId || null}
                              clientName={campaign.clientName}
                              platform={campaign.platform}
                              lang={lang as 'he' | 'en'}
                            />
                          </div>

                          {/* Custom columns */}
                          {customColumns.map(col => {
                            // Auto-computed columns (days in month, optimal pace, projected spend, …)
                            const autoKind = detectAutoColumn(col.name);
                            if (autoKind) {
                              const auto = computeAutoColumn(autoKind, campaign, lang as 'he' | 'en');
                              const cls =
                                auto.severity === 'danger' ? 'text-destructive font-semibold' :
                                auto.severity === 'warn'   ? 'text-amber-500 font-semibold' :
                                'text-foreground';
                              return (
                                <div key={col.id} className="hidden lg:block text-end" onClick={e => e.stopPropagation()}>
                                  <p className={cn('text-sm tabular-nums', cls)} title={auto.tooltip}>
                                    {auto.display}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {lang === 'he' ? 'מחושב אוטומטית' : 'Auto'}
                                  </p>
                                </div>
                              );
                            }
                            // Calculated (formula) column — read-only, derived from campaign metrics
                            if (col.type === 'formula') {
                              const result = evaluateFormula(col.formula ?? '', {
                                budget: campaign.budget,
                                spend: campaign.spend,
                                leads: campaign.leads,
                                impressions: campaign.impressions,
                                clicks: campaign.clicks,
                                conversions: campaign.conversions,
                              });
                              return (
                                <div key={col.id} className="hidden lg:block text-end" onClick={e => e.stopPropagation()}>
                                  <p className="text-sm text-foreground tabular-nums" title={col.formula ?? ''}>
                                    {result === null ? '—' : (Math.abs(result) >= 1000 ? fmtNum(Math.round(result)) : result.toFixed(2))}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground truncate" title={col.formula ?? ''}>ƒ {col.formula}</p>
                                </div>
                              );
                            }
                            const v = customValues[campaign.id]?.[col.id] ?? '';
                            return (
                              <div key={col.id} className="hidden lg:block text-end" onClick={e => e.stopPropagation()}>
                                <EditableCell
                                  value={col.type === 'number' ? (v === '' ? 0 : Number(v)) : v}
                                  type={col.type === 'number' ? 'number' : 'text'}
                                  formatDisplay={val => {
                                    if (val === '' || val === null || val === undefined) return '—';
                                    return col.type === 'number' ? fmtNum(Number(val)) : String(val);
                                  }}
                                  onSave={async (val) => {
                                    try {
                                      await setCustomValue(campaign.id, col.id, String(val));
                                    } catch (e: any) {
                                      toast.error(e?.message || 'Error');
                                    }
                                  }}
                                />
                              </div>
                            );
                          })}

                          {/* Expand toggle / inline delete when selected */}
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setAssignTarget(campaign)}
                              title={lang === 'he' ? 'שייך ללקוח/פרויקט' : 'Link to client/project'}
                              className={cn(
                                "p-1 rounded transition-colors",
                                campaign.clientId
                                  ? "text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  : "text-amber-500 hover:bg-amber-500/10 animate-pulse"
                              )}
                            >
                              <Link2 size={14} />
                            </button>
                            {selected.has(campaign.id) && (
                              <button
                                onClick={e => deleteOne(campaign.id, e)}
                                title={lang === 'he' ? 'מחק קמפיין' : 'Delete campaign'}
                                className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                            {ads.length > 0 && (
                              <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} className="text-muted-foreground">
                                <Chevron size={16} />
                              </motion.div>
                            )}
                          </div>

                          {/* Mobile summary */}
                          <div className="lg:hidden col-span-1 flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                            <span>{fmtCurrency(campaign.spend)} / {fmtCurrency(campaign.budget)}</span>
                            <span>{fmtNum(campaign.leads)} {t('leads', lang)}</span>
                            <span className={cn(pace.color)}>{isRtl ? pace.labelHe : pace.label}</span>
                          </div>
                        </div>

                        {/* Expanded Ads */}
                        <AnimatePresence>
                          {isExpanded && ads.length > 0 && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="bg-muted/10 border-t border-border/30">
                                {ads.map(ad => {
                                  const adStatus = getAdStatusColor(ad.status);
                                  return (
                                    <div
                                      key={ad.id}
                                      className="grid grid-cols-[1fr_auto] lg:grid-cols-[minmax(200px,2fr)_100px_100px_120px_120px_80px_80px_100px_100px_40px] items-center gap-x-3 px-5 py-2.5 hover:bg-muted/20 transition-colors"
                                      style={{ paddingInlineStart: '3.5rem' }}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded bg-muted flex items-center justify-center shrink-0">
                                          {ad.mediaType === 'video' ? <Video size={14} className="text-muted-foreground" /> : <Image size={14} className="text-muted-foreground" />}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-medium text-foreground/80 truncate">{ad.name}</p>
                                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", adStatus.bg, adStatus.text)}>
                                            {ad.status}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="hidden lg:block" /> {/* budget placeholder */}
                                      <div className="hidden lg:block text-end">
                                        <p className="text-xs text-foreground/70">{fmtCurrency(ad.spend)}</p>
                                      </div>
                                      <div className="hidden lg:block" /> {/* bar placeholder */}
                                      <div className="hidden lg:block" /> {/* pacing placeholder */}
                                      <div className="hidden lg:block text-end">
                                        <p className="text-xs text-foreground/70">{fmtNum(ad.leads)}</p>
                                      </div>
                                      <div className="hidden lg:block text-end">
                                        <p className="text-xs text-foreground/70">{calcCpl(ad.spend, ad.leads)}</p>
                                      </div>
                                      <div className="hidden lg:block text-end">
                                        <p className="text-xs text-foreground/70">{calcCtr(ad.clicks, ad.impressions)}</p>
                                      </div>
                                      <div className="hidden lg:block text-end">
                                        <p className="text-xs text-foreground/70">{fmtNum(ad.conversions)}</p>
                                      </div>
                                      <div />

                                      {/* Mobile summary */}
                                      <div className="lg:hidden col-span-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                        <span>{fmtCurrency(ad.spend)}</span>
                                        <span>{fmtNum(ad.leads)} {t('leads', lang)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            </div>
          </div>
        ))}

        {grouped.length === 0 && (
          <div className="glass-card rounded-xl p-12 text-center">
            <p className="text-muted-foreground">{lang === 'he' ? 'לא נמצאו קמפיינים' : 'No campaigns found'}</p>
          </div>
        )}
      </div>
      <NewCampaignDialog open={showNewDialog} onOpenChange={setShowNewDialog} lang={lang} onCampaignCreated={handleCampaignCreated} />
      <ManageColumnsDialog
        open={showColumnsDialog}
        onOpenChange={setShowColumnsDialog}
        lang={lang}
        columns={customColumns}
        onAdd={addColumn}
        onRename={renameColumn}
        onUpdateFormula={updateFormula}
        onDelete={deleteColumn}
      />
      <AssignClientDialog
        open={!!assignTarget}
        onOpenChange={(o) => !o && setAssignTarget(null)}
        campaign={assignTarget}
        lang={lang}
        onSaved={() => window.dispatchEvent(new Event('orgdata:refresh'))}
      />
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
        active ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground hover:text-foreground border border-transparent"
      )}
    >
      {children}
    </button>
  );
}

function mockClients_color(clientId: string): string {
  const colors: Record<string, string> = { '1': '#00D4FF', '2': '#22C55E', '3': '#A78BFA', '4': '#F59E0B', '5': '#EF4444' };
  return colors[clientId] || '#00D4FF';
}
