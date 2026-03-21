

## Bug: Unmatched Reward-Only Row Not Rendering

### Root Cause

The `matchRecords` function does correctly add unmatched reward-only rows (line 266-269) with `{ rewardRecord: r, isMatched: false }`. However, the rendering code at line 714-716 has a problem when displaying the **amount** for a reward-only row:

```tsx
row.tempoRecords?.[0] ? Number(row.tempoRecords[0].upsell_amount) : row.rewardRecord!.amount
```

This part is fine. But the **real issue** is likely that the row is being produced but the Collapsible content inside a `<tr>/<td>` wrapper may not be expanding to show all rows, or there's a data issue where the 6th reward is already marked as used.

To diagnose definitively, I need to verify the actual data. But more likely, the bug is in how the **sort** function handles reward-only rows at line 273-276: the `!` assertion `a.rewardRecord!` would crash silently if a row somehow has neither tempoRecords nor rewardRecord.

However, the most probable cause: **Pass 3's reclaim logic is consuming the freed reward.** When Pass 3 breaks a 1:1 match, it frees a $25 reward. On the next iteration, `stillUnmatchedRewards` picks up this freed reward. If there happens to be another unmatched TeMPO + a 1:1 donor available, the freed reward gets re-matched — but if the numbers work out perfectly (5 TeMPO, 6 rewards), the freed reward from breaking one 1:1 gets re-used in a new 1:1 match to the same TeMPO. This means the 6th reward ends up used, and no unmatched row is ever created.

**The actual fix**: After Pass 3 completes, re-run a simple Pass 1 step for any freed rewards against any remaining unmatched TeMPO. But more importantly — the freed reward at line 238 is deleted from `usedRewards`, but Pass 3 only creates group matches. The freed $25 reward is never re-added to `usedRewards` unless another iteration picks it up. If no more iterations run (because `stillUnmatchedTempo` is empty), the freed reward falls to line 266-269. So it should appear.

**Alternative diagnosis**: The issue is that after the reclaim, the 5 original matches become 3 matches + 1 group, but the freed reward matches back via a new Pass 3 iteration to consume another 1:1 match — creating a chain reaction that ultimately matches all 6 rewards to the 5 TeMPO records. This would explain why all rows show "Matched" but the total is off by $25.

### Proposed Fix

Add a guard in `matchRecords`: after all passes, verify that the total TeMPO amount across matched rows does not exceed the actual TeMPO total. More practically:

1. **In `matchRecords` (line ~205-256)**: After Pass 3, add a sanity check — if a reward was freed but could not be re-matched (no TeMPO available), ensure it appears as an unmatched row. The current loop at line 266-269 should handle this, but add a `console.log` for debugging to confirm whether the 6th reward is actually in `usedRewards` after Pass 3.

2. **Add a temporary debug log** after line 256 to print `usedRewards.size`, `rows.length`, and the IDs of rewards not in `usedRewards`. This will confirm whether the bug is in the matching logic or the rendering.

3. **If confirmed as a Pass 3 chain-reaction bug**: Add a constraint that Pass 3 should only reclaim if it results in a net reduction of unmatched items (i.e., track total unmatched before and after each reclaim, and revert if no improvement).

### File Changes

**`src/pages/Dashboard.tsx`**:
- After Pass 3 (line ~256), add debug logging to trace whether the 6th reward ends up in `usedRewards`
- Add a net-improvement guard to the Pass 3 reclaim loop: only allow a reclaim if `(unmatchedTempo - 1) + (unmatchedRewards - 1) < unmatchedTempo + unmatchedRewards` — which is always true, but also check that the freed reward doesn't get silently re-consumed without reducing the overall unmatched count
- Ensure the freed reward from a reclaim is tracked separately so it either gets re-matched (reducing unmatched count) or definitely appears as an unmatched row

No database changes needed.

