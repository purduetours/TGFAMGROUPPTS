# Family Points on Cloudflare Pages + Supabase

This version keeps the existing `tgfamgrouppts` Pages site and stores new completed special-request credits in your existing **hosted** Supabase project. It does not need D1, the full TGIS server, or a local database. The live TGIS sheet still supplies pickup records and any special requests already recorded there.

1. In the **Supabase SQL Editor** for the hosted project you already use, run [the included migration](migrations/0001_family_dashboard_credits.sql). It creates only `public.tgis_family_dashboard_credits`. Anonymous and authenticated Data API roles cannot access this table. The dashboard uses the Data API for this table, so it must be available through the project's exposed `public` schema.
2. The existing hosted project URL and workbook ID are already set in `wrangler.json`. In Cloudflare Pages **Settings → Variables and Secrets**, add just these **Production runtime secrets**:
   - `SUPABASE_SECRET_KEY`: create a dedicated `sb_secret_…` key in the Supabase API Keys settings. The PostgreSQL password used by the snapshot reader cannot be used as a Data API key. The new key has elevated project access, so keep it out of GitHub, the ZIP and browser code.
   - `FAMILY_PASSWORD`: keep your existing Pages password, if set, or use a random ASCII password of at least 16 characters. The dashboard username is **leadership**.
3. Upload the **contents** of this ZIP to the existing GitHub repository. Keep `wrangler.json`, `functions/`, and `dist/` together. Replace any old Wrangler file; remove duplicate `wrangler.toml` or `wrangler.jsonc` from the same directory. No D1 binding is needed.
4. In Pages **Settings → Builds & deployments** use **Framework preset: None**, **Build command: blank**, and **Build output directory: dist**. Leave **Root directory** blank for a root upload, or enter the directory containing `wrangler.json`. Set **Settings → Runtime → Fail open / closed** to **Fail closed**.
5. Redeploy from Pages, sign in, and check the feed. New credits add four points each and appear in other open dashboards on their next refresh. Record each request in either the sheet or this dashboard to avoid double-counting.

Dashboard credits previously saved in a local JSON file or an earlier D1 deployment are not imported automatically. The package contains no passwords, saved entries, or roster exports. Existing Hub and TGIS tables are unchanged by the migration.

Run `node --test test.mjs` with Node 22 or newer to exercise the Pages handler against synthetic sheet and Supabase responses.

[Pages runtime secrets](https://developers.cloudflare.com/pages/functions/bindings/#secrets) · [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
