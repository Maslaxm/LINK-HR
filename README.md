# LINK HR

HR management system built with React, TypeScript, Vite, Firebase Authentication, Firestore, Cloud Storage, Security Rules and Cloud Functions. Organizations are optional; every authenticated user gets full Super Admin access without selecting a workspace.

## Requirements

- Node.js 20 or newer
- A Firebase project with Authentication, Firestore, Storage and Functions enabled (Firebase Hosting is optional when using Netlify)
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase Web App configuration

## Local setup

1. Install dependencies:

   ```powershell
   npm install
   npm --prefix functions install
   ```

2. Copy `.env.example` to `.env.local` and fill in the Firebase Web App values.

3. Create `.firebaserc` or link the project:

   ```powershell
   firebase login
   firebase use --add
   ```

4. Enable Email/Password authentication in Firebase Authentication. Create the Firestore database and the Firebase Storage bucket if they do not exist, and make sure the bucket name matches `VITE_FIREBASE_STORAGE_BUCKET`.

5. Optionally seed an organization, roles, leave types and settings:

   ```powershell
   npm --prefix functions run build
   $env:SEED_ADMIN_EMAIL="admin@example.com"
   $env:SEED_ADMIN_PASSWORD="use-a-strong-password"
   $env:SEED_ADMIN_NAME="Super Admin"
   $env:SEED_ORG_NAME="Example Company"
   $env:SEED_ORG_CODE="EXAMPLE"
   npm run seed
   ```

   The seed script is idempotent for the organization, roles, leave types and settings. Use a service account through `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT`, or set the Firebase emulator environment variables. Seeding is optional: any Firebase Authentication account can sign in without a pre-created profile.

6. Deploy the backend:

   ```powershell
   firebase deploy --only firestore:rules,firestore:indexes,storage,functions
   ```

7. Build and deploy the web app:

   ```powershell
   npm run build
   firebase deploy --only hosting
   ```

## Netlify deployment

The repository includes `netlify.toml` with the production build command, publish directory, SPA redirects, Node.js version and static asset caching.

- Build command: `npm run build`
- Publish directory: `dist`
- Node.js: 20 (`.nvmrc` and `netlify.toml`)
- SPA fallback: all routes rewrite to `/index.html` (also included as `public/_redirects` for drag-and-drop deploys)

### Required Netlify environment variables

Add these in **Netlify → Site configuration → Environment variables** before the first production build. They are the same values used locally, but `.env.local` is intentionally not uploaded or committed.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Yes | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase Authentication domain |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase sender ID |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase Web App ID |
| `VITE_USE_EMULATORS` | No | Must be `false` for Netlify; forced to `false` by `netlify.toml` |
| `VITE_EMULATOR_HOST` | No | Local emulator host only |

The production build fails with a clear error if any required Firebase variable is missing. It also rejects a production build with `VITE_USE_EMULATORS=true`.

You can set the variables with the Netlify UI or Netlify CLI:

```powershell
netlify env:set VITE_FIREBASE_API_KEY "your-value"
netlify env:set VITE_FIREBASE_AUTH_DOMAIN "your-project.firebaseapp.com"
netlify env:set VITE_FIREBASE_PROJECT_ID "your-project-id"
netlify env:set VITE_FIREBASE_STORAGE_BUCKET "your-project.firebasestorage.app"
netlify env:set VITE_FIREBASE_MESSAGING_SENDER_ID "your-sender-id"
netlify env:set VITE_FIREBASE_APP_ID "your-web-app-id"
```

Use the exact Firebase Web App configuration for the same project used by Firestore, Storage and Cloud Functions. Do not mix a different local project with the Netlify project.

### Firebase configuration after Netlify assigns the domain

Netlify only hosts the frontend. Firebase backend resources must be deployed separately:

