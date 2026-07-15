import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are AgencyOS Assistant — an internal AI helper for an agency manager using AgencyOS.
You help the user answer questions about their own clients, campaigns, ads, QA checklists, tasks and platform sync data (Google Ads, Facebook Ads, LinkedIn Ads).

Rules:
- Detect the user's language (Hebrew or English) and reply in the same language. Default Hebrew.
- ALWAYS use the tools to fetch fresh data before answering questions about the user's accounts. Do not guess numbers.
- Be concise. Use short bullet lists or small markdown tables when helpful.
- Never expose internal IDs, tokens, or other users' data.
- If a tool returns empty, say so honestly.`;

const tools = [
  { type: "function", function: { name: "list_clients", description: "List the user's clients with basic info.", parameters: { type: "object", properties: { limit: { type: "number" } } } } },
  { type: "function", function: { name: "list_campaigns", description: "List campaigns. Optional filters: client_id, platform (google/facebook/linkedin/other), status, search by name.", parameters: { type: "object", properties: { client_id: { type: "string" }, platform: { type: "string" }, status: { type: "string" }, search: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "list_ads", description: "List ads inside a campaign (from campaign_ads table).", parameters: { type: "object", properties: { campaign_id: { type: "string" }, search: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "list_qa", description: "List QA checklists with progress.", parameters: { type: "object", properties: { campaign_id: { type: "string" }, status: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "list_tasks", description: "List tasks. Optional filters: status, client_id, campaign_id.", parameters: { type: "object", properties: { status: { type: "string" }, client_id: { type: "string" }, campaign_id: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "sync_summary", description: "Get counts and totals of synced campaigns per platform (google/facebook/linkedin).", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "list_platform_campaigns", description: "List synced campaigns from a specific ad platform with performance metrics.", parameters: { type: "object", properties: { platform: { type: "string", enum: ["google", "facebook", "linkedin"] }, search: { type: "string" }, limit: { type: "number" } }, required: ["platform"] } } },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function runTool(name: string, args: any, admin: any, userId: string) {
  const lim = Math.min(Number(args?.limit) || 50, 200);
  try {
    if (name === "list_clients") {
      const { data } = await admin.from("clients").select("id,name,status,industry,contact_email").eq("user_id", userId).limit(lim);
      return data || [];
    }
    if (name === "list_campaigns") {
      let q = admin.from("campaigns").select("id,name,client_id,platform,status,budget,spend,leads,cpl,start_date,end_date").eq("user_id", userId);
      if (args?.client_id) q = q.eq("client_id", args.client_id);
      if (args?.platform) q = q.ilike("platform", `%${args.platform}%`);
      if (args?.status) q = q.eq("status", args.status);
      if (args?.search) q = q.ilike("name", `%${args.search}%`);
      const { data } = await q.limit(lim);
      return data || [];
    }
    if (name === "list_ads") {
      let q = admin.from("campaign_ads").select("id,name,campaign_id,status,platform,creative_type,notes").eq("user_id", userId);
      if (args?.campaign_id) q = q.eq("campaign_id", args.campaign_id);
      if (args?.search) q = q.ilike("name", `%${args.search}%`);
      const { data } = await q.limit(lim);
      return data || [];
    }
    if (name === "list_qa") {
      let q = admin.from("qa_checklists").select("id,title,campaign_id,client_id,status,progress,total_items,completed_items,updated_at").eq("user_id", userId);
      if (args?.campaign_id) q = q.eq("campaign_id", args.campaign_id);
      if (args?.status) q = q.eq("status", args.status);
      const { data } = await q.order("updated_at", { ascending: false }).limit(lim);
      return data || [];
    }
    if (name === "list_tasks") {
      let q = admin.from("tasks").select("id,title,status,priority,due_date,client_id,campaign_id,assigned_to").eq("user_id", userId);
      if (args?.status) q = q.eq("status", args.status);
      if (args?.client_id) q = q.eq("client_id", args.client_id);
      if (args?.campaign_id) q = q.eq("campaign_id", args.campaign_id);
      const { data } = await q.limit(lim);
      return data || [];
    }
    if (name === "sync_summary") {
      const out: any = {};
      for (const [plat, table] of [["google", "google_ads_campaigns"], ["facebook", "facebook_ads_campaigns"], ["linkedin", "linkedin_ads_campaigns"]] as const) {
        const { data } = await admin.from(table).select("id,spend,impressions,clicks").eq("user_id", userId);
        const rows = data || [];
        out[plat] = {
          campaigns: rows.length,
          total_spend: rows.reduce((s: number, r: any) => s + (Number(r.spend) || 0), 0),
          total_impressions: rows.reduce((s: number, r: any) => s + (Number(r.impressions) || 0), 0),
          total_clicks: rows.reduce((s: number, r: any) => s + (Number(r.clicks) || 0), 0),
        };
      }
      return out;
    }
    if (name === "list_platform_campaigns") {
      const table = args.platform === "google" ? "google_ads_campaigns" : args.platform === "facebook" ? "facebook_ads_campaigns" : "linkedin_ads_campaigns";
      let q = admin.from(table).select("id,name,account_name,status,spend,impressions,clicks,ctr,cpc").eq("user_id", userId);
      if (args?.search) q = q.ilike("name", `%${args.search}%`);
      const { data } = await q.limit(lim);
      return data || [];
    }
    return { error: `unknown tool ${name}` };
  } catch (e: any) {
    return { error: String(e?.message || e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { threadId: incomingThread, message } = await req.json();
    if (!message || typeof message !== "string") return json({ error: "message required" }, 400);

    // Get/create thread
    let threadId = incomingThread as string | null;
    let newTitle: string | null = null;
    if (!threadId) {
      const title = message.trim().slice(0, 60);
      const { data: t, error } = await admin.from("ai_threads").insert({ user_id: user.id, title }).select("id,title").single();
      if (error) return json({ error: error.message }, 500);
      threadId = t.id;
      newTitle = t.title;
    } else {
      const { data: t } = await admin.from("ai_threads").select("id").eq("id", threadId).eq("user_id", user.id).maybeSingle();
      if (!t) return json({ error: "Thread not found" }, 404);
    }

    // Save user message
    await admin.from("ai_messages").insert({ thread_id: threadId, user_id: user.id, role: "user", parts: [{ type: "text", text: message }] });

    // Load history
    const { data: history } = await admin.from("ai_messages").select("role,parts").eq("thread_id", threadId).order("created_at").limit(40);
    const chatMessages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];
    for (const m of history || []) {
      const text = Array.isArray(m.parts) ? m.parts.map((p: any) => p?.text || "").join("") : "";
      if (text) chatMessages.push({ role: m.role, content: text });
    }

    // Tool call loop
    let assistantText = "";
    for (let step = 0; step < 6; step++) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-3.5-flash", messages: chatMessages, tools, tool_choice: "auto" }),
      });
      if (!aiRes.ok) {
        const txt = await aiRes.text();
        console.error("AI error", aiRes.status, txt);
        if (aiRes.status === 429) return json({ error: "יותר מדי בקשות, נסה שוב עוד רגע." }, 429);
        if (aiRes.status === 402) return json({ error: "נגמרו הקרדיטים ל-AI." }, 402);
        return json({ error: "AI service error" }, 500);
      }
      const aiData = await aiRes.json();
      const choice = aiData.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        chatMessages.push({ role: "assistant", content: choice.content || "", tool_calls: toolCalls });
        for (const tc of toolCalls) {
          let args: any = {};
          try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
          const result = await runTool(tc.function?.name, args, admin, user.id);
          chatMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 8000) });
        }
        continue;
      }
      assistantText = choice?.content || "";
      break;
    }

    if (!assistantText) assistantText = "לא הצלחתי לענות הפעם.";

    await admin.from("ai_messages").insert({ thread_id: threadId, user_id: user.id, role: "assistant", parts: [{ type: "text", text: assistantText }] });

    return json({ threadId, title: newTitle, reply: assistantText });
  } catch (e: any) {
    console.error(e);
    return json({ error: String(e?.message || e) }, 500);
  }
});