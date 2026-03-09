

## Deduplication Strategy for CSV Uploads

Since the user re-uploads the full list every time, the simplest and most reliable approach is **clear-and-replace**: delete all existing records before inserting the new full set.

### Changes

**Admin.tsx** - Update both `handleTempoUpload` and `handleSendosoUpload`:

1. Before inserting parsed CSV records, **delete all existing rows** from the respective table (same logic as the existing `clearTempoRecords`/`clearSendosoRecords` functions)
2. Then insert the full CSV as before
3. Show a toast like "Replaced X records with Y new records"
4. Remove the separate "Clear All Records" buttons since clearing is now automatic on each upload

This avoids complex duplicate detection (matching on email+date+amount combos) and matches the user's workflow of always uploading the complete dataset.

### Why not upsert/dedupe?
- The tables have no natural unique key (same email can have multiple entries on the same date for the same amount)
- Adding a composite unique constraint would risk false deduplication
- Clear-and-replace is simpler, faster, and exactly matches the stated workflow

