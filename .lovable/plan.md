

## Clickable Expired/Credited Pill with Reactivation Instructions

### What It Does

Clicking the "Expired/Credited" pill in the status pipeline opens a panel below the pipeline showing all expired/credited rewards for the current technician (or emulated user). Each record shows the reward amount, fulfillment date, expiry date, and status. Below the list, static reactivation instructions guide the technician on next steps.

### Changes

**`src/pages/Dashboard.tsx`**:

1. **State**: Add `showExpiredPanel` boolean toggle state.

2. **Expired pill click handler**: Make the Expired/Credited pill clickable (`cursor-pointer`, hover effect). On click, toggle `showExpiredPanel`.

3. **Expired rewards panel** (new section below the status pipeline, ~line 741): When `showExpiredPanel` is true, render a Card containing:
   - A header: "Expired / Credited Rewards" with a close button
   - A table listing all Sendoso records where status is "expired", "credited", or "expired and credited" for the current view (filtered by technician if non-admin)
   - Columns: Technician (admin only), Amount, Fulfillment Date, Expiry Date, Status badge
   - If no expired records: "No expired or credited rewards found"

4. **Reactivation instructions**: Below the table, a styled info box with static instructions:
   - Check your email for the original gift card link — it may still be redeemable
   - If the link no longer works, contact Sendoso support with your transaction details
   - Reach out to your program administrator to request a replacement reward
   - Include your name, email, reward amount, and original fulfillment date in any request

### Files

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Add clickable expired pill, expandable panel with reward list and reactivation instructions |

