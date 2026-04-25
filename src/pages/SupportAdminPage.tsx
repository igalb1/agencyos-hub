import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Headset, MessageSquare, Ticket, Send, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conv {
  id: string;
  user_id: string | null;
  visitor_id: string | null;
  subject: string | null;
  status: string;
  source: string;
  last_message_at: string;
  created_at: string;
}

interface Msg {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
}

interface TicketRow {
  id: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  email_sent: boolean;
  email_error: string | null;
  created_at: string;
  conversation_id: string | null;
}

export default function SupportAdminPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"conversations" | "tickets">("conversations");
  const [convs, setConvs] = useState<Conv[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) return;
    loadAll();
    const ch = supabase
      .channel("support-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, loadAll)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, (payload: any) => {
        if (payload.new?.conversation_id === activeId) {
          setMessages((m) => [...m, payload.new as Msg]);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isSuperAdmin, activeId]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId]);

  async function loadAll() {
    setLoading(true);
    const [{ data: c }, { data: t }] = await Promise.all([
      supabase
        .from("support_conversations")
        .select("*")
        .order("last_message_at", { ascending: false })
        .limit(100),
      supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setConvs((c as Conv[]) || []);
    setTickets((t as TicketRow[]) || []);
    setLoading(false);
  }

  async function loadMessages(id: string) {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    setMessages((data as Msg[]) || []);
  }

  async function sendAdminReply() {
    if (!activeId || !reply.trim()) return;
    const text = reply.trim();
    setReply("");
    await supabase.from("support_messages").insert({
      conversation_id: activeId,
      role: "admin",
      content: text,
    });
    await supabase
      .from("support_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", activeId);
  }

  async function setConvStatus(id: string, status: string) {
    await supabase.from("support_conversations").update({ status }).eq("id", id);
  }

  async function setTicketStatus(id: string, status: string) {
    await supabase.from("support_tickets").update({ status }).eq("id", id);
  }

  if (authLoading) return null;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const active = convs.find((c) => c.id === activeId);

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Headset className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">תמיכה</h1>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          רענן
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          variant={tab === "conversations" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("conversations")}
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          שיחות ({convs.length})
        </Button>
        <Button
          variant={tab === "tickets" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("tickets")}
        >
          <Ticket className="w-4 h-4 mr-2" />
          טיקטים ({tickets.length})
        </Button>
      </div>

      {tab === "conversations" && (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)]">
          {/* Conv list */}
          <div className="border border-border rounded-lg overflow-y-auto bg-card">
            {convs.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">אין שיחות עדיין</div>
            )}
            {convs.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "w-full text-right p-3 border-b border-border hover:bg-muted/50 transition",
                  activeId === c.id && "bg-muted"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <Badge variant={c.status === "open" ? "default" : c.status === "escalated" ? "destructive" : "secondary"}>
                    {c.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{c.source}</span>
                </div>
                <div className="text-sm font-medium truncate">{c.subject || "ללא נושא"}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(c.last_message_at).toLocaleString("he-IL")}
                </div>
              </button>
            ))}
          </div>

          {/* Active conv */}
          <div className="border border-border rounded-lg flex flex-col bg-card overflow-hidden">
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                בחר שיחה לצפייה
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">{active.subject || "שיחה"}</div>
                    <div className="text-xs text-muted-foreground">
                      {active.user_id ? `User: ${active.user_id.slice(0, 8)}` : `Visitor: ${active.visitor_id?.slice(0, 8)}`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {active.status !== "resolved" && (
                      <Button size="sm" variant="outline" onClick={() => setConvStatus(active.id, "resolved")}>
                        סגור
                      </Button>
                    )}
                    {active.status === "resolved" && (
                      <Button size="sm" variant="outline" onClick={() => setConvStatus(active.id, "open")}>
                        פתח מחדש
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                        m.role === "user" && "bg-muted mr-auto",
                        m.role === "assistant" && "bg-primary/10 mr-auto",
                        m.role === "admin" && "bg-primary text-primary-foreground ml-auto"
                      )}
                    >
                      <div className="text-[10px] opacity-70 mb-1">
                        {m.role} · {new Date(m.created_at).toLocaleTimeString("he-IL")}
                      </div>
                      {m.content}
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-border flex gap-2">
                  <Input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendAdminReply();
                      }
                    }}
                    placeholder="תגובה כאדמין..."
                  />
                  <Button size="icon" onClick={sendAdminReply} disabled={!reply.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "tickets" && (
        <div className="space-y-3">
          {tickets.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">אין טיקטים</div>
          )}
          {tickets.map((t) => (
            <div key={t.id} className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={t.status === "new" ? "destructive" : t.status === "resolved" ? "default" : "secondary"}>
                      {t.status}
                    </Badge>
                    {t.email_sent ? (
                      <Badge variant="outline" className="text-green-500 border-green-500">אימייל נשלח</Badge>
                    ) : (
                      <Badge variant="outline" className="text-orange-500 border-orange-500">אימייל לא נשלח</Badge>
                    )}
                  </div>
                  <div className="font-semibold">{t.subject}</div>
                  <div className="text-sm text-muted-foreground">{t.email}</div>
                </div>
                <div className="flex gap-1">
                  {t.status !== "in_progress" && (
                    <Button size="sm" variant="outline" onClick={() => setTicketStatus(t.id, "in_progress")}>
                      בטיפול
                    </Button>
                  )}
                  {t.status !== "resolved" && (
                    <Button size="sm" variant="outline" onClick={() => setTicketStatus(t.id, "resolved")}>
                      סגור
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-sm whitespace-pre-wrap bg-muted/50 rounded p-3 mt-2">{t.message}</div>
              {t.email_error && (
                <div className="text-xs text-destructive mt-2">שגיאת אימייל: {t.email_error}</div>
              )}
              <div className="text-xs text-muted-foreground mt-2">
                {new Date(t.created_at).toLocaleString("he-IL")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}