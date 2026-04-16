import { useApp } from '@/contexts/AppContext';
import { mockCampaigns, mockProjects } from '@/lib/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

const platformColors: Record<string, string> = {
  Meta: 'bg-blue-500',
  Google: 'bg-red-500',
  TikTok: 'bg-foreground',
  LinkedIn: 'bg-sky-700',
};

const statusColors: Record<string, string> = {
  Live: 'bg-emerald-500',
  Planned: 'bg-amber-500',
  Paused: 'bg-muted-foreground',
  active: 'bg-emerald-500',
  planning: 'bg-amber-500',
  completed: 'bg-sky-500',
};

export default function TimelinePage() {
  const { lang } = useApp();
  const isRtl = lang === 'he';
  const [view, setView] = useState<'campaigns' | 'projects'>('campaigns');
  const [filterClient, setFilterClient] = useState<string>('all');

  const clients = useMemo(() => {
    const set = new Set(mockCampaigns.map(c => c.clientName));
    return Array.from(set);
  }, []);

  // Determine timeline range
  const items = view === 'campaigns'
    ? mockCampaigns
        .filter(c => filterClient === 'all' || c.clientName === filterClient)
        .map(c => ({
          id: c.id,
          name: c.name,
          clientName: c.clientName,
          startDate: c.startDate,
          endDate: c.endDate,
          status: c.status,
          platform: c.platform,
          spend: c.spend,
          budget: c.budget,
        }))
    : mockProjects
        .filter(p => filterClient === 'all' || p.clientName === filterClient)
        .map(p => ({
          id: p.id,
          name: p.name,
          clientName: p.clientName,
          startDate: p.startDate,
          endDate: p.endDate,
          status: p.status,
          platform: null,
          spend: p.spend,
          budget: p.budget,
        }));

  const allDates = items.flatMap(i => [new Date(i.startDate), new Date(i.endDate)]);
  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date();
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date();
  const totalDays = Math.max((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24), 1);

  // Generate month markers
  const months: { label: string; left: number }[] = [];
  const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (cursor <= maxDate) {
    const dayOffset = (cursor.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
    months.push({
      label: cursor.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'short', year: '2-digit' }),
      left: (dayOffset / totalDays) * 100,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Today marker
  const today = new Date();
  const todayOffset = ((today.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
  const showToday = todayOffset >= 0 && todayOffset <= 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">
          {lang === 'he' ? 'ציר זמן' : 'Timeline'}
        </h1>
        <div className="flex gap-2">
          <Select value={view} onValueChange={(v) => setView(v as 'campaigns' | 'projects')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="campaigns">{lang === 'he' ? 'קמפיינים' : 'Campaigns'}</SelectItem>
              <SelectItem value="projects">{lang === 'he' ? 'פרויקטים' : 'Projects'}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === 'he' ? 'כל הלקוחות' : 'All Clients'}</SelectItem>
              {clients.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-card/60 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-muted-foreground">
            {lang === 'he' ? `${items.length} פריטים` : `${items.length} items`}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Month headers */}
            <div className="relative h-8 border-b border-border/50 mb-2">
              {months.map((m, i) => (
                <span
                  key={i}
                  className="absolute text-xs text-muted-foreground top-1"
                  style={{ [isRtl ? 'right' : 'left']: `${m.left}%` }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            {/* Rows */}
            <div className="space-y-2">
              {items.map((item) => {
                const startOffset = ((new Date(item.startDate).getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
                const width = ((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
                const progress = item.budget > 0 ? Math.min((item.spend / item.budget) * 100, 100) : 0;

                return (
                  <div key={item.id} className="relative flex items-center h-10 group">
                    {/* Bar */}
                    <div
                      className={cn(
                        "absolute h-8 rounded-md flex items-center px-2 gap-1.5 transition-all",
                        "bg-primary/20 border border-primary/30 hover:bg-primary/30 cursor-default"
                      )}
                      style={{
                        [isRtl ? 'right' : 'left']: `${startOffset}%`,
                        width: `${Math.max(width, 3)}%`,
                      }}
                    >
                      {/* Progress fill */}
                      <div
                        className="absolute inset-y-0 rounded-md bg-primary/30"
                        style={{
                          [isRtl ? 'right' : 'left']: 0,
                          width: `${progress}%`,
                        }}
                      />
                      <span className="relative text-xs font-medium text-foreground truncate">
                        {item.name}
                      </span>
                      {item.platform && (
                        <span className={cn("relative w-2 h-2 rounded-full shrink-0", platformColors[item.platform])} />
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          "relative text-[10px] px-1.5 py-0 h-4 border-0 text-white shrink-0",
                          statusColors[item.status]
                        )}
                      >
                        {item.status}
                      </Badge>
                    </div>

                    {/* Tooltip on hover */}
                    <div
                      className="absolute -top-10 bg-popover text-popover-foreground border border-border rounded-md px-2 py-1 text-xs shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap"
                      style={{ [isRtl ? 'right' : 'left']: `${startOffset}%` }}
                    >
                      {item.clientName} — {item.startDate} → {item.endDate}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Today line */}
            {showToday && (
              <div
                className="absolute top-0 bottom-0 w-px bg-destructive/60 z-10"
                style={{ [isRtl ? 'right' : 'left']: `${todayOffset}%` }}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
