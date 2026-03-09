

## Updated Plan: Classify TeMPO Records by Gift Card Code

### Clarification
Short gift card codes (e.g. `7UMK-ZW4DPF-78AB`) represent rewards issued directly from TeMPO. These should count on **both** the submissions side AND the rewards side (flagged as "TeMPO"). Long UUID codes are submissions sent to Sendoso for fulfillment — they only count on the submissions side.

### Changes

**1. Database migration** — Add `gift_card_code` column:
```sql
ALTER TABLE tempo_submissions ADD COLUMN gift_card_code text;
```

**2. Admin.tsx** — Parse `gift_card_code` column during TeMPO CSV upload:
- Find header containing `gift_card_code` or `code`
- Store it in the new column

**3. Dashboard.tsx** — Reclassify during aggregation:

For each TeMPO record:
- **Always** count it on the submissions side (`tempoCount` / `tempoTotal`) — all TeMPO records are submissions
- **If short code** (not UUID pattern): **also** count it on the rewards side as a TeMPO-issued reward

Update `EmailSummary` to track reward source:
```typescript
interface EmailSummary {
  // existing fields...
  tempoRewardCount: number;   // short-code TeMPO records also counted as rewards
  tempoRewardTotal: number;
}
```

The rewards columns would show: `sendosoCount + tempoRewardCount` and `sendosoTotal + tempoRewardTotal`. The detail view would tag reward rows with their source (TeMPO vs Sendoso).

**Detection logic:**
```typescript
const isUUID = (code: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
// UUID or missing → submission only
// Non-UUID code present → submission + reward (flagged TeMPO)
```

**4. UI** — In the summary table, rewards column combines Sendoso + TeMPO-direct rewards. In expanded detail, each reward row shows a source badge: "Sendoso" or "TeMPO".

