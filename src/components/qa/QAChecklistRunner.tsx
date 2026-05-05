import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, Printer, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { CHECKS, MODE_LABEL, PLATFORM_LABEL, type Check, type Mode, type Platform } from "@/data/qaChecks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type PlatformFilter = "all" | Platform;

interface RunnerState {
  platform: PlatformFilter;
  checks: Record<string, boolean>;
  notes: Record<string, string>;
}

interface Props {
  mode: Mode;
  storageKey: string;
}

function loadState(key: string): RunnerState {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { platform: "all", checks: {}, notes: {}, ...JSON.parse(raw) };
  } catch {}
  return { platform: "all", checks: {}, notes: {} };
}

export default function QAChecklistRunner({ mode, storageKey }: Props) {
  const [state, setState] = useState<RunnerState>(() => loadState(storageKey));
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [openHow, setOpenHow] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const id = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
    }, 300);
    return () => clearTimeout(id);
  }, [state, storageKey]);

  const filtered = useMemo<Check[]>(
    () => CHECKS[mode].filter((c) => state.platform === "all" || c.platform === state.platform),
    [mode, state.platform],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, Check[]>();
    filtered.forEach((c) => {
      if (!m.has(c.category)) m.set(c.category, []);
      m.get(c.category)!.push(c);
    });
    return Array.from(m.entries());
  }, [filtered]);

  const total = filtered.length;
  const done = filtered.filter((c) => state.checks[c.id]).length;
  const scorePct = total ? Math.round((done / total) * 100) : 0;
  const criticalOpen = filtered.filter((c) => c.critical && !state.checks[c.id]);

  const scoreColor = scorePct >= 85 ? "text-green-500" : scorePct >= 70 ? "text-amber-500" : "text-red-500";
  const barColor = scorePct >= 85 ? "[&>div]:bg-green-500" : scorePct >= 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500";

  const toggleCheck = (id: string) =>
    setState((s) => ({ ...s, checks: { ...s.checks, [id]: !s.checks[id] } }));
  const setNote = (id: string, v: string) =>
    setState((s) => ({ ...s, notes: { ...s.notes, [id]: v } }));

  const reset = () => {
    if (!confirm("לאפס את כל הסימונים וההערות?")) return;
    setState((s) => ({ ...s, checks: {}, notes: {} }));
  };

  const exportMd = () => {
    const today = new Date().toISOString().slice(0, 10);
    const platLabel = state.platform === "all" ? "כל הפלטפורמות" : PLATFORM_LABEL[state.platform];
    let md = `# ${MODE_LABEL[mode]} — ${platLabel}\nתאריך: ${today}\n\n`;
    md += `**ציון: ${scorePct}% (${done}/${total})**\n\n`;
    if (criticalOpen.length) {
      md += `## ⚠️ בדיקות קריטיות פתוחות\n`;
      criticalOpen.forEach((c) => (md += `- [ ] ${c.title}\n`));
      md += `\n`;
    }
    grouped.forEach(([cat, items]) => {
      md += `## ${cat}\n`;
      items.forEach((c) => {
        const mark = state.checks[c.id] ? "x" : " ";
        md += `- [${mark}] **${c.title}**${c.critical ? " 🔴" : ""}\n`;
        const note = state.notes[c.id]?.trim();
        if (note) md += `    > ${note}\n`;
      });
      md += `\n`;
    });
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mode}_${state.platform}_${today}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const platformPills: { key: PlatformFilter; label: string }[] = [
    { key: "all", label: "הכל" },
    { key: "google", label: "Google Ads" },
    { key: "meta", label: "Meta" },
    { key: "tiktok", label: "TikTok" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={exportMd}><Download className="ml-1" />ייצא דוח</Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="ml-1" />הדפס</Button>
        <Button variant="outline" size="sm" onClick={reset}><RotateCcw className="ml-1" />אפס</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {platformPills.map((p) => (
          <button
            key={p.key}
            onClick={() => setState((s) => ({ ...s, platform: p.key }))}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium border transition-all",
              state.platform === p.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-foreground hover:bg-accent"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className={cn("text-4xl md:text-5xl font-bold", scoreColor)}>{scorePct}%</div>
            <div className="text-sm text-muted-foreground mt-1">{done} מתוך {total} בדיקות הושלמו</div>
          </div>
          {criticalOpen.length > 0 ? (
            <div className="flex items-center gap-2 text-red-500 bg-red-500/10 px-3 py-2 rounded-md text-sm">
              <AlertTriangle size={18} />
              ⚠️ {criticalOpen.length} בדיקות קריטיות פתוחות — אין להעלות קמפיין לפני סגירתן
            </div>
          ) : total > 0 ? (
            <div className="flex items-center gap-2 text-green-500 bg-green-500/10 px-3 py-2 rounded-md text-sm">
              <CheckCircle2 size={18} />
              ✅ כל הבדיקות הקריטיות נסגרו
            </div>
          ) : null}
        </div>
        <Progress value={scorePct} className={cn("h-3", barColor)} />
      </Card>

      <div className="space-y-3">
        {grouped.map(([cat, items]) => {
          const catDone = items.filter((c) => state.checks[c.id]).length;
          const catCriticalOpen = items.some((c) => c.critical && !state.checks[c.id]);
          const isOpen = openCats[cat] ?? true;
          return (
            <Collapsible key={cat} open={isOpen} onOpenChange={(v) => setOpenCats((o) => ({ ...o, [cat]: v }))}>
              <Card className="overflow-hidden">
                <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <ChevronDown size={18} className={cn("transition-transform", !isOpen && "-rotate-90")} />
                    <span className="font-semibold text-base">{cat}</span>
                    {catCriticalOpen && <Badge variant="destructive" className="text-xs">קריטי פתוח</Badge>}
                  </div>
                  <span className="text-sm text-muted-foreground">{catDone}/{items.length}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="divide-y divide-border">
                    {items.map((c) => {
                      const checked = !!state.checks[c.id];
                      const howOpen = !!openHow[c.id];
                      return (
                        <div
                          key={c.id}
                          className={cn(
                            "p-4 space-y-2",
                            c.critical && !checked && "bg-red-500/5",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleCheck(c.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn("font-medium", checked && "line-through opacity-60")}>
                                  {c.title}
                                </span>
                                <Badge variant="outline" className="text-xs">{PLATFORM_LABEL[c.platform]}</Badge>
                                {c.critical && <Badge variant="destructive" className="text-xs">Critical</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">למה זה חשוב: {c.why}</p>
                              <button
                                type="button"
                                onClick={() => setOpenHow((o) => ({ ...o, [c.id]: !o[c.id] }))}
                                className="text-xs text-primary hover:underline mt-1"
                              >
                                {howOpen ? "הסתר" : "איך לבדוק"}
                              </button>
                              {howOpen && (
                                <p className="text-xs text-muted-foreground mt-1 bg-muted/50 p-2 rounded">{c.how}</p>
                              )}
                              <Textarea
                                placeholder="הערות..."
                                value={state.notes[c.id] ?? ""}
                                onChange={(e) => setNote(c.id, e.target.value)}
                                className="mt-2 min-h-[60px] text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
        {grouped.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">אין בדיקות עבור הסינון הנוכחי</Card>
        )}
      </div>
    </div>
  );
}