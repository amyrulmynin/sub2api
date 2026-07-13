# Dokploy Flexible Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore `themyrul.my.id`, deploy image commit `4bd65af0`, and prove `/purchase` renders `RM` without an HTTPS redirect loop.

**Architecture:** Use Dokploy full Git deployment so the source directory is removed and recloned before current HTTP-only domain labels are injected. Keep Cloudflare Flexible, Dokploy domain record, and all named volumes unchanged.

**Tech Stack:** Git, GHCR, Docker Compose, Dokploy CLI, Cloudflare, Playwright

## Global Constraints

- Keep the Dokploy domain record as `https: false`, `certificateType: none`, service `sub2api`, port `8080`.
- Keep Cloudflare SSL mode Flexible.
- Use `dokploy compose deploy`, not `dokploy compose redeploy`, for Git releases.
- Keep PostgreSQL, Redis, and Sub2API named volumes unchanged.
- Do not add Traefik labels to the repository compose file while Dokploy owns the domain record.

---

### Task 1: Clean Git Deployment

**Files:**
- Verify: `deploy/docker-compose.dokploy.yml`
- Verify: `docs/superpowers/specs/2026-07-13-dokploy-flexible-route-design.md`

**Interfaces:**
- Consumes: GHCR image `ghcr.io/amyrulmynin/sub2api:my-custom` at digest `sha256:f31aee38ad65589c5c3597d970af9daf752ba5c15e0f602a2a1770e07384ab20`
- Produces: clean Dokploy container with only router `sub2api-custom-stack-qygobq-66-web`

- [ ] **Step 1: Push current documentation commit**

Run:

```powershell
git push origin feature/myr-mudahpay:my-custom
```

Expected: `origin/my-custom` points to current `HEAD` and contains payment fix commit `4bd65af0`.

- [ ] **Step 2: Run full clean deployment**

Run:

```powershell
dokploy compose deploy --composeId "XgHg5-aBb8AePZn318LjS" --title "Clean deploy MYR amount input" --description "Full Git clone; image sha256:f31aee38ad65589c5c3597d970af9daf752ba5c15e0f602a2a1770e07384ab20; preserve named volumes"
```

Expected: response says deployment queued.

- [ ] **Step 3: Wait for deployment terminal state**

Query `deployment.allByCompose` for compose `XgHg5-aBb8AePZn318LjS` every five seconds.

Expected: latest deployment title is `Clean deploy MYR amount input` and status becomes `done`; fail on `error`, `failed`, or `cancelled`.

- [ ] **Step 4: Verify active container labels**

Read active Sub2API container with `docker.getContainersByAppNameMatch`, then inspect it with `docker.getConfig`.

Expected:

```text
image=ghcr.io/amyrulmynin/sub2api:my-custom
router=traefik.http.routers.sub2api-custom-stack-qygobq-66-web
redirect-to-https@file absent
routers 64-web and 65-web absent
```

### Task 2: Production Verification

**Files:**
- Test script: `C:/Users/ADMINI~1/AppData/Local/Temp/opencode/playwright-test-purchase-myr-live.js`

**Interfaces:**
- Consumes: healthy production route from Task 1
- Produces: HTTP and browser evidence for live MYR rendering

- [ ] **Step 1: Verify health without redirects**

Run:

```powershell
curl.exe -sS -i --max-redirs 0 --max-time 30 "https://themyrul.my.id/health"
```

Expected:

```text
HTTP/1.1 200 OK
{"status":"ok"}
```

- [ ] **Step 2: Verify `/purchase` through production bundle**

Run:

```powershell
node run.js "C:\Users\ADMINI~1\AppData\Local\Temp\opencode\playwright-test-purchase-myr-live.js"
```

from `C:\Users\Administrator\.agents\skills\playwright-skill`.

Expected:

```json
{
  "status": 200,
  "prefix": "RM",
  "hasRM": true,
  "hasDollarPrefix": false,
  "errors": []
}
```

- [ ] **Step 3: Verify Git and Dokploy terminal state**

Run:

```powershell
git status --short --branch
git ls-remote --heads origin my-custom
dokploy deployment queue-list --json
```

Expected: clean worktree, remote matches `HEAD`, and queue is `[]`.
