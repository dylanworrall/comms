# Comms Client — Fix Auth Redirect + Billing (Cloud & Local)

## Context
This is the Comms client at `C:\Users\worra\OneDrive\Desktop\comms\ui`. It's a Next.js 15 app with BetterAuth + Convex backend, deployed on Vercel at `https://ui-alpha-silk.vercel.app`. It has a login/signup page with email/password auth. Polar.sh is the billing provider for credit-based usage.

**Local mode** (no `NEXT_PUBLIC_CONVEX_URL`): Free, no auth, no credits needed. Users connect their own API keys.
**Cloud mode** (`NEXT_PUBLIC_CONVEX_URL` set): Requires login, 50 free credits on signup, buy more via Polar.

## Issues to Fix

### ISSUE 1: Login redirect broken on cloud
After successful login at `/login`, user gets stuck on the login page instead of redirecting to `/`.

**Root causes:**
- `src/app/login/page.tsx` line ~67: After `signIn.email()` succeeds, it calls `router.push("/")` with a setTimeout. But the middleware checks for the session cookie, and the cookie may not be set yet, causing middleware to redirect back to `/login` (loop).
- The login page ignores the `callbackUrl` query param that middleware sets.
- The middleware (`src/middleware.ts`) doesn't redirect authenticated users AWAY from `/login`.
- `src/app/page.tsx` has a secondary auth check (`/api/auth`) that looks for `ANTHROPIC_API_KEY` env vars, NOT the BetterAuth session. This is wrong for cloud mode.

**Fixes needed:**
1. In `src/app/login/page.tsx`: After successful signIn/signUp, use `window.location.href` instead of `router.push` to force a full page reload (ensures cookie is sent on the next request). Read `callbackUrl` from `useSearchParams()` and redirect there.
2. In `src/middleware.ts`: Add logic so authenticated users visiting `/login` get redirected to `/`.
3. In `src/app/page.tsx`: Remove or gate the `/api/auth` connectivity check. In cloud mode (Convex mode), the middleware already handles auth. The API key check is only relevant for local mode.

### ISSUE 2: Credit billing not working on cloud
Credits exist in Convex but are never properly checked or deducted.

**Root causes:**
- `src/app/page.tsx`: The `DefaultChatTransport` passes `userEmail` from `useSession()`, but if session hasn't loaded yet, first messages bypass credit check.
- `src/app/api/chat/route.ts` line ~18: `if (isConvexMode() && userEmail)` silently skips credit check when `userEmail` is undefined. Should return 401 instead.
- No Polar webhook route exists — purchased credits are never added to the user's Convex record.
- `src/app/settings/page.tsx` Billing tab uses `authClient.checkoutEmbed()` with product IDs from env vars (`NEXT_PUBLIC_POLAR_PRODUCT_50/200/500`), but these aren't set yet.
- No `polar()` server-side plugin in `convex/auth.ts`.

**Fixes needed:**
1. In `src/app/api/chat/route.ts`: When `isConvexMode()` is true and `userEmail` is missing, return `401 Unauthorized` instead of silently proceeding.
2. In `src/app/page.tsx`: Disable the chat input until `userEmail` is available (session loaded) in cloud mode.
3. Create `src/app/api/webhooks/polar/route.ts`: Handle Polar `checkout.completed` webhook events. Verify the webhook signature, extract the customer email and credit amount from the payload, and call `api.users.addCredits` mutation in Convex.
4. In `src/app/login/page.tsx`: After successful signup, call `POST /api/credits` with the user's email to provision 50 free credits (check if this already happens — if so, skip).

### ISSUE 3: Local mode must not break
All changes must be gated behind `isConvexMode()` or `!!process.env.NEXT_PUBLIC_CONVEX_URL`.

**Verify:**
- Middleware passes through everything when `NEXT_PUBLIC_CONVEX_URL` is not set.
- `/api/chat` works without credits or auth in local mode.
- `/api/credits` returns `{ credits: Infinity }` in local mode.
- The chat page works without session/login in local mode.
- No BetterAuth or Convex errors when running locally without Convex env vars.

## Testing Plan

Run these tests to verify the fixes. If any test fails, fix the underlying issue before moving on.

### Test 1: Local mode works without auth
```bash
# Temporarily unset NEXT_PUBLIC_CONVEX_URL in .env.local (rename it), then:
cd ui && npm run dev
# 1. curl http://localhost:3003 — should return 200, full page HTML
# 2. curl http://localhost:3003/login — should return 200 (not redirect)
# 3. curl http://localhost:3003/api/credits — should return { credits: Infinity, mode: "local" }
# 4. curl -X POST http://localhost:3003/api/chat with a test message — should work without auth
# Restore .env.local after testing
```

