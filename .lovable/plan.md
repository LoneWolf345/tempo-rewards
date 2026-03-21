

## Add Many-to-Many Group Matching (Pass 2c)

### Problem

With triple incentive overrides, a $25 TeMPO overridden to $75 won't match a single $50 Sendoso reward (Pass 1 fails), and there's no single reward equal to $75. Pass 2b (1:N reverse) would need $50+$25 rewards, which may not exist. What's needed: group multiple TeMPO records and multiple rewards where the totals balance. For example, 2×$75 TeMPO ($150) matched against 3×$50 Sendoso ($150).

### Approach

Add a **Pass 2c: Many-to-Many Group Match** after Pass 2b and before the reclaim pass. The algorithm:

1. Collect remaining unmatched TeMPO and unmatched rewards
2. Sort both by date ascending
3. For each combination of unmatched TeMPO subsets, compute the total and search for a reward subset with the same total
4. To keep this tractable, use a greedy accumulation strategy: iterate through unmatched TeMPO records, accumulate a running total, and at each step check if a subset of unmatched rewards sums to that running total. When a match is found, emit the group.

This is bounded by per-technician list sizes (typically small).

### Changes

**`src/pages/Dashboard.tsx`**:

1. **New Pass 2c** (~after line 267): Add many-to-many matching logic that groups multiple unmatched TeMPO records and multiple unmatched rewards where `sum(tempo amounts) == sum(reward amounts)`, with date constraints (all rewards must be on or after the earliest TeMPO date in the group).

2. **MatchedRow type**: Already supports `tempoRecords` (plural) and `rewardRecords` (plural) from the reverse group match work — no type changes needed.

3. **Rendering**: The existing group match rendering already handles multiple TeMPO records and multiple rewards in expanded detail views. The row will show as a group match with the combined totals.

### Algorithm Detail

```text
For each unmatched TeMPO (sorted by date):
  Try accumulating with other unmatched TeMPOs:
    runningTotal = sum of accumulated TeMPO amounts
    earliestDate = min date of accumulated TeMPOs
    Search unmatched rewards for a subset summing to runningTotal
      (rewards must be on/after earliestDate)
    If found → emit matched group, mark all as used
```

### Files

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Add Pass 2c many-to-many group matching after Pass 2b |

No database changes needed.

