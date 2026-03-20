

## Fix Data Reconciliation Bugs

### Bug 1: "Expired and Credited" status not recognized
**File:** `src/pages/Dashboard.tsx` (line ~374)

The pipeline status counter checks for `"expired"` or `"credited"` as separate strings, but the actual Sendoso data contains `"Expired and Credited"` as one value. Fix: add `st === "expired and credited"` to the condition.

Also affects 71 records / $2,450 that currently vanish from the status pipeline.

### Bug 2: 14-day matching window too narrow
**File:** `src/pages/Dashboard.tsx` (lines ~158, ~176–179)

Sendoso batches rewards on a roughly weekly/biweekly cycle. Real data shows fulfillment routinely 15–30 days after TeMPO submission. The current 14-day window misses these, creating false "mismatch" statuses.

**Fix:** Widen the matching window from 14 days to 45 days. This covers the observed batch cadence with margin, while still preventing spurious cross-month matches.

### Changes

**`src/pages/Dashboard.tsx`:**
1. In `matchRecords` Pass 1 (line ~158): change `14 * 24 * 60 * 60 * 1000` to `45 * 24 * 60 * 60 * 1000`.
2. In `findSubsetSum` (line ~176): same change from 14 to 45 days.
3. In `statusCounts` (line ~374): add `|| st === "expired and credited"` to the expired/credited check.

No database changes needed.