### Test 2: Cloud mode requires login
```bash
# With NEXT_PUBLIC_CONVEX_URL set in .env.local:
cd ui && npm run dev
# 1. Open incognito browser to http://localhost:3003 — should redirect to /login
# 2. The /login page should render sign-in/sign-up form
# 3. After signing up with test email, should redirect to / (not stay on /login)
# 4. After redirect, chat page should load with session active
```

### Test 3: Credits work in cloud mode
```bash
# After signing up in Test 2:
# 1. curl http://localhost:3003/api/credits?email=<test-email> — should return { credits: 50 }
# 2. Send a chat message — credits should deduct to 49
# 3. curl credits again — should show 49
# 4. curl -X POST /api/chat without userEmail — should return 401
```

### Test 4: Build succeeds
```bash
cd ui && npx next build
# Must complete with 0 errors
```

## IMPORTANT: Human Intervention Required

You do NOT have access to Convex dashboard, Polar dashboard, or Vercel dashboard. The user has never opened Convex or Polar dashboards — all setup so far has been CLI-only. When you hit a step that requires human action, **STOP and clearly tell the user exactly what to do**. Format it as a numbered checklist they can follow. They will report back to this terminal when done.

### Things that WILL require human intervention:

**Convex environment variables** (set via `npx convex env set` OR the Convex dashboard):
- `SITE_URL` — the Vercel production URL (e.g., `https://ui-alpha-silk.vercel.app`)
- `BETTER_AUTH_SECRET` — a random secret string for BetterAuth sessions
- `POLAR_ACCESS_TOKEN` — from Polar dashboard (Settings > Developers > Personal Access Tokens)
- `POLAR_WEBHOOK_SECRET` — from Polar dashboard (Settings > Webhooks, after creating a webhook endpoint)
- Run `npx convex env list` first to see what's already set. Only ask the user to set what's missing.

**Vercel environment variables** (set via `vercel env add` CLI or Vercel dashboard):
- `NEXT_PUBLIC_CONVEX_URL` — the Convex cloud URL
- `NEXT_PUBLIC_CONVEX_SITE_URL` — the Convex site URL (check for trailing `\n` corruption in `.env.vercel`)
- `NEXT_PUBLIC_POLAR_PRODUCT_50` — Polar product ID for 50-credit pack
- `NEXT_PUBLIC_POLAR_PRODUCT_200` — Polar product ID for 200-credit pack
- `NEXT_PUBLIC_POLAR_PRODUCT_500` — Polar product ID for 500-credit pack
- `ANTHROPIC_API_KEY` — the server-side API key for cloud chat

**Polar setup** (requires Polar dashboard at https://polar.sh):
- Create an organization/project if not already done
- Create 3 products: 50 credits, 200 credits, 500 credits (one-time purchases)
- Copy the product IDs for the Vercel env vars above
- Create a webhook endpoint pointing to `https://ui-alpha-silk.vercel.app/api/webhooks/polar`
- Set event type to `checkout.completed`
- Copy the webhook secret for the Convex env var above
- Generate a Personal Access Token for the Convex env var above

**Convex production deployment:**
- The dev deployment (`blessed-tern-353`) may differ from the prod deployment (`fiery-meerkat-483`). Check which one Vercel is using.
- If env vars need to be set on prod: `npx convex env set <KEY> <VALUE> --prod`
- To push functions to prod: `npx convex deploy` (will prompt for confirmation)

When you need ANY of the above, stop coding and tell the user: "I need you to do X. Here's exactly how: [steps]. Report back when done."

## Key Files
- `src/app/login/page.tsx` — login redirect logic
- `src/middleware.ts` — auth middleware
- `src/app/page.tsx` — main chat page, transport with userEmail
- `src/app/api/chat/route.ts` — credit check/deduction
- `src/app/api/credits/route.ts` — credit provisioning
- `src/app/settings/page.tsx` — billing tab with Polar
- `src/lib/auth-client.ts` — BetterAuth + Polar client
- `src/lib/convex-server.ts` — isConvexMode()
- `convex/auth.ts` — BetterAuth server config (trustedOrigins)
- `convex/users.ts` — credit mutations (getOrCreate, addCredits, deductCredits)
