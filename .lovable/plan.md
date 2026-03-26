

## Hide Search & Auto-Expand for Non-Admin Associates

### What It Does
Non-admin (associate) users only see their own data, so the search bar is unnecessary. We hide it and automatically expand their single summary row so they see their detail timeline immediately on load.

### Changes — `src/pages/Dashboard.tsx`

1. **Hide search bar for non-admins** (~line 712-728): Wrap the "Global Search" `div` in `{isAdmin && (...)}` so it only renders for admins.

2. **Auto-expand for non-admins** (~line 120-124): Add logic so that when `!isAdmin` and `filteredAndSortedSummaries` has loaded (length > 0), auto-set `expandedEmails` to include all summary emails (typically just one for a regular associate). Similar to the existing emulation auto-expand pattern.

Single file change, no backend changes.

