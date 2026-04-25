import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Loader2, Headset } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const VISITOR_KEY = "agencyos_support_visitor_id";
const CONV_KEY = "agencyos_support_conv_id";

function getVisitorId() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export default function SupportBot() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(
    typeof window !== "undefined" ? sessionStorage.getItem(CONV_KEY) : null
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: session
            ? "👋 שלום! אני בוט התמיכה של AgencyOS. איך אפשר לעזור?"
            : "👋 שלום! אני בוט התמיכה. אשמח לענות על שאלות לגבי AgencyOS, או לפתוח עבורך פניית תמיכה.",
        },
      ]);
    }
  }, [open, session, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("support-chat", {
        body: {
          message: text,
          conversationId,
          visitorId: session ? undefined : getVisitorId(),
          source: session ? "app" : "public",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        sessionStorage.setItem(CONV_KEY, data.conversationId);
      }
      setMessages((m) => [...m, { role: "assistant", content: data?.reply || "..." }]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ שגיאה: ${e?.message || "נסה שוב מאוחר יותר"}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full shadow-lg",
          "bg-primary text-primary-foreground hover:scale-105 transition-transform",
          "flex items-center justify-center"
        )}
        aria-label={open ? "סגור צ'אט תמיכה" : "פתח צ'אט תמיכה"}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed bottom-24 right-6 z-[100] w-[min(380px,calc(100vw-3rem))] h-[min(560px,calc(100vh-8rem))]",
            "bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-primary/10 border-b border-border flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <Headset className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">תמיכה AgencyOS</div>
              <div className="text-xs text-muted-foreground">בוט AI · מקוון 24/7</div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto rounded-br-sm"
                    : "bg-muted text-foreground mr-auto rounded-bl-sm"
                )}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="bg-muted text-foreground rounded-2xl rounded-bl-sm px-3 py-2 max-w-[85%] mr-auto flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-muted-foreground">חושב...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border bg-background flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="כתוב הודעה..."
              disabled={loading}
              className="flex-1"
            />
            <Button size="icon" onClick={send} disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}