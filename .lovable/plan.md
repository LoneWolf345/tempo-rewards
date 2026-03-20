

## Fix Greedy Matching: Maximize Overall Matches

### Problem

Pass 1 greedily consumes all possible 1:1 exact matches before Pass 2 runs grouping. This can leave an odd number of TeMPO records for grouping, stranding both a TeMPO submission and a larger reward as unmatched — even though pairing them in a group would have produced a better overall result.

In the screenshot: 7 Sep 3 TeMPOs ($25 each) + 5 rewards (mix of $25 and $50). Pass 1 takes 2 for 1:1 $25 matches → 5 left → only 2 pairs possible → 1 TeMPO + 1 $50 reward stranded.

### Solution

Add a **Pass 3** after the current Pass 1 and Pass 2: attempt to "reclaim" 1:1 matches to resolve remaining unmatched pairs.

**Algorithm:**

After Pass 2, if there are still unmatched TeMPO records AND unmatched rewards:
1. For each unmatched reward, check if combining an unmatched TeMPO with a TeMPO currently used in a 1:1 match (same amount, valid date) would sum to the reward amount.
2. If so, break the 1:1 match — move that TeMPO into a new group with the unmatched TeMPO, matched to the unmatched reward.
3. The $25 Sendoso reward freed by breaking the 1:1 match becomes unmatched (or re-attempt matching it to remaining unmatched TeMPOs).

This is simpler and safer than reordering passes, since it only reclaims when it produces a net improvement (reduces total unmatched count).

### File Change

**`src/pages/Dashboard.tsx`** — `matchRecords` function (~line 203, after Pass 2):

Insert a Pass 3 block that:
1. Collects still-unmatched TeMPO and rewards after Pass 2
2. For each unmatched reward, scans existing 1:1 matched rows to find a "donor" TeMPO that, combined with an unmatched TeMPO, sums to the reward amount (with valid dates)
3. If found: removes the 1:1 row from `rows`, creates a new grouped row, and pushes the freed reward back for re-matching
4. Repeats until no more reclaims are possible

No database changes. No other files affected.

