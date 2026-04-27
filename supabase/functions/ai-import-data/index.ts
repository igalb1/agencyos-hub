import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit, getClientKey, rateLimitResponse } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a data extraction assistant for a marketing agency CRM.
Given a raw table (rows of objects) from an Excel/CSV file, classify each row into one of:
- "client" (a customer/company)
- "project" (a body of work for a client)
- "campaign" (an ad campaign)
- "task" (a todo item)

Then map the row's columns to our canonical schema using the provided tool. Be tolerant of Hebrew/English headers and synonyms.
For numbers, strip currency/commas. For dates, output ISO YYYY-MM-DD when possible (else null).
Reuse the same client_name / project_name strings across rows so we can link them by name.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Ad-hoc rate limit: 5 imports per minute per IP/user
    const rl = checkRateLimit(`ai-import:${getClientKey(req)}`, 5, 60);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterSec, corsHeaders);
    }

    const { rows } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "No rows provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Truncate to a safe size
    const truncated = rows.slice(0, 500);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              `Classify and extract from these ${truncated.length} rows:\n` +
              JSON.stringify(truncated, null, 2),
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_records",
              description: "Return classified and normalized records.",
              parameters: {
                type: "object",
                properties: {
                  clients: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        industry: { type: "string" },
                        budget: { type: "number" },
                        spend: { type: "number" },
                        leads: { type: "number" },
                        status: { type: "string", enum: ["active", "paused"] },
                      },
                      required: ["name"],
                    },
                  },
                  projects: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        client_name: { type: "string" },
                        status: { type: "string" },
                        budget: { type: "number" },
                        spend: { type: "number" },
                        start_date: { type: "string" },
                        end_date: { type: "string" },
                      },
                      required: ["name"],
                    },
                  },
                  campaigns: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        client_name: { type: "string" },
                        project_name: { type: "string" },
                        platform: { type: "string" },
                        status: { type: "string" },
                        budget: { type: "number" },
                        spend: { type: "number" },
                        leads: { type: "number" },
                        impressions: { type: "number" },
                        clicks: { type: "number" },
                        conversions: { type: "number" },
                        start_date: { type: "string" },
                        end_date: { type: "string" },
                      },
                      required: ["name"],
                    },
                  },
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        client_name: { type: "string" },
                        project_name: { type: "string" },
                        campaign_name: { type: "string" },
                        status: { type: "string" },
                        priority: { type: "string" },
                        due_date: { type: "string" },
                        assignee: { type: "string" },
                      },
                      required: ["title"],
                    },
                  },
                },
                required: ["clients", "projects", "campaigns", "tasks"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_records" } },
      }),
    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "חרגת ממגבלת השימוש. נסה שוב בעוד דקה." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "אזלו הקרדיטים ל-AI. הוסף יתרה בהגדרות הסביבה." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI returned no tool call");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-import-data error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
