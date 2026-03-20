

## Rewrite Matching Logic: Oldest-First, No Time Limit, Group TeMPO → Reward

### Summary

Replace the current two-pass matching algorithm with a simpler, more accurate approach: process TeMPO submissions oldest-first, match each to the earliest available reward (same technician, on or after the submission date), and allow multiple TeMPO submissions to group against a single larger reward.

### Current Behavior

- Pass 1: 1:1 exact-amount match within a 45-day window
- Pass 2: Subset-sum grouping of TeMPO records against unmatched rewards (also 45-day window)
- Pre-Sendoso TeMPO records with inline gift card codes are self-matched (stays the same)

### New Algorithm

Per technician (same email), after self-matching pre-Sendoso records:

1. **Sort** TeMPO submissions by `submission_date` ascending (oldest first)
2. **Sort** rewards by date ascending
3. **Pass 1 — 1:1 exact match**: For each unmatched TeMPO, find the earliest unmatched reward with the same amount, dated on or after the submission date. No time limit.
4. **Pass 2 — Group TeMPO → one reward**: For each unmatched reward (sorted by date ascending), find a combination of unmatched TeMPO submissions (all dated on or before the reward date) whose amounts sum to the reward amount. This covers Sendoso batching multiple submissions into one payout.
5. **Leftovers**: Any remaining unmatched TeMPO or rewards become unmatched rows.

### Key Differences from Current

| Aspect | Current | New |
|--------|---------|-----|
| Time window | 45-day cap | No limit (reward must be same day or later) |
| Direction check | `reward_date - tempo_date >= 0` | Same — reward must be on or after |
| Group direction | TeMPO → reward | Same — multiple TeMPO summing to one reward |
| Processing order | Sorted but best-diff selected | Strictly oldest TeMPO first, earliest reward first |

### File Changes

**`src/pages/Dashboard.tsx`** — `matchRecords` function (lines ~141-228):

1. Remove the 45-day constant and window checks from Pass 1 (line 158). Replace with: `diff >= 0` (reward date on or after submission date).
2. Remove the 45-day window from `findSubsetSum` (lines 176-180). Replace eligible filter with: `rewardDate >= tempoDate` (i.e. `diff >= 0`).
3. In Pass 2, iterate unmatched rewards oldest-first (sort ascending before grouping loop).
4. No changes to self-matching of pre-Sendoso inline gift card codes (lines 248-260) — those remain auto-matched.

No database changes needed. No other files affected.

