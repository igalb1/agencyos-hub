import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitePayload {
  email: string;
  role?: "admin" | "member";
  appUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");

    // Identify caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const callerId = userData.user.id;
    const callerEmail = userData.user.email ?? "";

    const body: InvitePayload = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const role = body.role === "admin" ? "admin" : "member";
    const appUrl = body.appUrl || "https://login.agencyos.solutions";

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "Invalid email" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Find caller's org (must be admin/owner)
    const { data: membership } = await admin
      .from("organization_members")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", callerId)
      .limit(1)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return json({ error: "Only owners or admins can invite" }, 403);
    }

    const orgId = membership.organization_id;
    const orgName = (membership as any).organizations?.name ?? "Your agency";

    // Check user not already a member
    const { data: existingUser } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId);

    // Cleanup any prior pending invite for same email+org (so token regenerates)
    await admin
      .from("organization_invitations")
      .delete()
      .eq("organization_id", orgId)
      .eq("email", email)
      .is("accepted_at", null);

    // Create invitation
    const { data: invite, error: inviteErr } = await admin
      .from("organization_invitations")
      .insert({ organization_id: orgId, email, role, invited_by: callerId })
      .select("token, expires_at")
      .single();

    if (inviteErr) return json({ error: inviteErr.message }, 500);

    const inviteUrl = `${appUrl}/accept-invite?token=${invite.token}`;

    // Send email via Resend
    if (!RESEND_KEY) return json({ error: "Email service not configured" }, 500);

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;color:#0f172a">
        <h1 style="font-size:22px;margin:0 0 16px">הוזמנת להצטרף ל-${escape(orgName)}</h1>
        <p style="font-size:14px;line-height:1.6;color:#334155">
          ${escape(callerEmail)} הזמין/ה אותך להצטרף לסוכנות <strong>${escape(orgName)}</strong> ב-AgencyOS כ-<strong>${role === "admin" ? "מנהל/ת" : "חבר/ת צוות"}</strong>.
        </p>
        <p style="font-size:14px;line-height:1.6;color:#334155">
          כדי להצטרף, לחץ/י על הכפתור למטה. הקישור תקף ל-7 ימים.
        </p>
        <div style="margin:32px 0">
          <a href="${inviteUrl}" style="display:inline-block;background:#00D4FF;color:#070C14;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
            הצטרפות לסוכנות
          </a>
        </div>
        <p style="font-size:12px;color:#64748b;line-height:1.5;word-break:break-all">
          או העתק/י את הקישור: <br><a href="${inviteUrl}" style="color:#0ea5e9">${inviteUrl}</a>
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0">
        <p style="font-size:11px;color:#94a3b8">AgencyOS · אם לא ציפית להזמנה זו, פשוט התעלם/י מהמייל.</p>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: "AgencyOS <invites@agencyos.solutions>",
        to: [email],
        subject: `הוזמנת להצטרף ל-${orgName} ב-AgencyOS`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend error:", errText);
      return json({ error: "Failed to send email", detail: errText }, 502);
    }

    return json({ success: true, inviteUrl });
  } catch (e: any) {
    console.error("send-invite error:", e);
    return json({ error: e.message || "Internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
