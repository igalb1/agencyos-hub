import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Loader2, Plus, Send, Sparkles, Trash2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

type Thread = { id: string; title: string; updated_at: string };
type Msg = { id?: string; role: 'user' | 'assistant'; text: string };

export default function AssistantPage() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang } = useApp();
  const isRtl = lang === 'he';

  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (user) loadThreads(); }, [user]);
  useEffect(() => { if (threadId) loadMessages(threadId); else setMessages([]); }, [threadId]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, sending]);
  useEffect(() => { inputRef.current?.focus(); }, [threadId, sending]);

  async function loadThreads() {
    const { data } = await supabase.from('ai_threads').select('id,title,updated_at').order('updated_at', { ascending: false });
    setThreads((data as Thread[]) || []);
  }
  async function loadMessages(id: string) {
    setLoadingMsgs(true);
    const { data } = await supabase.from('ai_messages').select('id,role,parts').eq('thread_id', id).order('created_at');
    setMessages(((data as any[]) || []).map(m => ({
      id: m.id, role: m.role,
      text: Array.isArray(m.parts) ? m.parts.map((p: any) => p?.text || '').join('') : '',
    })));
    setLoadingMsgs(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text }]);
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', { body: { threadId: threadId || null, message: text } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages(m => [...m, { role: 'assistant', text: data.reply || '...' }]);
      if (!threadId && data.threadId) {
        await loadThreads();
        navigate(`/assistant/${data.threadId}`, { replace: true });
      } else {
        loadThreads();
      }
    } catch (e: any) {
      toast.error(e?.message || 'שגיאה');
      setMessages(m => [...m, { role: 'assistant', text: `⚠️ ${e?.message || 'שגיאה'}` }]);
    } finally {
      setSending(false);
    }
  }

  async function deleteThread(id: string) {
    if (!confirm(isRtl ? 'למחוק את השיחה?' : 'Delete this conversation?')) return;
    await supabase.from('ai_threads').delete().eq('id', id);
    setThreads(t => t.filter(x => x.id !== id));
    if (threadId === id) navigate('/assistant');
  }

  const emptyPrompts = useMemo(() => isRtl
    ? ['כמה לקוחות פעילים יש לי?', 'הצג לי את הקמפיינים של השבוע', 'מה סטטוס בקרות האיכות?', 'סכם את הביצועים של גוגל אדס']
    : ['How many active clients do I have?', 'Show my campaigns this week', 'What is the QA status?', 'Summarize Google Ads performance'],
  [isRtl]);

  return (
    <div className="h-[calc(100vh-4rem)] flex" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Threads list */}
      <aside className="w-64 border-e border-border flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <Button className="w-full" onClick={() => navigate('/assistant')} size="sm">
            <Plus className="h-4 w-4 me-2" /> {isRtl ? 'שיחה חדשה' : 'New chat'}
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {threads.length === 0 && (
              <p className="text-xs text-muted-foreground p-3">{isRtl ? 'אין שיחות עדיין' : 'No conversations yet'}</p>
            )}
            {threads.map(t => (
              <div key={t.id} className={cn('group flex items-center gap-1 rounded-md text-sm', threadId === t.id && 'bg-accent')}>
                <button onClick={() => navigate(`/assistant/${t.id}`)} className="flex-1 text-start truncate p-2 hover:bg-accent rounded-md flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate">{t.title}</span>
                </button>
                <button onClick={() => deleteThread(t.id)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {loadingMsgs ? (
            <div className="flex justify-center pt-10"><Loader2 className="h-6 w-6 animate-spin opacity-50" /></div>
          ) : messages.length === 0 ? (
            <div className="max-w-2xl mx-auto pt-16 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-primary/10 mb-4"><Sparkles className="h-8 w-8 text-primary" /></div>
              <h2 className="text-2xl font-semibold mb-2">{isRtl ? 'עוזר AI פנימי' : 'Internal AI Assistant'}</h2>
              <p className="text-muted-foreground mb-6">{isRtl ? 'שאל שאלות על הלקוחות, הקמפיינים, המודעות, המשימות והנתונים המסונכרנים שלך.' : 'Ask questions about your clients, campaigns, ads, tasks and synced data.'}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {emptyPrompts.map(p => (
                  <button key={p} onClick={() => setInput(p)} className="text-start p-3 rounded-lg border border-border hover:bg-accent text-sm">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <Card className={cn('px-4 py-2.5 max-w-[85%]', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card')}>
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1">
                      <ReactMarkdown>{m.text}</ReactMarkdown>
                    </div>
                  </Card>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <Card className="px-4 py-2.5 bg-card"><Loader2 className="h-4 w-4 animate-spin" /></Card>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border p-3">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={isRtl ? 'שאל משהו על הנתונים שלך…' : 'Ask something about your data…'}
              disabled={sending}
            />
            <Button onClick={send} disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}