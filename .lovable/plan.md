

## Fix: Group Amount Display Shows Wrong Math

### Problem

Line 881 displays grouped TeMPO amounts as `$X × N = $total`, where `$X` is taken from the **first** record only. When records in the group have different amounts (e.g., one $75 override and one $25 base), it shows `$75.00 × 2 = $100.00` — mathematically wrong because it assumes uniform amounts.

### Fix

**`src/pages/Dashboard.tsx`** (~lines 878-886):

Check if all TeMPO records in the group have the same effective amount:
- **If uniform**: Keep current display: `$75.00 × 2 = $150.00`
- **If mixed**: Show individual amounts summed, e.g. `$75.00 + $25.00 = $100.00`

The total (line 884, via `reduce`) is already correct — only the label formula needs fixing.

### Files

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Fix group amount label to handle mixed amounts |

