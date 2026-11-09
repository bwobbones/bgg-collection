# Project Rules

## Deployment

- **Always deploy to Cloudflare after making changes.** Do not leave a change only in the local working tree or on GitHub.
- Deploy with `npx wrangler deploy` (or `npm run deploy`).
- After deploying, verify the new version is live with `npx wrangler deployments status`.
- The production Worker is `bgg-collection` (see `wrangler.json`), served at `https://bgg-collection.bwobbones.workers.dev` behind Cloudflare Access.

## UI defaults

- The **Max Play Time** filter must have no default value. Leave it blank so all playing times are included until the user enters a number.
- Do not add a default maximum playing time in the client, server, worker, or CLI code.
