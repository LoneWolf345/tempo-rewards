
## Update TeMPO CSV Import to Match Real Data Format

Based on your TeMPO CSV sample, I need to update the import logic:

### TeMPO CSV columns (from your sample)
| CSV Column | Maps To | Notes |
|------------|---------|-------|
| `issued_to_email` | `technician_email` | |
| `amount` | `upsell_amount` | e.g., 25.00 |
| `issued_at` | `submission_date` | e.g., "2025-09-03 00:00:00.000" |
| `status` | `status` | e.g., "Issued" |
| Other columns | (not stored) | id, gift_card_code, etc. |

### Changes Required

**1. Database schema change**
- Make `technician_name` nullable in `tempo_submissions` table (TeMPO CSV doesn't include name)

**2. Update CSV parsing logic in Admin.tsx**
- Map `issued_to_email` → email column
- Map `issued_at` → date column  
- Handle datetime format `2025-09-03 00:00:00.000` (extract date part)

**3. Update status colors**
- Add "Issued" status → use a color (suggest light blue like "Sent")

**4. Update column descriptions**
- Update the card description to reflect actual TeMPO columns
