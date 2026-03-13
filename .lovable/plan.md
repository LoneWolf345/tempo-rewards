

## Admin User Emulation Mode

### Approach

Add an "emulate user" feature that lets admins select a technician email and view the Dashboard as that user would see it — same data, same layout — with a persistent banner/button to exit emulation mode.

### How It Works

1. **Emulation state** stored in a React context (new `EmulationContext`) so it's accessible across components:
   - `emulatedEmail: string | null`
   - `setEmulatedEmail` / `clearEmulation`

2. **Admin triggers emulation** from the Admin panel — a dropdown or autocomplete of technician emails (sourced from profiles). Selecting one navigates to `/dashboard` with emulation active.

3. **Dashboard data fetching** changes:
   - Currently, non-admin users see only their own data via RLS. Admins already see all data, then the Dashboard groups by email.
   - When emulating, the Dashboard filters its fetched data to only the emulated email, making the view identical to what that technician sees.
   - The admin-specific UI elements (Admin Panel link, reconciliation summary table) are hidden during emulation — only the single-technician expanded view is shown.

4. **Exit emulation** — a fixed banner at the top: "Viewing as [email] — Exit" button clears the emulated email and returns to the normal admin dashboard.

### Files Changed

- **New `src/contexts/EmulationContext.tsx`**: Context provider with `emulatedEmail` state, `startEmulation(email)`, `stopEmulation()`.
- **`src/App.tsx`**: Wrap routes with `EmulationProvider`.
- **`src/pages/Admin.tsx`**: Add "View as user" button/action per profile row, which sets emulated email and navigates to `/dashboard`.
- **`src/pages/Dashboard.tsx`**: 
  - Consume emulation context.
  - When emulating: filter data to emulated email only, hide admin nav/summary, show exit banner.
  - Show the technician's name and email in the header area.
- **`src/components/EmulationBanner.tsx`**: Sticky top banner showing emulated user info + "Exit" button.

### No Database Changes Required

Admins already have SELECT access to all records via RLS. Emulation is purely a client-side view filter.

