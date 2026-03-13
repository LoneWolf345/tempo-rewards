

## Data Freshness Banner

Add a slim informational banner between the header and the summary cards showing how old the TeMPO and Sendoso data is.

### How it works

- After fetching `tempo_submissions` and `sendoso_records`, compute the most recent `uploaded_at` timestamp from each dataset.
- Display a banner like:  
  `ℹ Data is refreshed approximately once per week. TeMPO data: updated 3 days ago · Sendoso data: updated 5 days ago`
- Use the `Info` icon from lucide-react, muted styling (`bg-muted`, `text-muted-foreground`), and `formatDistanceToNow` from `date-fns` for relative timestamps.

### Changes

**`src/pages/Dashboard.tsx`**
1. Add `uploaded_at` to the `TempoSubmission` and `SendosoRecord` interfaces.
2. Compute `tempoLastUpdated` and `sendosoLastUpdated` from the max `uploaded_at` in each dataset (using `useMemo`).
3. Render a slim `div` with an `Info` icon between `</header>` and the summary cards grid, showing both relative timestamps (or "No data" if empty).

Single file change, no database modifications needed.

