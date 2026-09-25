# Local Tagioo staging

Use the installed Node 20 runtime and run `sh scripts/start-local-staging.sh`
from this checkout. The panel listens
only on `http://127.0.0.1:3101`; stop it with Ctrl-C. It creates a fresh
`data/local-staging/` database and owner-only `credentials.env` on first run.
Read that local file for the `staging-admin` login. Do not copy production
records or credentials into it.

The launcher fails if this checkout has a `.env` file, clears inherited
environment variables, disables automatic container launch, and has no
production API, email, billing, worker, or Shopify secrets. This is an isolated
local panel for code tests, not an always-on Shopify reviewer environment. To
test the full Shopify flow separately, create a distinct Shopify development
app with its own credentials and point it to a separately exposed staging
panel. Do not use `shopify app dev` against the public production app config;
its automatic URL updates could redirect the live app.
