
## Update Sendoso CSV Import to Match Real Data Format

Based on your Sendoso CSV sample, I need to update the import logic to correctly map the columns:

### Current Sendoso CSV columns (from your sample)
| CSV Column | Maps To | Notes |
|------------|---------|-------|
| `recipient_email` | `technician_email` | |
| `status` | `status` | e.g., "Used" |
| `created_at` | `fulfillment_date` | When gift was sent |
| `egift_price` | `reward_amount` | e.g., 125, 75 |
| `updated_at` | (not stored) | |
| `expiry_date` | (not stored) | |

### Changes Required

**1. Database schema change**
- Make `technician_name` nullable in `sendoso_records` table (Sendoso CSV doesn't include name)

**2. Update CSV parsing logic in Admin.tsx**
- Map `recipient_email` → email column
- Map `created_at` → date column  
- Map `egift_price` → amount column
- Handle tab-delimited files (your sample appears tab-delimited)
- Auto-detect delimiter (comma vs tab)
- Parse datetime format `2026-02-27 20:21:49 UTC` to date

**3. Update column descriptions**
- Update the card description to reflect actual Sendoso columns
