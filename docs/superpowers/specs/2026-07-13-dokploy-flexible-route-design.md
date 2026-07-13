# Dokploy Flexible Route Design

## Goal

Keep `themyrul.my.id` behind Cloudflare Flexible SSL without an HTTPS redirect loop after production deployments.

## Root Cause

Dokploy mutates the checked-out compose file by adding domain labels. `compose redeploy` reuses that mutated file while generating the next compose command, so old routers remain on the container. The stale HTTPS router adds `redirect-to-https@file`; Cloudflare Flexible then sends HTTPS visitors to the origin over HTTP, and the origin redirects them back to the same HTTPS URL.

## Design

- Keep the Dokploy domain record as `https: false`, `certificateType: none`, service `sub2api`, port `8080`.
- Keep Cloudflare SSL mode Flexible.
- Use `dokploy compose deploy`, not `dokploy compose redeploy`, for Git releases. Full deploy removes and reclones the source directory before Dokploy adds current domain labels, preventing old router labels from accumulating.
- Keep PostgreSQL, Redis, and Sub2API named volumes unchanged.
- Do not add Traefik labels to the repository compose file while Dokploy owns the domain record.

## Verification

After each deployment:

1. Latest Dokploy deployment status is `done` and queue is empty.
2. Active Sub2API container has only current domain router labels and no `redirect-to-https@file` middleware.
3. `https://themyrul.my.id/health` returns HTTP 200 with `{"status":"ok"}` and no redirect.
4. `/purchase` loads in a browser without a redirect loop.
