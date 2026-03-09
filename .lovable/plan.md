
## TeMPO Upsell Rewards Tracker

A tool for technicians to verify their upsell rewards by comparing TeMPO submissions against Sendoso gift card records.

### Core Features

**Authentication & Users**
- Email/password self-registration for technicians
- Admin role with elevated permissions
- User management for admins (approve/disable accounts)
- Architecture ready for future SSO integration

**Admin Dashboard**
- Upload TeMPO upsell CSV (email, name, upsell amount, submission date, status)
- Upload Sendoso fulfillment CSV (same key fields)
- View all records across all technicians
- User management panel

**Technician Dashboard**
- See personal summary stats: total TeMPO submissions, total Sendoso rewards, discrepancies
- View list of their upsell records with matching status
- Filter by date range

**Discrepancy Report**
- Summary cards showing: Total submissions, Total rewards received, Missing rewards count, Total amounts
- Highlight mismatches (TeMPO records with no matching Sendoso record by email + date)
- Clear visual indicators for unmatched/missing rewards

### Technical Approach
- **Lovable Cloud** for database, auth, and file storage
- Database tables: users, user_roles, tempo_submissions, sendoso_records
- CSV parsing on upload with validation
- Row-level security so technicians only see their own data

### Pages
1. **Login/Register** - Self-service signup with email
2. **Technician Dashboard** - Personal summary + record list
3. **Admin Dashboard** - CSV uploads + full data access + user management
