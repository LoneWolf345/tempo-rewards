

## Fix: Reverse Group Match Should Prefer Closest-Date Rewards

### Problem

The `findRewardSubsetSum` function (line 245) filters eligible rewards but doesn't sort them by date proximity. It uses depth-first search and grabs the first valid subset — which happens to include Jan 9 rewards instead of the closer Dec 23 ones.

### Fix

**`src/pages/Dashboard.tsx`** — `findRewardSubsetSum` (~line 246):

Sort the `eligible` array by date ascending (closest to the TeMPO/adjustment date first) before running the subset-sum search. Since the recursive search picks the first valid combination it finds depth-first, sorting by date ensures it naturally prefers the earliest (closest) rewards.

```
const eligible = items
  .filter(r => parseISO(r.date).getTime() >= tempoDate)
  .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
```

This one-line change ensures the Dec 23 raffle adjustment matches against the Dec 23 $50 rewards first, leaving the Jan 9 rewards for other matches.

### Files

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Sort eligible rewards by date ascending in `findRewardSubsetSum` |

