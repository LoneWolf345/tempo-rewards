

## Honor Search Filter in Expired Rewards Panel

### Change

In `src/pages/Dashboard.tsx` (~line 773-776), the `expiredRecords` filter currently only checks status. Add the `searchQuery` filter so it also matches against `technician_email` (and `technician_name` if present), consistent with how the main table filters.

```tsx
// Before
const expiredRecords = sendosoRecords.filter(s => {
  const st = s.status.toLowerCase();
  return st === "expired" || st === "credited" || st === "expired and credited";
});

// After
const expiredRecords = sendosoRecords.filter(s => {
  const st = s.status.toLowerCase();
  const isExpired = st === "expired" || st === "credited" || st === "expired and credited";
  if (!isExpired) return false;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    return s.technician_email.toLowerCase().includes(q) || 
           (s.technician_name || "").toLowerCase().includes(q);
  }
  return true;
});
```

Single file change: `src/pages/Dashboard.tsx`

