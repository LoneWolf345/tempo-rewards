

## Add Expected Reward Override UI to Admin Panel

### What This Solves

For triple incentive periods, a TeMPO record shows $25 earned but Sendoso sent $75. The `expected_reward_amount` column already exists in the database — we just need a way to set it.

### Changes

**`src/pages/Admin.tsx`** — TeMPO Records tab:

1. **Inline edit button** on each TeMPO row: clicking opens a small popover/dialog where the admin types the expected reward amount (e.g. 75). Saving calls `supabase.from('tempo_submissions').update({ expected_reward_amount }).eq('id', row.id)`.

2. **Bulk override via CSV**: Add a "Set Overrides" button that accepts a CSV with columns `submission_id, expected_reward_amount` (or `technician_email, submission_date, upsell_amount, expected_reward_amount` for matching). This updates existing TeMPO records in bulk.

3. **Visual indicator**: Show the override amount in the TeMPO table with a small badge (e.g. "→ $75") next to the original $25 amount, so admins can see which records have overrides at a glance.

### Files

| File | Change |
|------|--------|
| `src/pages/Admin.tsx` | Add inline edit + bulk CSV override for `expected_reward_amount` on TeMPO records |

No database changes needed — column already exists.

