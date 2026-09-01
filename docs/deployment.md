# Deployment

## Environments

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Safe for the browser; RLS still applies |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server) + `.env.local` | **Never** prefix with `NEXT_PUBLIC_` |

## Supabase Cloud

1. Create a project in the Supabase dashboard.
2. Run `supabase/migrations/20240901000000_init.sql` (SQL editor or `supabase db push` with the CLI linked).
3. Optional: run `supabase/seed.sql` in a non-production database only.
4. Authentication → Providers → Email enabled. Confirmations can be disabled on the first staging project if you need to log in immediately.
5. Copy URL, anon key, and service role key into Vercel env vars.

## Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel. Framework preset: Next.js.
3. Set the three env vars. Redeploy after changing env.
4. Production URL should match any Auth redirect URLs you add in Supabase (`https://<project>.vercel.app/**` and `http://localhost:3000/**` for local).

## Local Supabase (optional)

```bash
npx supabase start
npx supabase db reset
```

Point `.env.local` at the local API URL and anon key printed by `supabase start`.

## Release checklist

- [ ] `npm run test:run`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Migrations applied to the target Supabase project
- [ ] Env vars present on Vercel
- [ ] First admin user can sign in
