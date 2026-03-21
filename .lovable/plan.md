

## Fix: Adjustments Should Be Virtual TeMPO Records, Not Virtual Rewards

### Problem

Currently, adjustments are added to `rewardRecords` (Sendoso side) as virtual rewards. This means a $250 raffle adjustment shows up as an unmatched reward alongside the 6 × $50 Sendoso rewards — none of which match any TeMPO submission.

The user's intent: the $250 adjustment represents what the technician **earned** (TeMPO side). The 6 × $50 Sendoso rewards are the **fulfillment**. The matching engine should group the 6 × $50 rewards against the $250 adjustment, producing one matched group row.

### Changes

**`src/pages/Dashboard.tsx`** — data aggregation section (~lines 411-425):

1. Change adjustments from `rewardRecords` to `tempoRecords` — create a virtual TeMPO submission object for each adjustment:
   - `id`: adjustment ID
   - `submission_date`: adjustment date
   - `upsell_amount`: adjustment amount
   - `expected_reward_amount`: null
   - Mark with a `source: "Adjustment"` indicator

2. Update `tempoCount` and `tempoTotal` instead of `rewardCount` and `rewardTotal`

**`src/pages/Dashboard.tsx`** — matching function:

3. No changes needed to `matchRecords` itself — it already handles group matching (Pass 2 finds subsets of TeMPO that sum to a reward). With the adjustment as a single $250 TeMPO record, Pass 1 won't find a 1:1 match, but Pass 2 will find 5 × $50 rewards that sum to $250... actually, we need the **reverse**: multiple rewards summing to one TeMPO. Currently Pass 2 only groups multiple TeMPO → one reward, not the other way around.

4. **Add a new Pass (reverse group match)**: After Pass 2, add a pass that finds subsets of **unmatched rewards** whose amounts sum to an **unmatched TeMPO** record's amount. This handles the raffle case: one $250 TeMPO virtual record matched by 6 × $50 = $300 (wait — 5 × $50 = $250). The algorithm finds the subset of rewards summing to the TeMPO amount.

**`src/pages/Dashboard.tsx`** — `MatchedRow` type and rendering:

5. Update the `MatchedRow` type to support multiple reward records: add `rewardRecords?: RewardRecord[]` (plural) alongside the existing `rewardRecord`
6. Update rendering logic so that when a row has multiple rewards, they all display in the expanded detail (similar to how grouped TeMPO records display today)

### Rendering Updates

- Adjustment-sourced TeMPO rows show "Adjustment" badge in the Source column instead of "TeMPO"
- Grouped reward rows show all constituent rewards in the expanded detail view
- Summary bar counts adjustments toward the TeMPO/earned side

### Files

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Move adjustments to tempoRecords side; add reverse group-match pass; update MatchedRow type and rendering for multi-reward groups |

No database changes needed.