```powershell
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

Then complete these Firebase Console checks:

1. **Authentication → Settings → Authorized domains**: add the Netlify site domain, for example `your-site.netlify.app`, and any custom domain.
2. **Google Cloud API key restrictions**: if the API key is restricted by HTTP referrers, add `https://your-site.netlify.app/*` and any custom domain.
3. **Firestore**: confirm the database exists and the deployed rules allow authenticated access.
4. **Storage**: confirm the bucket named by `VITE_FIREBASE_STORAGE_BUCKET` exists, then deploy `storage.rules`.
5. **Cloud Functions**: confirm the callable functions are deployed in `us-central1`, the same region configured in `src/lib/firebase.ts`.
6. **Email/Password and Google providers**: confirm the sign-in methods used by the app are enabled.

Netlify Functions are not used by this project. Firebase Cloud Functions run separately from Netlify; Netlify only serves the built React application.

### Netlify verification checklist

1. Open the deployed URL in a private window.
2. Sign in, refresh the page, and confirm the session persists.
3. Sign out and confirm authenticated routes redirect to login.
4. Create, read and update a Firestore record.
5. Upload a document, then open and download it.
6. Check the browser console for CORS, `permission-denied` or missing-index errors.

## Development

```powershell
npm run dev
npm test
npm run typecheck
npm run build
```

To use the Firebase Emulator Suite, set `VITE_USE_EMULATORS=true` in `.env.local`, install the emulators with `firebase init emulators` if needed, then run:

```powershell
firebase emulators:start
```

The seed script can target the emulators when `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` are set.

## Backend structure

- `firestore.rules` treats every authenticated user as Super Admin, keeps unauthenticated access denied, and preserves salary privacy and notification ownership.
- `storage.rules` requires authentication, allows Super Admin uploads and validates file size and image uploads.
- `firestore.indexes.json` contains the composite indexes used by the application queries.
- `functions/src/index.ts` contains the callable functions used for administrative user/role management and self-service attendance.
- `src/hooks/useAuth.tsx` accepts every authenticated Firebase user, creates the profile directly through Firestore and keeps an Auth-derived fallback profile so profile reads never block entry.
- `scripts/seed.mjs` optionally creates an initial Super Admin plus organization defaults.

## Authentication and profile initialization

- Firebase Authentication is the only sign-in requirement.
- Any successfully authenticated Firebase user is immediately treated as an active Super Admin.
- On sign-in the app creates or normalizes `users/{uid}` with `role: "super_admin"`, `isSuperAdmin: true`, `isActive: true` and `permissions: ["*"]`.
- Existing profiles load directly from Firestore without calling a Cloud Function.
- There is no invitation, approval, provisioning or account-setup step.
- Firestore read failures never block entry; the Auth-derived profile is used until the profile document is available.
- No organization or workspace selection is required. A `global` workspace is used automatically for new records when no organization exists.
- Super Admin list pages load all records, not only records from a selected organization.

## Callable functions

- `ensureUserProfile` is an optional recovery endpoint that normalizes the authenticated caller to Super Admin; normal login does not depend on it.
- `selfAttendance` records employee check-in/check-out using the organization timezone and the server clock; direct self-writes to attendance are blocked by rules.
- `adminCreateUser` creates Firebase Auth and Firestore user records, links employees and sets custom claims.
- `adminUpdateUser` updates account access, role permissions and employee links.
- `adminDeleteUser` removes account access and clears employee links.
- `adminSaveRole` creates or updates organization roles.
- `adminDeleteRole` removes unused custom roles.

All callable functions treat every authenticated Firebase user as a Super Admin. The Super Admin role cannot be demoted or deleted through the application.

## Important security notes

- This configuration intentionally grants full LINK HR access to every Firebase Authentication user.
- Public sign-up must be managed in Firebase Authentication because any account created there can enter LINK HR as Super Admin.
- Never commit service account files, `.env` files or passwords.
- Firestore and Storage still reject unauthenticated requests.
- Super Admin queries intentionally load across all organizations; organization values are optional metadata.
- Salary data is stored in `employees/{employeeId}/private/compensation` and is restricted to payroll permissions or the employee themself.
