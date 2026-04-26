# AgencyOS — RLS QA Suite

Validates Row-Level Security at the **database** level using real per-user
JWTs against the live PostgREST API. The UI is never involved.

## Role mapping

The spec mentions "Viewer" and "Campaign Manager". AgencyOS uses 3 roles.

| Spec role        | AgencyOS role |
| ---------------- | ------------- |
| Owner            | `owner`       |
| Campaign Manager | `admin`       |
| Viewer           | `member`      |

`member` is the lowest tier: read/write within its org, but cannot delete
clients/projects/campaigns and cannot create invitations.

## Setup

Add a runtime secret named `QA_TEST_SECRET` (any long random string), then
export it locally with the same value:

```bash
export QA_TEST_SECRET="<same value>"
export QA_USER_PASSWORD="QaPass!2026"   # optional
```

## Run

```bash
bunx tsx tests/rls/run.ts
```

The suite cleans up all users / orgs it creates, even on failure.
Exit code is non-zero if any test fails.