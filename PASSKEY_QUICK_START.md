# Multi-Passkey Support - Quick Start Guide

## Deployment Steps

### 1. Apply Database Migration

```bash
# For production
npx prisma migrate deploy

# For development
npx prisma migrate dev
```

This will add the following fields to the `authenticators` table:
- `name` (optional text field)
- `createdAt` (timestamp with default NOW)
- `lastUsedAt` (optional timestamp)
- Index on `userId`

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Build the Application

```bash
npm run build
```

### 4. Deploy

Deploy your application as usual. The new features will be automatically available.

## User Features

### For End Users

**Adding a New Passkey:**
1. Log in to your account
2. Go to Profile page
3. Scroll to "Passkeys" section
4. Click "Add Passkey" button
5. (Optional) Enter a friendly name like "My iPhone" or "Work Laptop"
6. Complete the biometric authentication prompt
7. Your new passkey will appear in the list

**Deleting a Passkey:**
1. Go to Profile page
2. Find the passkey you want to remove
3. Click the trash icon
4. Confirm deletion
5. Note: You cannot delete your last passkey

**Viewing Passkey Details:**
- Each passkey shows:
  - Name or ID
  - Device type badge
  - Backup status
  - Number of times used
  - When it was created
  - When it was last used

### For Developers

**API Endpoints:**

```typescript
// Get all passkeys for authenticated user
GET /api/passkeys
→ Returns: { passkeys: Passkey[] }

// Delete a passkey
DELETE /api/passkeys
Body: { credentialID: string }
→ Returns: { success: true, message: string }

// Generate options for adding new passkey
POST /api/passkeys/add-options
Body: { name?: string }
→ Returns: { options: PublicKeyCredentialCreationOptions }

// Verify and save new passkey
POST /api/passkeys/add-verify
Body: { response: RegistrationResponseJSON }
→ Returns: { success: true, message: string }
```

**Using the Components:**

```tsx
// In your React component
import { PasskeyList } from '@/components/passkey-list';

export function MyComponent() {
  return (
    <div>
      <h2>Manage Your Passkeys</h2>
      <PasskeyList />
    </div>
  );
}
```

## Testing the Feature

### Manual Testing Steps

1. **Test Initial Registration:**
   - [ ] Go to signup page
   - [ ] Enter email
   - [ ] Complete passkey registration
   - [ ] Verify you're logged in
   - [ ] Check profile page shows the passkey

2. **Test Adding Second Passkey:**
   - [ ] Go to profile page
   - [ ] Click "Add Passkey"
   - [ ] Enter name "Test Device"
   - [ ] Complete registration
   - [ ] Verify both passkeys appear

3. **Test Passkey Display:**
   - [ ] Verify passkey name displays correctly
   - [ ] Check device type badge shows
   - [ ] Confirm "Created" timestamp is correct
   - [ ] Use passkey for login
   - [ ] Check "Last used" timestamp updates

4. **Test Deletion:**
   - [ ] Try to delete last passkey (should fail)
   - [ ] Add a second passkey
   - [ ] Delete first passkey (should succeed)
   - [ ] Verify list updates
   - [ ] Try to delete last remaining passkey (should fail)

5. **Test Login with Multiple Passkeys:**
   - [ ] Log out
   - [ ] Go to login page
   - [ ] Enter email
   - [ ] Complete authentication
   - [ ] Verify you're logged in
   - [ ] Check lastUsedAt timestamp updated

### Automated Testing

```typescript
// Example test
describe('Passkey Management', () => {
  it('should list all user passkeys', async () => {
    const response = await fetch('/api/passkeys', {
      headers: { Cookie: sessionCookie }
    });
    const data = await response.json();
    expect(data.passkeys).toBeInstanceOf(Array);
  });

  it('should prevent deleting last passkey', async () => {
    const response = await fetch('/api/passkeys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialID: 'last-passkey' })
    });
    expect(response.status).toBe(400);
  });
});
```

## Troubleshooting

### Common Issues

**Issue: "Registration failed"**
- Check browser supports WebAuthn (Chrome 67+, Firefox 60+, Safari 13+)
- Ensure HTTPS is enabled (required for WebAuthn)
- Verify `NEXTAUTH_URL` environment variable is correct

**Issue: "Cannot delete passkey"**
- Check error message - you cannot delete your last passkey
- Ensure you're authenticated
- Verify the passkey belongs to your account

**Issue: "Passkeys not showing"**
- Check browser console for errors
- Verify API endpoint is accessible
- Check database migration was applied
- Ensure Prisma client was regenerated

**Issue: "LastUsedAt not updating"**
- Verify you're using the correct authentication flow
- Check that the auth config changes were deployed
- Ensure database column exists (run migration)

### Debug Mode

Enable debug logging:

```typescript
// In your API route
console.log('Passkeys fetch:', passkeys);
console.log('User session:', session);
```

Check browser console:
```javascript
// In browser DevTools
console.log('WebAuthn support:', window.PublicKeyCredential);
```

## Environment Variables

Required environment variables:

```bash
# Database
DATABASE_URL="postgresql://..."

# Authentication
AUTH_SECRET="your-secret-key"
NEXTAUTH_URL="https://yourdomain.com"

# Optional: For development
NODE_ENV="development"
```

## Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome  | 67+     | ✅ Full |
| Edge    | 79+     | ✅ Full |
| Firefox | 60+     | ✅ Full |
| Safari  | 13+     | ✅ Full |
| iOS Safari | 14+ | ✅ Full |
| Android Chrome | 70+ | ✅ Full |

## Security Notes

1. **HTTPS Required**: WebAuthn only works over HTTPS (except localhost)
2. **Session Security**: All operations require valid authentication
3. **Ownership Verification**: Users can only manage their own passkeys
4. **Counter Protection**: WebAuthn counter prevents replay attacks
5. **Last Passkey Protection**: System prevents account lockout

## Performance Notes

- Passkeys are fetched client-side for optimal performance
- Database queries use indexed userId for fast lookups
- Loading states provide smooth user experience
- Optimistic updates reduce perceived latency

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for errors
3. Check server logs for API errors
4. Verify database migration was applied successfully

## Next Steps

After deployment:
1. Test all functionality in staging environment
2. Monitor error logs for any issues
3. Collect user feedback on the experience
4. Consider adding analytics to track usage
5. Plan future enhancements (see PASSKEY_IMPLEMENTATION.md)

## Additional Resources

- [PASSKEY_IMPLEMENTATION.md](./PASSKEY_IMPLEMENTATION.md) - Full implementation details
- [PASSKEY_ARCHITECTURE.md](./PASSKEY_ARCHITECTURE.md) - System architecture diagrams
- [WebAuthn Guide](https://webauthn.guide/) - Understanding WebAuthn
- [SimpleWebAuthn Docs](https://simplewebauthn.dev/) - Library documentation
