# Liko Security Training — Backend

Modular-monolith Node.js/Express backend for the Liko Security Training public
website and admin panel. See `/docs` references in the project's TAD, SRS, and
Scope documents for the full specification this implementation traces back to.

## Stack

- Node.js + Express (CommonJS)
- MongoDB + Mongoose
- Cloudinary (file storage) · Mailjet (email) · EJS + Puppeteer (PDF generation)
- JWT auth (access + refresh), bcrypt, AES-256-GCM + HMAC-SHA-256 blind indexing for PII

## Getting started

```bash
npm install
cp .env.example .env
# fill in .env — see the comments in that file for what's required in dev vs production
npm run dev
```

The server will refuse to boot if required environment variables are missing
(see `src/config/env.js`) — this is intentional fail-fast behavior, not a bug.

### Seeding

```bash
SEED_SUPER_ADMIN_EMAIL=admin@example.com SEED_SUPER_ADMIN_PASSWORD=ChangeMe123! node scripts/seed.js
```

Seeds a full end-to-end demo dataset, idempotent per collection (safe to
re-run — anything already present is skipped, not duplicated):

- The four system roles (Super Admin, Registrar, Finance, Content Editor) — permissions re-synced to `src/shared/constants/enums.js` on every run.
- One Super Admin account, only if `SEED_SUPER_ADMIN_EMAIL`/`SEED_SUPER_ADMIN_PASSWORD` are set.
- **Two demo staff accounts, always created regardless of the env vars above:**
  - Registrar — `registrar@liko.test` / `RegistrarDemo123!`
  - Finance — `finance@liko.test` / `FinanceDemo123!`
- Settings (real Standard Bank / Capitec details from Liko's flyer, PSIRA fee, contact info)
- All four courses (Grade E/D/C/B) with real fees and durations
- Four intakes spanning past, current, and future dates
- Five applications, one per status in the state machine (`new` → `under_review` → `payment_verified` → `enrolled`, plus one `rejected`)
- Matching pro-forma/official invoices for those applications
- Six gallery items across all three categories
- Three testimonials, two FAQs sets, two announcements, two inquiries (one open, one replied)
- A handful of illustrative audit log entries

**Important:** ID documents, gallery media, and invoice PDFs are seeded as clearly-marked placeholder references (`seed/placeholder-...`), not real files — this script never calls Cloudinary, Mailjet, or Puppeteer, since it can't assume those credentials/network access are available. Clicking "View Document" or downloading an invoice PDF for seeded records will not work; this is expected for demo data, not a bug. Demo staff credentials are for local development only — never reuse them in a staging or production environment.

## Testing

```bash
npm run test:unit          # pure-logic tests — encryption, blind index, ID validation,
                            # reference code generation, status transitions. No DB needed.
npm run test:integration   # full HTTP flows via Supertest against an in-memory MongoDB
                            # (mongodb-memory-server). Cloudinary/Puppeteer/Mailjet are
                            # mocked — these tests run with zero external network dependency.
npm test                   # both
```

**Important — this codebase was built in a sandboxed environment without
outbound network access, so `npm install` and the test suite itself could not
actually be executed during development.** Every file was syntax-checked
(`node --check`), every relative `require()` path was verified to resolve,
and every destructured import was cross-checked against the target module's
exports — but you should run `npm install && npm test` yourself before
trusting this in any environment that matters, and treat the first real test
run as part of getting this into a deployable state, not a formality.

## Environment

See `.env.example` for the full list. A few worth calling out:

- `KMS_PROVIDER=secrets-manager` is the **interim** envelope-encryption
  approach agreed for this build (see `src/config/kms.js`). It resolves key
  material from `DEV_MASTER_KEY_HEX`/`DEV_BLIND_INDEX_KEY_HEX` env vars.
  **This is explicitly blocked from running in production** (`env.js` will
  refuse to boot) until a real KMS/secrets manager is wired in — swapping it
  out only requires editing `src/config/kms.js`, no other file needs to
  change.
- `ENFORCE_MFA_FOR_SUPER_ADMIN` is toggleable (agreed: OFF by default). MFA
  itself works per-account (`mfaEnabled` on the User model) regardless of
  this flag; the flag only controls whether login is *blocked* for a Super
  Admin who hasn't enabled it yet.

## Deployment checklist

Before pointing this at production traffic:

- [ ] Run `npm install && npm test` for real — this was never executed during development (see Testing section)
- [ ] Replace the interim `secrets-manager` KMS provider with a real KMS (AWS/GCP/Azure) in `src/config/kms.js`
- [ ] MongoDB Atlas (or equivalent): least-privilege DB user, IP allowlist (never `0.0.0.0/0`), TLS-enforced connection string, console MFA enabled
- [ ] Real secrets in a secrets manager — `.env` should hold no production secrets
- [ ] Cloudinary + Mailjet accounts provisioned, SPF/DKIM/DMARC configured on the sending domain
- [ ] `npm audit --audit-level=high` clean (also gated in CI — see `.github/workflows/ci.yml`)
- [ ] Automated MongoDB backups configured and **restore-tested**, not just scheduled
- [ ] Seed system roles + initial Super Admin (`scripts/seed.js`)
- [ ] Confirm `ENFORCE_MFA_FOR_SUPER_ADMIN` decision with the client before go-live
- [ ] A short documented incident response plan, including the POPIA breach-notification path (client-side responsibility to designate an Information Officer — flagged, not a backend concern)

## Project structure

See the Backend TAD for the authoritative structure diagram. Summary:

```
src/
  config/       env, db, cloudinary, mailjet, kms
  modules/      one folder per feature — model/service/controller/routes/validation
  shared/       middleware, security primitives, utils, constants
  templates/    EJS templates for PDFs and (future) emails
  routes/       top-level route aggregator
app.js          pure Express app (no DB connect, no listen)
server.js       entry point — DB connect, listen, graceful shutdown
scripts/seed.js system roles + initial Super Admin
```
