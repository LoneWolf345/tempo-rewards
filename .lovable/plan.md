

## Per-Email Summary Comparison

Replace the current individual-submission matching logic with an email-level aggregation approach.

### What Changes

**Dashboard.tsx** - Rework the main content area:

1. **Aggregate by email**: Group both `tempoSubmissions` and `sendosoRecords` by `technician_email` (case-insensitive). For each email, compute:
   - Total submission count and total submission amount (from TeMPO)
   - Total reward count and total reward amount (from Sendoso)
   - Difference in counts and amounts

2. **Replace "Missing Rewards" section and the two side-by-side tables** with a single **"Technician Summary" table** showing:
   | Email | Submissions | Submission Total | Rewards | Reward Total | Difference | Status |
   - Difference column = submission amount - reward amount
   - Status: show a green "Matched" badge when counts and amounts align, or a destructive "Mismatch" badge when they differ

3. **Highlight mismatches**: Rows where submission count != reward count or amounts differ get a visual callout (e.g., amber/red text on the difference, destructive badge)

4. **Keep summary cards** at top but update "Missing Rewards" card to show count of emails with mismatches instead of individual missing submissions

5. **Add expandable detail** (optional/nice-to-have): clicking an email row could expand to show the individual submissions and rewards for that email, but the primary view is the summary

### Technical Approach

- Build a `Map<string, { tempoCount, tempoTotal, sendosoCount, sendosoTotal }>` from the existing fetched data (no new queries needed)
- Compute the discrepancy per email
- Sort: mismatches first, then alphabetical
- No database or schema changes required

