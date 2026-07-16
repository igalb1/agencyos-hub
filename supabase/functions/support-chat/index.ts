import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkRateLimit, getClientKey, rateLimitResponse } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are AgencyOS Support Bot — a friendly, concise AI assistant for AgencyOS, an all-in-one agency management platform.

AgencyOS features include:
- Multi-workspace (organization) management with team roles (owner/admin/member)
- Clients, Projects & Campaigns management
- Tasks & Timeline (Kanban + calendar)
- Ads integrations: Google Ads, LinkedIn Ads (live performance data)
- Reports & Performance dashboards

Guidelines:
- Detect the user's language (Hebrew or English) and reply in the same language.
- Be concise. Use markdown sparingly.
- For account/billing/data issues you cannot resolve, OR if the user explicitly asks for a human, call the create_support_ticket tool to escalate to the human support team. Always ask for their email first if not provided.
- Never invent features that don't exist. If unsure, suggest opening a ticket.
- Don't share internal IDs, tokens, or technical implementation details.`;

const tools = [
  {
    type: "function",
    function: {
      name: "create_support_ticket",
      description: "Escalate to a human support agent by creating a ticket and sending an email. Use when the bot cannot resolve the issue or the user asks to talk to a human.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "User's contact email" },
          subject: { type: "string", description: "Short subject line" },
          summary: { type: "string", description: "Concise summary of the user's issue (2-5 sentences)" },
        },
        required: ["email", "subject", "summary"],
        additionalProperties: false,
      },
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Ad-hoc rate limit: 20 messages per minute per IP/user
    const rl = checkRateLimit(`support-chat:${getClientKey(req)}`, 20, 60);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec, corsHeaders);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ error: "AI not configured" }, 500);
    }

    const body = await req.json();
    const { conversationId, message, visitorId, source } = body as {
      conversationId?: string;
      message: string;
      visitorId?: string;
      source?: "app" | "public";
    };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return json({ error: "Message is required" }, 400);
    }
    if (message.length > 4000) {
      return json({ error: "Message too long" }, 400);
    }

    // Identify caller (optional)
    let userId: string | null = null;
    let userEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser();
      if (data.user) {
        userId = data.user.id;
        userEmail = data.user.email ?? null;
      }
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const { data: conv, error: convErr } = await admin
        .from("support_conversations")
        .insert({
          user_id: userId,
          visitor_id: userId ? null : (visitorId || crypto.randomUUID()),
          source: source || (userId ? "app" : "public"),
          subject: message.slice(0, 80),
        })
        .select("id")
        .single();
      if (convErr) {
        console.error("create conv error", convErr);
        return json({ error: "Could not start conversation" }, 500);
      }
      convId = conv.id;
    }

    // Save user message
    await admin.from("support_messages").insert({
      conversation_id: convId,
      role: "user",
      content: message,
    });

    // Load history (last 20 messages)
    const { data: history } = await admin
      .from("support_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(20);

    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT + (userEmail ? `\n\nUser is logged in. Email: ${userEmail}` : "\n\nUser is anonymous (public site visitor).") },
      ...(history || []).map((m: any) => ({
        role: m.role === "admin" ? "assistant" : m.role,
        content: m.content,
      })),
    ];

    // Call Lovable AI
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        tools,
        tool_choice: "auto",
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI error", aiRes.status, txt);
      if (aiRes.status === 429) return json({ error: "Rate limit exceeded, please try again shortly." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted. Please contact support." }, 402);
      return json({ error: "AI service error" }, 500);
    }

    const aiData = await aiRes.json();
    const choice = aiData.choices?.[0]?.message;
    let assistantText: string = choice?.content || "";
    let ticketCreated: any = null;

    // Handle tool calls
    const toolCalls = choice?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      for (const tc of toolCalls) {
        if (tc.function?.name === "create_support_ticket") {
          try {
            const args = JSON.parse(tc.function.arguments || "{}");
            const ticketEmail = args.email || userEmail;
            if (!ticketEmail) {
              assistantText = assistantText || "Please share your email address so I can open a ticket for you.";
              continue;
            }
            const { data: ticket } = await admin
              .from("support_tickets")
              .insert({
                conversation_id: convId,
                user_id: userId,
                visitor_id: userId ? null : visitorId,
                email: ticketEmail,
                subject: args.subject || "Support request",
                message: args.summary || message,
                status: "new",
              })
              .select()
              .single();

            // Mark conversation as escalated
            await admin
              .from("support_conversations")
              .update({ status: "escalated", last_message_at: new Date().toISOString() })
              .eq("id", convId);

            // Send email to support inbox
            await sendTicketEmail(ticket, userEmail);
            ticketCreated = ticket;

            if (!assistantText) {
              assistantText = userEmail
                ? "✅ Your ticket has been opened. Our team will reach out by email shortly."
                : `✅ Ticket opened. We'll respond to ${ticketEmail} shortly.`;
            }
          } catch (e) {
            console.error("ticket tool error", e);
          }
        }
      }
    }

    if (!assistantText) {
      assistantText = "I'm here to help. Could you provide more details?";
    }

    // Save assistant reply
    await admin.from("support_messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: assistantText,
      metadata: ticketCreated ? { ticket_id: ticketCreated.id } : null,
    });

    // Update conv timestamp
    await admin
      .from("support_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", convId);

    return json({
      conversationId: convId,
      reply: assistantText,
      ticket: ticketCreated,
    });
  } catch (e) {
    console.error("support-chat error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

async function sendTicketEmail(ticket: any, fromUserEmail: string | null) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY missing — skipping email");
    return;
  }
  try {
    const html = `
      <h2>New Support Ticket #${ticket.id.slice(0, 8)}</h2>
      <p><strong>From:</strong> ${escapeHtml(ticket.email)}${fromUserEmail && fromUserEmail !== ticket.email ? ` (logged-in: ${escapeHtml(fromUserEmail)})` : ""}</p>
      <p><strong>Subject:</strong> ${escapeHtml(ticket.subject)}</p>
      <hr/>
      <p style="white-space:pre-wrap">${escapeHtml(ticket.message)}</p>
      <hr/>
      <p style="color:#888;font-size:12px">Created at ${ticket.created_at}<br/>Conversation ID: ${ticket.conversation_id || "N/A"}</p>
    `;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AgencyOS Support <support@notify.login.agencyos.solutions>",
        to: ["agencyos-ai@outlook.com"],
        reply_to: ticket.email,
        subject: `[Ticket] ${ticket.subject}`,
        html,
      }),
    });
    const ok = res.ok;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin
      .from("support_tickets")
      .update({
        email_sent: ok,
        email_error: ok ? null : await res.text(),
      })
      .eq("id", ticket.id);
  } catch (e) {
    console.error("send ticket email failed", e);
  }
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}