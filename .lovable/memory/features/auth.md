---
name: Auth & Multi-Tenant
description: Authentication flow with email/password, organization-based multi-tenancy, RLS policies
type: feature
---
- Supabase auth with email/password
- Tables: organizations, profiles, organization_members
- Profiles auto-created via trigger on auth.users insert
- Organization created during signup, user becomes owner
- RLS: users see only their org data via get_user_org_ids() security definer function
- AuthContext provides session, user, profile, organization, signOut
- Protected routes redirect to /auth if not logged in
- /reset-password page for password recovery flow
