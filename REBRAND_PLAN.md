# Rebrand: OpenArchiver → ActiveArchiver

## Context
Fork the project fully and rename from "OpenArchiver" / "open-archiver" / "Open Archiver" to "ActiveArchiver" / "active-archiver" / "Active Archiver" throughout the entire codebase. This touches package names, imports, UI strings, Docker config, documentation, storage paths, and more.

---

## Phase 1: Package Names & Workspace Structure

Rename all npm package names and the app directory.

| File | Change |
|------|--------|
| `package.json` (root) | `"name": "open-archiver"` → `"active-archiver"` |
| `package.json` (root) | All script references: `open-archiver` → `active-archiver`, `@open-archiver/*` → `@active-archiver/*` |
| `packages/types/package.json` | `@open-archiver/types` → `@active-archiver/types` |
| `packages/backend/package.json` | `@open-archiver/backend` → `@active-archiver/backend`, dep `@open-archiver/types` → `@active-archiver/types` |
| `packages/frontend/package.json` | `@open-archiver/frontend` → `@active-archiver/frontend`, dep `@open-archiver/types` → `@active-archiver/types` |
| `apps/open-archiver/package.json` | `open-archiver-app` → `active-archiver-app`, dep `@open-archiver/backend` → `@active-archiver/backend` |
| `tsconfig.base.json` | Path aliases: `@open-archiver/*` → `@active-archiver/*` |
| `.claude/settings.local.json` | Filter references: `@open-archiver/*` → `@active-archiver/*` |

**Directory rename:**
- `apps/open-archiver/` → `apps/active-archiver/`

After these changes, run `pnpm install` to regenerate `pnpm-lock.yaml`.

---

## Phase 2: All Source Code Imports (~100+ files)

Global find-and-replace across all `.ts`, `.svelte`, `.js` files:

| Pattern | Replacement |
|---------|-------------|
| `@open-archiver/types` | `@active-archiver/types` |
| `@open-archiver/backend` | `@active-archiver/backend` |
| `@open-archiver/enterprise` | `@active-archiver/enterprise` |

These are pure import path changes — no logic changes needed.

**Key files with additional string changes:**
- `apps/active-archiver/index.ts` — Log message: `"Open Archiver (OSS)"` → `"Active Archiver (OSS)"`
- `packages/types/src/license.types.ts` — Enum `OpenArchiverFeature` → `ActiveArchiverFeature`, comment text
- `packages/types/src/storage.types.ts` — Property `openArchiverFolderName` → `archiverFolderName` (see Phase 5)
- `packages/backend/src/api/server.ts` — Import and usage of `OpenArchiverFeature` → `ActiveArchiverFeature`
- `packages/backend/src/services/ingestion-connectors/PSTConnector.ts` — MIME boundaries: `boundary-openarchiver` → `boundary-activearchiver`
- `packages/backend/src/iam-policy/test-policies/auditor-specific-mailbox.json` — `dev@openarchiver.com` → `dev@activearchiver.com`

---

## Phase 3: Frontend UI & Translations

### Page Titles (all `<svelte:head>` blocks)
Replace `- OpenArchiver` with `- ActiveArchiver` in every `<title>` tag across all page `.svelte` files:
- `routes/signin/+page.svelte`
- `routes/dashboard/+page.svelte`
- `routes/dashboard/ingestions/+page.svelte`
- `routes/dashboard/archived-emails/+page.svelte`
- `routes/dashboard/archived-emails/[id]/+page.svelte`
- `routes/dashboard/compliance/audit-log/+page.svelte`
- `routes/dashboard/search/+page.svelte`
- `routes/dashboard/settings/users/+page.svelte`
- `routes/dashboard/settings/account/+page.svelte`
- `routes/dashboard/settings/roles/+page.svelte`
- `routes/dashboard/settings/system/+page.svelte`
- `routes/dashboard/settings/api-keys/+page.svelte`
- `routes/dashboard/admin/license/+page.svelte`
- `routes/dashboard/admin/jobs/+page.svelte`
- `routes/dashboard/admin/jobs/[queueName]/+page.svelte`

### Branding Components
- `routes/signin/+page.svelte` — alt text `"OpenArchiver Logo"` → `"ActiveArchiver Logo"`, text `"Open Archiver"` → `"Active Archiver"`, meta description
- `routes/setup/+page.svelte` — alt text and branding text
- `routes/dashboard/+layout.svelte` — sidebar logo alt text
- `lib/components/custom/Footer.svelte` — footer link text `"Open Archiver"` → `"Active Archiver"`

### Translation Files (9 languages)
Replace `"Open Archiver"` with `"Active Archiver"` in:
- `en.json`, `de.json`, `es.json`, `et.json`, `fr.json`, `it.json`, `ja.json`, `nl.json`, `pt.json`

