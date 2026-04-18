import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENDER_DOMAIN = "notify.login.agencyos.solutions";
const FROM_ADDRESS = `AgencyOS <invites@${SENDER_DOMAIN}>`;

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
    const messageId = crypto.randomUUID();

    const html = renderInviteHtml({
      orgName,
      callerEmail,
      role,
      inviteUrl,
    });
    const roleLabelText = role === "admin" ? "מנהל/ת" : "חבר/ת צוות";
    const text = [
      `הוזמנת להצטרף ל-${orgName} ב-AgencyOS`,
      ``,
      `${callerEmail} הזמין/ה אותך להצטרף לסוכנות ${orgName} כ-${roleLabelText}.`,
      `הקישור תקף ל-7 ימים.`,
      ``,
      `הצטרפות: ${inviteUrl}`,
      ``,
      `אם לא ציפית להזמנה זו, פשוט התעלם/י מהמייל.`,
    ].join("\n");

    // Enqueue to Lovable Emails transactional queue
    const { error: enqueueErr } = await admin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: email,
        from: FROM_ADDRESS,
        sender_domain: SENDER_DOMAIN,
        subject: `הוזמנת להצטרף ל-${orgName} ב-AgencyOS`,
        html,
        purpose: "transactional",
        label: "team_invite",
        idempotency_key: `invite-${invite.token}`,
        message_id: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueErr) {
      console.error("enqueue_email failed:", enqueueErr);
      return json({ error: "Failed to queue email" }, 500);
    }

    // Initial pending log
    await admin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "team_invite",
      recipient_email: email,
      status: "pending",
    });

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

function renderInviteHtml(opts: {
  orgName: string;
  callerEmail: string;
  role: string;
  inviteUrl: string;
}) {
  const { orgName, callerEmail, role, inviteUrl } = opts;
  const roleLabel = role === "admin" ? "מנהל/ת" : "חבר/ת צוות";
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,'Segoe UI',sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 0">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
          <tr><td style="background:linear-gradient(135deg,#070C14,#0f172a);padding:28px 32px;text-align:center">
            <div style="color:#00D4FF;font-size:22px;font-weight:700;letter-spacing:0.5px">AgencyOS</div>
          </td></tr>
          <tr><td style="padding:32px">
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.4;color:#0f172a">הוזמנת להצטרף ל-${escape(orgName)}</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155">
              ${escape(callerEmail)} הזמין/ה אותך להצטרף לסוכנות
              <strong>${escape(orgName)}</strong> ב-AgencyOS כ-<strong>${roleLabel}</strong>.
            </p>
            <p style="margin:0 0 28px;font-size:14px;line-height:1.7;color:#475569">
              לחץ/י על הכפתור כדי להצטרף. הקישור תקף ל-7 ימים.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 28px">
              <tr><td style="background:#00D4FF;border-radius:8px">
                <a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;color:#070C14;text-decoration:none;font-weight:700;font-size:15px">הצטרפות לסוכנות</a>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;font-size:12px;color:#64748b">או העתק/י את הקישור הבא לדפדפן:</p>
            <p style="margin:0;font-size:12px;color:#0ea5e9;word-break:break-all">
              <a href="${inviteUrl}" style="color:#0ea5e9;text-decoration:underline">${inviteUrl}</a>
            </p>
          </td></tr>
          <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0">
            <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5">
              AgencyOS · אם לא ציפית להזמנה זו, פשוט התעלם/י מהמייל.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
