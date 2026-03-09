

## Filter Sendoso Records to TeMPO-Only Emails

### Problem
Sendoso rewards include recipients from other departments who never appear in TeMPO submissions, skewing the dashboard data.

### Solution
In `Dashboard.tsx`, during the `useMemo` aggregation, only process Sendoso records whose `technician_email` matches an email already present in the TeMPO submissions list.

### Changes

**1. Dashboard.tsx** — Update the `emailSummaries` useMemo:
- First pass: collect all TeMPO emails into a `Set<string>` (lowercased)
- Second pass: only process Sendoso records where `technician_email.toLowerCase()` exists in that set
- Skip all other Sendoso records entirely

**2. Admin.tsx** — Add guidance text:
- Update the upload instructions/UI to indicate TeMPO submissions should be uploaded first, then Sendoso rewards
- Reorder the tabs so TeMPO is the first/default tab if not already

No database or backend changes needed.