Key strings: setup description, license page meta description.

---

## Phase 4: External URLs & References

### URLs to update
| Current | New |
|---------|-----|
| `https://openarchiver.com/` | `https://activearchiver.com/` |
| `https://docs.openarchiver.com/...` | `https://docs.activearchiver.com/...` |
| `https://demo.openarchiver.com` | `https://demo.activearchiver.com` |
| `openarchiver.bsky.social` | Remove or update when new social exists |
| `https://github.com/LogicLabs-OU/OpenArchiver` | Update to your new repo URL |
| `https://api.github.com/repos/LogicLabs-OU/OpenArchiver/releases/latest` | Update to new repo (in `+layout.server.ts` — version check) |

### Files with URL references
- `README.md` — All URLs, clone command, demo credentials, star history badge
- `CONTRIBUTING.md` — Issue tracker URLs
- `docs/.vitepress/config.mts` — GitHub and website links
- `.github/workflows/deploy-docs.yml` — CNAME: `docs.openarchiver.com`
- `.github/workflows/cla.yml` — CLA document path, org name
- `packages/frontend/src/routes/+layout.server.ts` — GitHub API releases check
- `packages/frontend/src/routes/signin/+page.svelte` — Website link
- `packages/frontend/src/lib/components/custom/Footer.svelte` — Website link
- `packages/frontend/src/routes/dashboard/ingestions/+page.svelte` — Docs link
- `packages/frontend/src/routes/dashboard/archived-emails/+page.svelte` — Docs link
- `packages/frontend/src/routes/dashboard/archived-emails/[id]/+page.svelte` — Docs link
- `packages/frontend/src/routes/dashboard/admin/license/+page.server.ts` — Error message mentioning "Open Archiver"
- Various `docs/` markdown files

---

## Phase 5: Configuration & Storage

### Storage folder name
- `packages/backend/src/config/storage.ts` — `openArchiverFolderName = 'open-archiver'` → `archiverFolderName = 'active-archiver'`
- `packages/types/src/storage.types.ts` — Property name `openArchiverFolderName` → `archiverFolderName`
- All references in `IngestionService.ts`, `upload.controller.ts` — Update to use new property name

**Warning:** This changes the on-disk storage path from `open-archiver/` to `active-archiver/`. Existing data directories would need to be renamed manually. If you want to keep backward compatibility, we can leave the folder name as `open-archiver` and only rename the code property.

### Environment
- `.env.example` — Comments mentioning "Open Archiver", default path `/var/data/open-archiver` → `/var/data/active-archiver`
- `.env` (local) — `STORAGE_LOCAL_ROOT_PATH` path update (your local dev data dir)

---

## Phase 6: Docker & Deployment

- `docker-compose.yml` — Service `open-archiver` → `active-archiver`, image `logiclabshq/open-archiver` → new image name, container name, network `open-archiver-net` → `active-archiver-net`
- `docker-compose.dev.yml` — Same network rename if referenced
- `open-archiver.yml` → rename file to `active-archiver.yml`, update all internal references (service name, image, volume paths, env vars)
- `apps/active-archiver/Dockerfile` — Update comment, COPY paths (already handled by directory rename)
- `.github/workflows/docker-deployment.yml` — Dockerfile path, image tags

---

## Phase 7: Documentation

Update all `.md` files in `docs/`:
- `docs/user-guides/installation.md` — Clone URLs, storage paths, service names, "Open Archiver" references
- `docs/user-guides/upgrade-and-migration/upgrade.md` — GitHub releases URL
- `docs/user-guides/email-providers/*.md` (6 files) — "OpenArchiver" → "ActiveArchiver"
- `docs/services/storage-service.md` — Storage path references
- `README.md` — Full rebrand (title, description, URLs, clone command, demo creds)
- `CONTRIBUTING.md` — Title, issue URLs

---

## Execution Order

```
1. Rename apps/open-archiver/ directory → apps/active-archiver/
2. Phase 1: Package names & workspace config
3. pnpm install (regenerate lockfile)
4. Phase 2: Source code imports (bulk find-replace)
5. Phase 3: Frontend UI & translations
6. Phase 4: External URLs
7. Phase 5: Configuration & storage
8. Phase 6: Docker & deployment
9. Phase 7: Documentation
10. pnpm build:oss — verify no TypeScript errors
11. Prettier format check
```

## Verification

- `pnpm build:oss` compiles cleanly
- `grep -ri "open.archiver" --include="*.ts" --include="*.svelte" --include="*.json" packages/ apps/` returns zero hits (excluding node_modules and lock files)
- `grep -ri "openarchiver" --include="*.ts" --include="*.svelte" --include="*.json" packages/ apps/` returns zero hits
- Dev server starts successfully with `pnpm dev:oss`
- Frontend loads without errors, shows "Active Archiver" in title/footer/signin
