---
name: Auth & Multi-Tenant
description: Authentication flow with email/password, organization-based multi-tenancy, RLS policies
type: feature
---
- Supabase auth with email/password
- Tables: organizations, profiles, organization_members
- Profiles auto-created via trigger on auth.users insert
- Org names UNIQUE (case-insensitive). Signup: existing org → joins as member; new org → user becomes owner (temporary, super_admin reassigns); invite token → role from invite
- Roles: owner (set by super_admin), admin (promoted by owner), member (default)
- Frozen users: profiles.is_frozen=true → AuthContext signs them out on login. Toggle via admin_manage_user RPC (super_admin only)
- Super admin user mgmt: admin_get_users RPC + admin_manage_user (freeze/unfreeze/remove_from_org) + transfer_org_ownership
- RLS: users see only their org data via get_user_org_ids() security definer function
- AuthContext provides session, user, profile, organization, signOut
- Protected routes redirect to /auth if not logged in
- /reset-password page for password recovery flow
