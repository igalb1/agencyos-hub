import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { mockAds } from '@/lib/mock-data';
import { Ad } from '@/lib/types';
import { fmtCurrency, fmtNum, calcCtr } from '@/lib/campaign-utils';
import { cn } from '@/lib/utils';
import { Search, Image, Video, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const platformIcons: Record<string, { icon: string; color: string }> = {
  Meta: { icon: 'M', color: '#1877F2' },
  Google: { icon: 'G', color: '#EA4335' },
  TikTok: { icon: 'T', color: '#000000' },
  LinkedIn: { icon: 'in', color: '#0A66C2' },
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

export default function AdsPage() {
  const { lang } = useApp();
  const [ads, setAds] = useState<Ad[]>(mockAds);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [mediaFilter, setMediaFilter] = useState<string>('all');

  const filtered = ads.filter(ad => {
    if (search && !ad.name.toLowerCase().includes(search.toLowerCase()) && !ad.clientName.toLowerCase().includes(search.toLowerCase()) && !ad.campaignName.toLowerCase().includes(search.toLowerCase())) return false;
    if (platformFilter !== 'all' && ad.platform !== platformFilter) return false;
    if (statusFilter !== 'all' && ad.status !== statusFilter) return false;
    if (mediaFilter !== 'all' && ad.mediaType !== mediaFilter) return false;
    return true;
  });

  const toggleStatus = (id: string) => {
    setAds(prev => prev.map(ad => {
      if (ad.id !== id) return ad;
      const next = ad.status === 'Active' ? 'Paused' : 'Active';
      toast.success(lang === 'he' ? `הסטטוס שונה ל${statusLabels[next].he}` : `Status changed to ${next}`);
      return { ...ad, status: next as Ad['status'] };
    }));
  };

  const totalSpend = filtered.reduce((s, a) => s + a.spend, 0);
  const totalImpressions = filtered.reduce((s, a) => s + a.impressions, 0);
  const totalClicks = filtered.reduce((s, a) => s + a.clicks, 0);
  const totalLeads = filtered.reduce((s, a) => s + a.leads, 0);

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

          {/* Platform */}
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

          {/* Status */}
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

          {/* Media type */}
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

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        {/* Desktop Header */}
        <div className="hidden xl:grid grid-cols-[2fr_1fr_80px_80px_1fr_1fr_1fr_1fr_80px_90px] gap-x-3 px-5 py-3 border-b border-border bg-muted/20 text-xs font-medium text-muted-foreground">
          <span>{lang === 'he' ? 'מודעה' : 'Ad'}</span>
          <span>{lang === 'he' ? 'קמפיין' : 'Campaign'}</span>
          <span className="text-center">{lang === 'he' ? 'פלטפורמה' : 'Platform'}</span>
          <span className="text-center">{lang === 'he' ? 'סוג' : 'Type'}</span>
          <span className="text-end">{t('spend', lang)}</span>
          <span className="text-end">{lang === 'he' ? 'חשיפות' : 'Impressions'}</span>
          <span className="text-end">{lang === 'he' ? 'קליקים' : 'Clicks'}</span>
          <span className="text-end">CTR</span>
          <span className="text-end">{t('leads', lang)}</span>
          <span className="text-center">{t('status', lang)}</span>
        </div>

        <div className="divide-y divide-border/30">
          {filtered.map((ad, i) => {
            const pi = platformIcons[ad.platform];
            return (
              <motion.div
                key={ad.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="grid grid-cols-1 xl:grid-cols-[2fr_1fr_80px_80px_1fr_1fr_1fr_1fr_80px_90px] gap-x-3 px-5 py-3.5 hover:bg-muted/20 transition-colors items-center"
              >
                {/* Ad Name + Client */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ad.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{ad.clientName}</p>
                </div>

                {/* Campaign */}
                <p className="hidden xl:block text-xs text-foreground/70 truncate">{ad.campaignName}</p>

                {/* Platform */}
                <div className="hidden xl:flex justify-center">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                    style={{ backgroundColor: `${pi.color}20`, color: pi.color }}
                  >
                    {ad.platform}
                  </span>
                </div>

                {/* Media type */}
                <div className="hidden xl:flex justify-center">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {ad.mediaType === 'video' ? <Video size={13} /> : <Image size={13} />}
                    {ad.mediaType === 'video' ? (lang === 'he' ? 'וידאו' : 'Video') : (lang === 'he' ? 'תמונה' : 'Image')}
                  </span>
                </div>

                {/* Metrics */}
                <p className="hidden xl:block text-sm text-foreground text-end">{fmtCurrency(ad.spend)}</p>
                <p className="hidden xl:block text-sm text-foreground text-end">{fmtNum(ad.impressions)}</p>
                <p className="hidden xl:block text-sm text-foreground text-end">{fmtNum(ad.clicks)}</p>
                <p className="hidden xl:block text-sm text-foreground text-end">{calcCtr(ad.clicks, ad.impressions)}%</p>
                <p className="hidden xl:block text-sm text-foreground text-end">{fmtNum(ad.leads)}</p>

                {/* Status toggle */}
                <div className="hidden xl:flex justify-center">
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

                {/* Mobile details */}
                <div className="xl:hidden flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span style={{ color: pi.color }}>{ad.platform}</span>
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
              </motion.div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              {lang === 'he' ? 'לא נמצאו מודעות' : 'No ads found'}
            </div>
          )}
        </div>

        {/* Totals */}
        {filtered.length > 0 && (
          <div className="hidden xl:grid grid-cols-[2fr_1fr_80px_80px_1fr_1fr_1fr_1fr_80px_90px] gap-x-3 px-5 py-3 border-t border-border bg-muted/20 text-sm font-semibold text-foreground">
            <span>{lang === 'he' ? 'סה"כ' : 'Total'}</span>
            <span /><span /><span />
            <span className="text-end">{fmtCurrency(totalSpend)}</span>
            <span className="text-end">{fmtNum(totalImpressions)}</span>
            <span className="text-end">{fmtNum(totalClicks)}</span>
            <span className="text-end">{calcCtr(totalClicks, totalImpressions)}%</span>
            <span className="text-end">{fmtNum(totalLeads)}</span>
            <span />
          </div>
        )}
      </div>
    </div>
  );
}
