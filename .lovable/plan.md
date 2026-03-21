

## Rewrite Matching to Minimize Date Gaps (Human-Like Matching)

### Problem

The current Pass 1 iterates TeMPO records oldest-first and assigns each to the closest available reward. This per-record greedy approach doesn't optimize globally — an early TeMPO can "steal" a nearby reward, forcing a later TeMPO to match a far-away reward (e.g. Sep 17 → Feb 20), even though swapping assignments would produce tighter pairings overall.

A human matching by hand would scan all possible pairings and connect the closest dates first, regardless of which TeMPO came first.

### Solution: Global Closest-Pair Strategy

Replace the per-TeMPO greedy loop in Pass 1 with a global minimum-gap assignment:

1. Generate all valid candidate pairs: every (TeMPO, reward) where amounts match and reward date ≥ submission date
2. Sort candidates by date difference ascending (smallest gap first)
3. Iterate through sorted candidates — if neither the TeMPO nor the reward is already used, match them

This ensures the tightest date pairings are always selected first, exactly like a human would do.

Passes 2 and 3 remain the same (group matching and reclaim).

### File Change

**`src/pages/Dashboard.tsx`** — `matchRecords` function, Pass 1 (lines 155-177):

Replace the current per-TeMPO loop with:

```
// Pass 1: Exact 1:1 match — global closest-pair assignment
const candidates: { tempo: TempoSubmission; reward: RewardRecord; gap: number }[] = [];
for (const t of sortedTempo) {
  const tDate = parseISO(t.submission_date).getTime();
  for (const r of rewardRecords) {
    if (Math.abs(Number(t.upsell_amount) - r.amount) > 0.01) continue;
    const gap = parseISO(r.date).getTime() - tDate;
    if (gap >= 0) candidates.push({ tempo: t, reward: r, gap });
  }
}
candidates.sort((a, b) => a.gap - b.gap);
for (const c of candidates) {
  if (usedTempo.has(c.tempo.id) || usedRewards.has(c.reward.id)) continue;
  usedTempo.add(c.tempo.id);
  usedRewards.add(c.reward.id);
  rows.push({ tempoRecords: [c.tempo], rewardRecord: c.reward, isMatched: true });
}
```

No other file changes. No database changes.

