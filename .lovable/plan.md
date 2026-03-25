

## Move Search Bar Above KPIs & Make KPIs Search-Aware

### What It Does

The search bar moves from inside the Technician Summary card to above the KPI cards. When empty, it shows "All Associates" and KPIs aggregate everyone. When a search term is entered, all KPIs (Earned, Sent, Pending) and the Status Pipeline counts update to reflect only matching associates.

### Changes — `src/pages/Dashboard.tsx`

1. **Move search bar** (~line 852-861) from inside the Technician Summary `CardHeader` to a new section between the Data Freshness Banner and the KPI cards (~line 709). Add a label like "Showing: All Associates" or "Showing: X associates matching '{query}'".

2. **Make `activeSummaries` search-aware** (~line 590): Change it from `emailSummaries` to `filteredAndSortedSummaries` always (which already applies `searchQuery`). This makes `totalTempoValue`, `totalSendosoValue`, and `pendingValue` react to search.

3. **Make `statusCounts` search-aware** (~line 599-612): Add `searchQuery` to the dependency array and filter `sendosoRecords` by the search query (matching `technician_email` or `technician_name`) in addition to the existing `tempoEmailSet` check.

4. **Keep status filter dropdown** inside the Technician Summary card header (it's table-specific filtering, not global).

### Summary of scope

Single file change: `src/pages/Dashboard.tsx`. No database or backend changes needed.

