import { useApp } from '@/contexts/AppContext';
import { mockCampaigns, mockTasks } from '@/lib/mock-data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Megaphone, CheckSquare } from 'lucide-react';

type ViewFilter = 'all' | 'campaigns' | 'tasks';

export default function CalendarPage() {
  const { lang } = useApp();
  const isHe = lang === 'he';
  const isRtl = lang === 'he';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const monthLabel = currentDate.toLocaleDateString(isHe ? 'he-IL' : 'en-US', { month: 'long', year: 'numeric' });

  const dayNames = isHe
    ? ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Build events map: date string -> items[]
  const eventsMap = useMemo(() => {
    const map: Record<string, { type: 'campaign-start' | 'campaign-end' | 'task'; label: string; color: string; platform?: string }[]> = {};

    const addEvent = (dateStr: string, event: typeof map[string][number]) => {
      const d = new Date(dateStr);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = d.getDate().toString();
        if (!map[key]) map[key] = [];
        map[key].push(event);
      }
    };

    if (viewFilter !== 'tasks') {
      mockCampaigns.forEach(c => {
        addEvent(c.startDate, { type: 'campaign-start', label: c.name, color: 'bg-emerald-500', platform: c.platform });
        addEvent(c.endDate, { type: 'campaign-end', label: c.name, color: 'bg-destructive', platform: c.platform });
      });
    }

    if (viewFilter !== 'campaigns') {
      mockTasks.forEach(t => {
        addEvent(t.due, {
          type: 'task',
          label: t.title,
          color: t.priority === 'High' ? 'bg-destructive' : t.priority === 'Medium' ? 'bg-amber-500' : 'bg-muted-foreground',
        });
      });
    }

    return map;
  }, [year, month, viewFilter]);

  const today = new Date();
  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // Stats
  const stats = useMemo(() => {
    let campaignStarts = 0, campaignEnds = 0, tasksDue = 0;
    Object.values(eventsMap).forEach(events => {
      events.forEach(e => {
        if (e.type === 'campaign-start') campaignStarts++;
        else if (e.type === 'campaign-end') campaignEnds++;
        else tasksDue++;
      });
    });
    return { campaignStarts, campaignEnds, tasksDue };
  }, [eventsMap]);

  // Calendar grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">{isHe ? 'לוח שנה' : 'Calendar'}</h1>
        <Select value={viewFilter} onValueChange={(v) => setViewFilter(v as ViewFilter)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isHe ? 'הכל' : 'All'}</SelectItem>
            <SelectItem value="campaigns">{isHe ? 'קמפיינים' : 'Campaigns'}</SelectItem>
            <SelectItem value="tasks">{isHe ? 'משימות' : 'Tasks'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card/60 backdrop-blur-sm border-border/50">
          <CardContent className="p-3 flex items-center gap-2">
            <Megaphone size={16} className="text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground">{isHe ? 'התחלות' : 'Starts'}</p>
              <p className="text-lg font-bold text-foreground">{stats.campaignStarts}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 backdrop-blur-sm border-border/50">
          <CardContent className="p-3 flex items-center gap-2">
            <Megaphone size={16} className="text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">{isHe ? 'סיומים' : 'Ends'}</p>
              <p className="text-lg font-bold text-foreground">{stats.campaignEnds}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 backdrop-blur-sm border-border/50">
          <CardContent className="p-3 flex items-center gap-2">
            <CheckSquare size={16} className="text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">{isHe ? 'משימות' : 'Tasks Due'}</p>
              <p className="text-lg font-bold text-foreground">{stats.tasksDue}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Month Nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={isRtl ? nextMonth : prevMonth}>
            <ChevronLeft size={16} />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={isRtl ? prevMonth : nextMonth}>
            <ChevronRight size={16} />
          </Button>
          <span className="text-lg font-semibold text-foreground">{monthLabel}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={goToday} className="text-xs">
          {isHe ? 'היום' : 'Today'}
        </Button>
      </div>

      {/* Calendar Grid */}
      <Card className="bg-card/60 backdrop-blur-sm border-border/50 overflow-hidden">
        <CardContent className="p-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border/50">
            {dayNames.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const events = day ? eventsMap[day.toString()] || [] : [];
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[90px] p-1 border-b border-r border-border/30 transition-colors",
                    day ? "hover:bg-muted/20" : "bg-muted/10",
                    i % 7 === 6 && "border-r-0"
                  )}
                >
                  {day && (
                    <>
                      <div className={cn(
                        "text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                        isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"
                      )}>
                        {day}
                      </div>
                      <div className="space-y-0.5 overflow-hidden max-h-[60px]">
                        {events.slice(0, 3).map((ev, j) => (
                          <div
                            key={j}
                            className={cn(
                              "text-[9px] leading-tight px-1 py-0.5 rounded truncate",
                              ev.type === 'task' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                              ev.type === 'campaign-start' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                              'bg-destructive/15 text-destructive'
                            )}
                            title={ev.label}
                          >
                            {ev.type === 'campaign-start' ? '▶ ' : ev.type === 'campaign-end' ? '■ ' : '☐ '}
                            {ev.label}
                          </div>
                        ))}
                        {events.length > 3 && (
                          <p className="text-[9px] text-muted-foreground px-1">+{events.length - 3}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {isHe ? 'תחילת קמפיין' : 'Campaign Start'}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> {isHe ? 'סיום קמפיין' : 'Campaign End'}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> {isHe ? 'משימה' : 'Task Due'}</span>
      </div>
    </div>
  );
}
