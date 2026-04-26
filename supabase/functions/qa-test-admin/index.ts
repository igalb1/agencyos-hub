// QA Test Admin — service-role helpers used ONLY by the Playwright E2E suite.
// Protected by a shared secret header (QA_TEST_SECRET).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-qa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const QA_SECRET = Deno.env.get('QA_TEST_SECRET') ?? '';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function createUser(email: string, password: string, fullName?: string, meta: Record<string, unknown> = {}) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName ?? email.split('@')[0], ...meta },
  });
  if (error) throw error;
  return data.user;
}

async function deleteUserByEmail(email: string) {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const u = list.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
  if (!u) return { deleted: false };
  // Manual cascade — FKs are not declared on these tables.
  await admin.from('organization_members').delete().eq('user_id', u.id);
  await admin.from('organization_invitations').delete().eq('invited_by', u.id);
  await admin.from('user_roles').delete().eq('user_id', u.id);
  await admin.from('profiles').delete().eq('user_id', u.id);
  await admin.auth.admin.deleteUser(u.id);
  return { deleted: true, user_id: u.id };
}

async function deleteOrgByName(name: string) {
  const { data: orgs } = await admin.from('organizations').select('id').eq('name', name);
  for (const o of orgs ?? []) {
    await admin.from('organization_invitations').delete().eq('organization_id', o.id);
    await admin.from('organization_members').delete().eq('organization_id', o.id);
    await admin.from('campaigns').delete().eq('organization_id', o.id);
    await admin.from('projects').delete().eq('organization_id', o.id);
    await admin.from('clients').delete().eq('organization_id', o.id);
    await admin.from('tasks').delete().eq('organization_id', o.id);
    await admin.from('organizations').delete().eq('id', o.id);
  }
  return { deleted: orgs?.length ?? 0 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (req.headers.get('x-qa-secret') !== QA_SECRET || !QA_SECRET) {
    return json({ error: 'forbidden' }, 403);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const { action, payload } = body ?? {};

  try {
    switch (action) {
      case 'ping':
        return json({ ok: true });

      case 'create_user': {
        const u = await createUser(payload.email, payload.password, payload.full_name, payload.meta ?? {});
        return json({ user: { id: u.id, email: u.email } });
      }

      case 'delete_user':
        return json(await deleteUserByEmail(payload.email));

      case 'delete_users': {
        const results: Record<string, unknown> = {};
        for (const email of payload.emails as string[]) results[email] = await deleteUserByEmail(email);
        return json({ results });
      }

      case 'delete_orgs': {
        const results: Record<string, unknown> = {};
        for (const name of payload.names as string[]) results[name] = await deleteOrgByName(name);
        return json({ results });
      }

      case 'cleanup_prefix': {
        // Delete all users whose email starts with prefix, and orgs whose name starts with prefix.
        const prefix = String(payload.prefix);
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const targets = list.users.filter((u) => (u.email ?? '').toLowerCase().startsWith(prefix.toLowerCase()));
        for (const u of targets) await deleteUserByEmail(u.email!);
        const { data: orgs } = await admin.from('organizations').select('name').ilike('name', `${prefix}%`);
        for (const o of orgs ?? []) await deleteOrgByName(o.name);
        return json({ deleted_users: targets.length, deleted_orgs: orgs?.length ?? 0 });
      }

      case 'get_member': {
        const { data: u } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const user = u.users.find((x) => x.email?.toLowerCase() === payload.email.toLowerCase());
        if (!user) return json({ found: false });
        const { data: members } = await admin
          .from('organization_members')
          .select('id, organization_id, role, status, organizations(name, domain, owner_user_id)')
          .eq('user_id', user.id);
        return json({ found: true, user_id: user.id, memberships: members ?? [] });
      }

      case 'set_member_role': {
        const { error } = await admin
          .from('organization_members')
          .update({ role: payload.role })
          .eq('id', payload.member_id);
        if (error) throw error;
        return json({ ok: true });
      }

      case 'set_member_status': {
        const { error } = await admin
          .from('organization_members')
          .update({ status: payload.status })
          .eq('id', payload.member_id);
        if (error) throw error;
        return json({ ok: true });
      }

      case 'remove_member': {
        const { error } = await admin
          .from('organization_members')
          .delete()
          .eq('id', payload.member_id);
        if (error) throw error;
        return json({ ok: true });
      }

      case 'create_invitation': {
        const { data, error } = await admin
          .from('organization_invitations')
          .insert({
            organization_id: payload.organization_id,
            email: payload.email,
            role: payload.role ?? 'member',
            invited_by: payload.invited_by,
            expires_at: payload.expires_at ?? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
          })
          .select('id, token, expires_at')
          .single();
        if (error) throw error;
        return json({ invitation: data });
      }

      case 'expire_invitation': {
        const { error } = await admin
          .from('organization_invitations')
          .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
          .eq('id', payload.invitation_id);
        if (error) throw error;
        return json({ ok: true });
      }

      case 'seed_client': {
        const { data, error } = await admin
          .from('clients')
          .insert({ name: payload.name, organization_id: payload.organization_id })
          .select('id')
          .single();
        if (error) throw error;
        return json({ client: data });
      }

      case 'seed_campaign': {
        const { data, error } = await admin
          .from('campaigns')
          .insert({
            name: payload.name,
            organization_id: payload.organization_id,
            client_id: payload.client_id ?? null,
            status: 'Active',
          })
          .select('id')
          .single();
        if (error) throw error;
        return json({ campaign: data });
      }

      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});