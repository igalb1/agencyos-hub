import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { mockAds, mockClients } from '@/lib/mock-data';
import { Ad } from '@/lib/types';
import { fmtCurrency, fmtNum, calcCtr } from '@/lib/campaign-utils';
import { cn } from '@/lib/utils';
import { Search, Image, Video, SlidersHorizontal, ChevronDown, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const platformIcons: Record<string, { color: string }> = {
  Meta: { color: '#1877F2' },
  Google: { color: '#EA4335' },
  TikTok: { color: '#000000' },
  LinkedIn: { color: '#0A66C2' },
};

const statusStyles: Record<string, string> = {
  Active: 'bg-emerald-500/15 text-emerald-400',
  Paused: 'bg-amber-500/15 text-amber-400',
  Rejected: 'bg-destructive/15 text-destructive',
  Draft: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, Record<string, string>> = {
  Active: { he: 'פעיל', en: 'Active' },
  Paused: { he: 'מושהה', en: 'Paused' },
  Rejected: { he: 'נדחה', en: 'Rejected' },
  Draft: { he: 'טיוטה', en: 'Draft' },
};

interface GroupedData {
  clientId: string;
  clientName: string;
  clientColor: string;
  campaigns: {
    campaignId: string;
    campaignName: string;
    platform: string;
    ads: Ad[];
  }[];
}

export default function AdsPage() {
  const { lang } = useApp();
  const [ads, setAds] = useState<Ad[]>(mockAds);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [mediaFilter, setMediaFilter] = useState<string>('all');
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set());
  const [collapsedCampaigns, setCollapsedCampaigns] = useState<Set<string>>(new Set());

  const filtered = ads.filter(ad => {
    if (search && !ad.name.toLowerCase().includes(search.toLowerCase()) && !ad.clientName.toLowerCase().includes(search.toLowerCase()) && !ad.campaignName.toLowerCase().includes(search.toLowerCase())) return false;
    if (platformFilter !== 'all' && ad.platform !== platformFilter) return false;
    if (statusFilter !== 'all' && ad.status !== statusFilter) return false;
    if (mediaFilter !== 'all' && ad.mediaType !== mediaFilter) return false;
    return true;
  });

  const grouped = useMemo<GroupedData[]>(() => {
    const map: Record<string, Record<string, Ad[]>> = {};
    filtered.forEach(ad => {
      if (!map[ad.clientId]) map[ad.clientId] = {};
      if (!map[ad.clientId][ad.campaignId]) map[ad.clientId][ad.campaignId] = [];
      map[ad.clientId][ad.campaignId].push(ad);
    });

    return Object.entries(map).map(([clientId, campaigns]) => {
      const client = mockClients.find(c => c.id === clientId);
      const firstAd = Object.values(campaigns)[0][0];
      return {
        clientId,
        clientName: firstAd.clientName,
        clientColor: client?.color || '#00D4FF',
        campaigns: Object.entries(campaigns).map(([campaignId, ads]) => ({
          campaignId,
          campaignName: ads[0].campaignName,
          platform: ads[0].platform,
          ads,
        })),
      };
    });
  }, [filtered]);

  const toggleStatus = (id: string) => {
    setAds(prev => prev.map(ad => {
      if (ad.id !== id) return ad;
      const next = ad.status === 'Active' ? 'Paused' : 'Active';
      toast.success(lang === 'he' ? `הסטטוס שונה ל${statusLabels[next].he}` : `Status changed to ${next}`);
      return { ...ad, status: next as Ad['status'] };
    }));
  };

  const toggleClient = (id: string) => {
    setCollapsedClients(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCampaign = (id: string) => {
    setCollapsedCampaigns(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalSpend = filtered.reduce((s, a) => s + a.spend, 0);
  const totalLeads = filtered.reduce((s, a) => s + a.leads, 0);
  const isRtl = lang === 'he';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{lang === 'he' ? 'מודעות' : 'Ads'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filtered.length} {lang === 'he' ? 'מודעות' : 'ads'} · {fmtCurrency(totalSpend)} {t('spend', lang)} · {fmtNum(totalLeads)} {t('leads', lang)}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 max-w-md">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'he' ? 'חיפוש מודעה, קמפיין או לקוח...' : 'Search ad, campaign or client...'}
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <SlidersHorizontal size={14} className="text-muted-foreground" />

          {['all', 'Meta', 'Google', 'TikTok', 'LinkedIn'].map(p => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border",
                platformFilter === p ? "bg-primary/15 text-primary border-primary/30" : "bg-muted text-muted-foreground hover:text-foreground border-transparent"
              )}
            >
              {p === 'all' ? (lang === 'he' ? 'כל הפלטפורמות' : 'All Platforms') : p}
            </button>
          ))}

          <span className="w-px h-4 bg-border mx-1" />

          {['all', 'Active', 'Paused', 'Rejected', 'Draft'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border",
                statusFilter === s ? "bg-primary/15 text-primary border-primary/30" : "bg-muted text-muted-foreground hover:text-foreground border-transparent"
              )}
            >
              {s === 'all' ? (lang === 'he' ? 'כל הסטטוסים' : 'All Statuses') : statusLabels[s][lang]}
            </button>
          ))}

          <span className="w-px h-4 bg-border mx-1" />

          {['all', 'image', 'video'].map(m => (
            <button
              key={m}
              onClick={() => setMediaFilter(m)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border flex items-center gap-1",
                mediaFilter === m ? "bg-primary/15 text-primary border-primary/30" : "bg-muted text-muted-foreground hover:text-foreground border-transparent"
              )}
            >
              {m === 'all' ? (lang === 'he' ? 'כל הסוגים' : 'All Types') : m === 'image' ? <><Image size={11} />{lang === 'he' ? 'תמונה' : 'Image'}</> : <><Video size={11} />{lang === 'he' ? 'וידאו' : 'Video'}</>}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Content */}
      <div className="space-y-4">
        {grouped.map(({ clientId, clientName, clientColor, campaigns }) => {
          const clientCollapsed = collapsedClients.has(clientId);
          const clientAds = campaigns.flatMap(c => c.ads);
          const clientSpend = clientAds.reduce((s, a) => s + a.spend, 0);
          const clientLeads = clientAds.reduce((s, a) => s + a.leads, 0);

          return (
            <div key={clientId} className="glass-card rounded-xl overflow-hidden">
              {/* Client Header */}
              <button
                onClick={() => toggleClient(clientId)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ backgroundColor: `${clientColor}20`, color: clientColor }}
                >
                  {clientName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0 text-start">
                  <p className="text-sm font-semibold text-foreground">{clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {clientAds.length} {lang === 'he' ? 'מודעות' : 'ads'} · {fmtCurrency(clientSpend)} · {fmtNum(clientLeads)} {t('leads', lang)}
                  </p>
                </div>
                {isRtl ? (
                  <ChevronLeft size={16} className={cn("text-muted-foreground transition-transform", clientCollapsed ? "" : "-rotate-90")} />
                ) : (
                  <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", clientCollapsed && "-rotate-90")} />
                )}
              </button>

              <AnimatePresence initial={false}>
                {!clientCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {campaigns.map(({ campaignId, campaignName, platform, ads: campaignAds }) => {
                      const campCollapsed = collapsedCampaigns.has(campaignId);
                      const pi = platformIcons[platform];
                      const campSpend = campaignAds.reduce((s, a) => s + a.spend, 0);

                      return (
                        <div key={campaignId} className="border-t border-border/40">
                          {/* Campaign Header */}
                          <button
                            onClick={() => toggleCampaign(campaignId)}
                            className="w-full flex items-center gap-3 px-5 ps-10 py-2.5 hover:bg-muted/20 transition-colors"
                          >
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
                              style={{ backgroundColor: `${pi.color}20`, color: pi.color }}
                            >
                              {platform}
                            </span>
                            <div className="flex-1 min-w-0 text-start">
                              <p className="text-xs font-medium text-foreground/80">{campaignName}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">{campaignAds.length} {lang === 'he' ? 'מודעות' : 'ads'} · {fmtCurrency(campSpend)}</span>
                            {isRtl ? (
                              <ChevronLeft size={14} className={cn("text-muted-foreground transition-transform", campCollapsed ? "" : "-rotate-90")} />
                            ) : (
                              <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", campCollapsed && "-rotate-90")} />
                            )}
                          </button>

                          <AnimatePresence initial={false}>
                            {!campCollapsed && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                              >
                                {/* Table header */}
                                <div className="hidden lg:grid grid-cols-[2fr_70px_1fr_1fr_1fr_80px_80px_90px] gap-x-3 px-5 ps-14 py-2 bg-muted/10 text-[11px] font-medium text-muted-foreground border-t border-border/20">
                                  <span>{lang === 'he' ? 'מודעה' : 'Ad'}</span>
                                  <span className="text-center">{lang === 'he' ? 'סוג' : 'Type'}</span>
                                  <span className="text-end">{t('spend', lang)}</span>
                                  <span className="text-end">{lang === 'he' ? 'חשיפות' : 'Impr.'}</span>
                                  <span className="text-end">{lang === 'he' ? 'קליקים' : 'Clicks'}</span>
                                  <span className="text-end">CTR</span>
                                  <span className="text-end">{t('leads', lang)}</span>
                                  <span className="text-center">{t('status', lang)}</span>
                                </div>

                                {campaignAds.map((ad, i) => (
                                  <div
                                    key={ad.id}
                                    className="grid grid-cols-1 lg:grid-cols-[2fr_70px_1fr_1fr_1fr_80px_80px_90px] gap-x-3 px-5 ps-14 py-2.5 hover:bg-muted/15 transition-colors items-center border-t border-border/10"
                                  >
                                    <p className="text-sm text-foreground truncate">{ad.name}</p>

                                    <div className="hidden lg:flex justify-center">
                                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        {ad.mediaType === 'video' ? <Video size={12} /> : <Image size={12} />}
                                        {ad.mediaType === 'video' ? (lang === 'he' ? 'וידאו' : 'Video') : (lang === 'he' ? 'תמונה' : 'Image')}
                                      </span>
                                    </div>

                                    <p className="hidden lg:block text-sm text-foreground text-end">{fmtCurrency(ad.spend)}</p>
                                    <p className="hidden lg:block text-sm text-foreground text-end">{fmtNum(ad.impressions)}</p>
                                    <p className="hidden lg:block text-sm text-foreground text-end">{fmtNum(ad.clicks)}</p>
                                    <p className="hidden lg:block text-sm text-foreground text-end">{calcCtr(ad.clicks, ad.impressions)}%</p>
                                    <p className="hidden lg:block text-sm text-foreground text-end">{fmtNum(ad.leads)}</p>

                                    <div className="hidden lg:flex justify-center">
                                      <button
                                        onClick={() => toggleStatus(ad.id)}
                                        disabled={ad.status === 'Rejected' || ad.status === 'Draft'}
                                        className={cn(
                                          "text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors",
                                          statusStyles[ad.status],
                                          (ad.status === 'Active' || ad.status === 'Paused') && 'cursor-pointer hover:opacity-80'
                                        )}
                                      >
                                        {statusLabels[ad.status][lang]}
                                      </button>
                                    </div>

                                    {/* Mobile */}
                                    <div className="lg:hidden flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-0.5">{ad.mediaType === 'video' ? <Video size={11} /> : <Image size={11} />}{ad.mediaType}</span>
                                      <span>{fmtCurrency(ad.spend)}</span>
                                      <span>{fmtNum(ad.clicks)} clicks</span>
                                      <span>{calcCtr(ad.clicks, ad.impressions)}% CTR</span>
                                      <button
                                        onClick={() => toggleStatus(ad.id)}
                                        disabled={ad.status === 'Rejected' || ad.status === 'Draft'}
                                        className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", statusStyles[ad.status])}
                                      >
                                        {statusLabels[ad.status][lang]}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {grouped.length === 0 && (
          <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
            {lang === 'he' ? 'לא נמצאו מודעות' : 'No ads found'}
          </div>
        )}
      </div>
    </div>
  );
}
