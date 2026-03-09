

## Match TeMPO Submissions to Rewards by Date Proximity

### What
Replace the current two-column side-by-side layout (TeMPO Submissions | Rewards) in the expanded detail view with a **single unified table** that pairs each TeMPO submission with its closest matching reward by amount and date (within 7 days, reward after submission).

### Matching Algorithm
After aggregation, for each technician run a greedy matching pass:
1. Sort TeMPO submissions by date ascending
2. For each submission, find the best unmatched reward where:
   - Amount matches (within $0.01)
   - Reward date is on or after submission date, within 7 days
   - Prefer closest date match
3. Unmatched submissions and rewards remain as standalone rows

### Unified Detail Table Layout
| # | Submission Date | Amount | Reward Date | Reward Source | Status |
|---|----------------|--------|-------------|---------------|--------|
| 1 | Mar 1, 2026    | $25.00 | Mar 3, 2026 | Sendoso       | ✓ Matched |
| 2 | Mar 5, 2026    | $50.00 | Mar 5, 2026 | TeMPO         | ✓ Matched |
| 3 | Mar 8, 2026    | $30.00 | —           | —             | ⚠ Pending |
| — | —              | —      | Mar 10, 2026| Sendoso       | ⚠ Unmatched |

- Matched pairs show both dates side by side
- Unmatched submissions show empty reward columns
- Unmatched rewards show empty submission columns
- Color-code: matched rows normal, unmatched/pending rows with a subtle warning highlight

### Technical Changes

**Dashboard.tsx only** — all changes in the `useMemo` and detail view:

1. Add a `matchRecords` function that takes `tempoRecords[]` and `rewardRecords[]`, returns `MatchedRow[]` with shape:
   ```typescript
   interface MatchedRow {
     tempoRecord?: TempoSubmission;
     rewardRecord?: RewardRecord;
     isMatched: boolean;
   }
   ```

2. Add `matchedRows: MatchedRow[]` to `EmailSummary`, computed after sorting

3. Replace the two-column grid in the expanded detail with a single table rendering `matchedRows`

### No database or backend changes needed.

