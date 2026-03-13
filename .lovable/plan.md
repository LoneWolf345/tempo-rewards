

## Updated Dashboard Stat Cards Plan

One correction from the previous plan: **"Expired/Credited"** is a single combined status, not two separate ones.

### Row 1: Three Summary Cards (replacing current four)

1. **Earned Rewards** — Sum of `tempoTotal` from TeMPO submissions. `DollarSign` icon. Shows `$X,XXX.XX`.
2. **Rewards Sent** — Sum of Sendoso reward amounts (filtered to TeMPO emails). `Gift` icon. Shows `$X,XXX.XX`.
3. **Pending Rewards** — Earned minus Sent. `Clock` icon. Amber accent if positive.

### Row 2: Status Pipeline (Chevron Flow)

Five boxes connected by `ChevronRight` icons:

```text
┌────────┐   ┌──────────┐   ┌────────┐   ┌──────┐   ┌──────────────────┐
│  Sent  │ ▸ │ Clicked  │ ▸ │ Opened │ ▸ │ Used │   │ Expired/Credited │
│   42   │   │    30    │   │   25   │   │  20  │   │        7         │
└────────┘   └──────────┘   └────────┘   └──────┘   └──────────────────┘
```

- **Sent → Clicked → Opened → Used** are progression statuses, connected by chevron arrows.
- **Expired/Credited** is a terminal/end state — shown slightly separated (no arrow leading to it), combining counts where status is "expired" or "credited".
- Colors from `getStatusStyles` for each.
- Counts computed from filtered Sendoso records grouped by status.

### Technical Changes

**`src/pages/Dashboard.tsx`**:
- Replace 4-card grid with 3-card grid using `useMemo` for dollar totals.
- Add chevron pipeline row below, using flexbox. "Expired/Credited" merges both status counts into one box.
- Import `ChevronRight`, `DollarSign`, `Gift`, `Clock` from lucide-react and `getStatusStyles` from `@/lib/statusStyles`.

No database changes needed.

