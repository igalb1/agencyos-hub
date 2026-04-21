import { createClient } from 'npm:@supabase/supabase-js@2'

// Cron-triggered function: finds organizations whose free trial ends in
// ~3 days and sends a reminder email to each owner. Idempotent — uses an
// idempotencyKey scoped to the org + reminder day so retries/re-runs don't
// produce duplicate emails.

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  // Window: trial_ends_at between now+2.5d and now+3.5d, plan = 'free', active.
  const now = Date.now()
  const windowStart = new Date(now + 2.5 * 24 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(now + 3.5 * 24 * 60 * 60 * 1000).toISOString()

  const { data: orgs, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, trial_ends_at, plan, is_active')
    .eq('plan', 'free')
    .eq('is_active', true)
    .gte('trial_ends_at', windowStart)
    .lte('trial_ends_at', windowEnd)

  if (orgErr) {
    console.error('Failed to query organizations', orgErr)
    return new Response(JSON.stringify({ error: orgErr.message }), { status: 500 })
  }

  let sent = 0
  let skipped = 0

  for (const org of orgs ?? []) {
    // Find owners of this org
    const { data: owners } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', org.id)
      .eq('role', 'owner')

    if (!owners?.length) { skipped++; continue }

    const reminderDay = new Date(org.trial_ends_at).toISOString().slice(0, 10)

    for (const owner of owners) {
      // Get email + name
      const { data: userRow } = await supabase.auth.admin.getUserById(owner.user_id)
      const email = userRow?.user?.email
      if (!email) { skipped++; continue }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', owner.user_id)
        .maybeSingle()

      const idempotencyKey = `trial-reminder-${org.id}-${reminderDay}`

      const { error: invokeErr } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'trial-ending-reminder',
          recipientEmail: email,
          idempotencyKey,
          templateData: {
            name: profile?.full_name ?? null,
            orgName: org.name,
            daysLeft: 3,
          },
        },
      })

      if (invokeErr) {
        console.error('Failed to enqueue trial reminder', { org: org.id, error: invokeErr })
        skipped++
      } else {
        sent++
      }
    }
  }

  return new Response(JSON.stringify({ sent, skipped, candidates: orgs?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})