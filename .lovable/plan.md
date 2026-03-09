

## Group-Match TeMPO Submissions to Consolidated Sendoso Rewards

### Problem
Sendoso sometimes consolidates multiple TeMPO submissions into a single payout (e.g., 3×$25 submissions → 1×$75 reward). The current 1:1 matching by exact amount fails here, leaving everything "unmatched."

### Solution
Add a **group matching** pass after the existing 1:1 matching. When unmatched submissions and rewards remain, try to find groups of submissions whose amounts sum to an unmatched reward's amount, within the 7-day window.

### Updated `MatchedRow` Interface
```typescript
interface MatchedRow {
  tempoRecords?: TempoSubmission[];   // was singular tempoRecord?
  rewardRecord?: RewardRecord;
  isMatched: boolean;
  isGroupMatch?: boolean;             // new flag
}
```

### Matching Algorithm (updated)
1. **Pass 1 — Exact 1:1 match** (existing logic, unchanged)
2. **Pass 2 — Group match**: For each unmatched reward, find a combination of unmatched submissions where:
   - All submission dates are within 7 days before the reward date
   - The sum of submission amounts equals the reward amount (within $0.01)
   - Use a simple subset-sum search (safe — per-technician lists are small)
3. Group-matched rows get `isGroupMatch: true`

### Detail Table UI Changes
- Group-matched rows display multiple submission dates (e.g., "Mar 1, Mar 2, Mar 3") in the Submission Date column
- Show individual amounts with a sum (e.g., "$25 × 3 = $75")
- New status badge: **Grouped** in blue, to distinguish from simple 1:1 matches
- Keep existing Matched (green), Pending (amber), Unmatched (red) badges

### Changes
**Dashboard.tsx only**:
1. Update `MatchedRow` to hold `tempoRecords?: TempoSubmission[]` instead of singular
2. Add group-matching pass in `matchRecords` after the 1:1 pass
3. Update the detail table rendering to handle grouped rows
4. Update all existing references from `row.tempoRecord` to `row.tempoRecords?.[0]` for single matches

