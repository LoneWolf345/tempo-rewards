

## Improve Error Handling and Display for CSV Uploads

### Problem
1. The TeMPO upload catches errors but displays only a generic "Failed to upload CSV" message via sonner toast, which auto-dismisses quickly.
2. The console error shows `invalid input syntax for type date: "00:00.0"` — meaning some CSV rows have malformed date values that get passed to the database. The date parsing logic (`split(" ")[0]`) doesn't handle all edge cases (e.g., time-only values, malformed timestamps).
3. After a failed upload, partial data may have been deleted (since the logic deletes all records first), leaving the database in a bad state.

### Changes to `src/pages/Admin.tsx`

1. **Better date validation before insert**: Add a helper function to validate date strings (must match `YYYY-MM-DD` format). Skip rows with invalid dates and collect them as warnings.

2. **Detailed error messages**: Replace generic `toast.error("Failed to upload CSV")` with the actual error message from the database or parsing logic. Use `toast.error(message, { duration: 10000 })` so errors stay visible long enough to read.

3. **Row-level validation summary**: After parsing, show a summary of skipped rows (e.g., "Uploaded 45 records. 3 rows skipped due to invalid dates."). Display skipped row details in the toast description.

4. **Prevent data loss on error**: Move the delete step to after successful validation of all rows, or wrap delete + insert in a transaction-like pattern (delete only after confirming parsed data is valid).

5. **Apply same improvements to Sendoso upload handler** for consistency.

### Single file changed
- `src/pages/Admin.tsx`

