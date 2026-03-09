## Change Sendoso Upload from Clear-and-Replace to Upsert

### Problem

The current upload deletes all existing records before inserting, which wipes historical data. You want to upload any CSV (historical or current) and have it intelligently add new records and update existing ones.

### Database Change

Add `expiry_date` column to `sendoso_records` (nullable date) to support the historical CSV field. Also add an UPDATE RLS policy for admins on `sendoso_records` (currently missing).

### Upload Logic Change (Admin.tsx, `handleSendosoUpload`)

1. **Parse CSV** — detect `expiry_date` column in addition to existing ones
2. **Remove the delete-all step** — no more clearing the table
3. **For each parsed record**, check for an existing match using `technician_email` (case-insensitive) + `fulfillment_date` + `reward_amount`:
  - **Match found** → update `status` and `expiry_date` on the existing record
  - **No match** → insert as a new record
4. **Toast summary** → "Imported X new records, updated Y existing records"

### Matching Logic

Query all existing `sendoso_records` into memory (grouped by email+date+amount key), then for each CSV row build the same key and check locally. This avoids N individual DB queries. Updates and inserts are batched.

### UI Updates

- Update card description to mention `expiry_date` as optional column
- Show `expiry_date` in the Sendoso Records table if present
- Update Dashboard's `SendosoRecord` interface to include `expiry_date`

### Files Changed

- **Migration**: Add `expiry_date` column + admin UPDATE policy on `sendoso_records`
- `**src/pages/Admin.tsx**`: Rewrite upload handler to upsert, add expiry_date to table display
- `**src/pages/Dashboard.tsx**`: Add `expiry_date` to interface