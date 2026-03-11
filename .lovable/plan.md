

## Add `transaction_id` to Sendoso Records and Use It for Matching

### Problem
Currently, matching relies on a composite key (email + date + amount), which can produce false matches when the same technician receives multiple rewards of the same amount on the same day. Sendoso now provides a `transaction_id` that uniquely identifies each reward.

### Database Change
- Add a nullable `transaction_id` text column to `sendoso_records` with a unique constraint. Nullable so legacy records without a transaction_id still work.

### Upload Logic Change (`Admin.tsx`, `handleSendosoUpload`)
1. **Parse** the new `transaction_id` column from CSV (detect header `transaction_id`).
2. **Matching strategy** — two-tier:
   - If `transaction_id` is present in the CSV row, match by `transaction_id` (exact, fast, reliable).
   - If `transaction_id` is absent (older CSV format), fall back to the current composite key match (email + date + amount).
3. **Existing map** — fetch all records, build two maps: one by `transaction_id`, one by composite key.
4. On match, update `status`, `expiry_date`, and backfill `transaction_id` if the existing record didn't have one.
5. On insert, include `transaction_id`.

### Also parse `updated_at`
The new CSV includes `updated_at`. We won't store it separately, but we should handle it gracefully during parsing (skip it, don't error).

### UI Update
- Add `transaction_id` to the `SendosoRecord` interface.
- Optionally display it in the admin Sendoso records table (small "ID" column).

### Files Changed
- **Migration**: Add `transaction_id` column (nullable, unique) to `sendoso_records`
- **`src/pages/Admin.tsx`**: Update CSV parsing, matching logic, interfaces, and table display
- **`src/pages/Dashboard.tsx`**: Update `SendosoRecord` interface to include `transaction_id`

