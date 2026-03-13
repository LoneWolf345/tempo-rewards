

## Switch TeMPO Upload to Upsert Using CSV `id` Column

### Problem
Currently TeMPO uploads delete all existing records and re-insert. The CSV has an `id` column that can be used to track records across uploads — adding new ones and updating existing ones.

### Database Change
Add a `submission_id` text column to `tempo_submissions` with a unique constraint. This stores the CSV's `id` value and enables upsert matching.

**Migration:**
```sql
ALTER TABLE public.tempo_submissions ADD COLUMN submission_id text UNIQUE;
```

### Code Changes — `src/pages/Admin.tsx`

1. **Parse the `id` column** from the CSV headers (find column named `id`).
2. **Include `submission_id`** in each parsed record from the CSV's `id` value.
3. **Replace delete-then-insert with upsert**: Use `.upsert(records, { onConflict: 'submission_id' })` so new records are inserted and existing ones are updated with any changed fields.
4. **Update success toast** to say "Synced X TeMPO records" instead of "Replaced with X records".

