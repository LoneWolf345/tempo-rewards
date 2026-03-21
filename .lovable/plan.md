

## Add Adjustments Table for Raffles and Per-Record Overrides

### Summary

Create an `adjustments` table to handle two scenarios that don't fit the normal TeMPO → Sendoso matching:
1. **Raffles/special events**: Admin uploads a list of winners with amounts (e.g., 40 people × varying amounts from a $250 raffle)
2. **Incentive multipliers**: Admin can set an `expected_reward_amount` override on individual TeMPO records so that a $25 TeMPO correctly matches a $75 Sendoso reward

### Database Changes

**New table: `adjustments`**
- `id` (uuid, PK)
- `technician_email` (text, not null)
- `technician_name` (text, nullable)
- `adjustment_type` (text: 'raffle', 'bonus', 'override', etc.)
- `amount` (numeric, not null)
- `adjustment_date` (date, not null)
- `description` (text, nullable — e.g., "Dec 2025 Raffle Winner")
- `uploaded_by` (uuid, not null)
- `uploaded_at` (timestamptz, default now())

RLS: Admins full access; technicians can view their own (matching existing pattern).

**Alter table: `tempo_submissions`**
- Add `expected_reward_amount` (numeric, nullable). When set, matching uses this instead of `upsell_amount` for comparison against Sendoso rewards.

### Matching Logic Changes

**`src/pages/Dashboard.tsx` — `matchRecords`**:
- In Pass 1 (candidate generation), when comparing amounts: use `expected_reward_amount ?? upsell_amount` instead of just `upsell_amount` for the reward-side comparison.
- Adjustment records from the `adjustments` table are converted into "virtual rewards" (same `RewardRecord` shape, source = "Adjustment") and fed into the matching pipeline alongside Sendoso rewards. This means raffle payouts will automatically match against Sendoso disbursements.

### Admin Panel Changes

**`src/pages/Admin.tsx`**:
1. Add a new tab "Adjustments" with:
   - CSV upload for bulk entries (raffle winners). Template: `technician_email, technician_name, amount, date, description`
   - Downloadable CSV template
   - Paginated table of existing adjustments
2. Add an "Expected Reward" column/edit capability to the TeMPO records view — admin can set the override amount per record (inline edit or bulk CSV re-upload with the new column)

### Dashboard Changes

**`src/pages/Dashboard.tsx`**:
- Fetch `adjustments` table alongside TeMPO and Sendoso data
- Include adjustment amounts in the per-technician summary totals (reward side)
- Display adjustment rows in the detail view with a distinct badge (e.g., "Raffle" or "Adjustment")
- When `expected_reward_amount` is set on a TeMPO record, show the override amount in the UI alongside the original

### File Changes

| File | Change |
|------|--------|
| DB migration | Create `adjustments` table + add `expected_reward_amount` to `tempo_submissions` |
| `src/pages/Dashboard.tsx` | Fetch adjustments, integrate into matching, display in UI |
| `src/pages/Admin.tsx` | New Adjustments tab with CSV upload + per-record override editing |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

