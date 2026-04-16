# Project Memory

## Core
AgencyOS: dark theme default, Primary #00D4FF cyan, Secondary #A78BFA purple, BG #070C14. DM Sans font.
Hebrew RTL default, English LTR toggle. All strings via src/lib/i18n.ts.
SaaS multi-tenant: each org sees only its data. Lovable Cloud backend enabled.
Design: glassmorphism cards, minimal borders, rounded corners.

## Memories
- [Design tokens](mem://design/tokens) — Full color system, glass utility, theme toggle
- [App structure](mem://features/structure) — 12 sidebar views, AppContext for lang/theme/sidebar
- [Auth & multi-tenant](mem://features/auth) — Supabase auth, organizations table, org_members with roles, profiles auto-created on signup
