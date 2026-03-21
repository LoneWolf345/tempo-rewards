

## Show Expected Reward Overrides in Dashboard UI

### Problem

The `expected_reward_amount` overrides are stored correctly in the database ($75 on douglast's Dec 15-30 TeMPO records), but the dashboard doesn't display them. The Amount column always shows the raw `upsell_amount` ($25), and the summary totals also use `upsell_amount`. The user can't tell which records have been overridden.

### Changes

**`src/pages/Dashboard.tsx`**:

1. **Amount column display** (~line 850): When `expected_reward_amount` is set, show it with an indicator, e.g. `$25.00 → $75.00` — the original amount in muted text with an arrow to the override amount in bold.

2. **Group match amount display** (~lines 841-848): Same treatment for grouped rows — use override amounts when present.

3. **Summary totals** (~line 405): Use `expected_reward_amount ?? upsell_amount` when summing `tempoTotal` so the "Earned Rewards" card reflects the actual expected reward values, not just the base TeMPO amounts.

4. **Pre-Sendoso auto-match amount** (~line 411): Same fix for inline gift card matches — use the override amount for `rewardTotal`.

### Visual Result

| Before | After |
|--------|-------|
| `$25.00` | `$25.00 → $75.00` |

Records without overrides continue to show just `$25.00` as before.

