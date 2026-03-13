

## Update Auth Page Email Validation

### Changes to `src/pages/Auth.tsx`

1. **Update placeholder text** on both sign-in and sign-up email inputs from `"you@company.com"` to `"LastF@corp.cableone.net"`

2. **Add helper text** below each email input: `"Use format: LastF@corp.cableone.net"`

3. **Add client-side validation** in both `handleSignIn` and `handleSignUp` to reject emails not ending in `@corp.cableone.net`:
   - Check `email.endsWith("@corp.cableone.net")` before calling auth
   - Show toast error: `"Email must end with @corp.cableone.net"`
   - Return early if invalid

### Single file changed
- `src/pages/Auth.tsx`

