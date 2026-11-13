# Jahat team

A Persian right-to-left idea matrix and team timeline, hosted as static files on GitHub Pages with Supabase Auth and Postgres row-level security. This repository is public: never commit real idea data, account credentials, admin/service keys, or backup exports.

The schema is in `supabase/schema.sql`. It is intended for a dedicated project and is not idempotent. `team_members` binds user IDs to `admin` or `member`; only project administrators should assign these rows. Members can read the shared matrix and timeline; only admins can manage the timeline and tasks. Matrix writes use a revision check to avoid silent overwrites. A failed save should be exported before reloading.

The supplied `config.js` contains only a public publishable key; data access relies on database policies, not on hiding this key. Create and confirm accounts through Supabase Auth, then populate `team_members` with the intended identities. Import the user's private JSON backup only after signing in as a member. User-created data must never be added to this repository.

Run a local preview with `python3 -m http.server 8765`, then open `http://localhost:8765/`. Hosting requires HTTPS. Static vendor dependencies include Supabase JS 2.110.8, daisyUI 5.5.19 and Tailwind browser 4.2.1. Upgrades require retesting auth, responsive layouts, and database access policies.
