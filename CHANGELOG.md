# Changelog

All notable changes to LAIGO on the `claudesonnet4.6` / security-hardening workstream.

Format: short title and one-line description. Grouped by area.

---

## [Unreleased] — 2026-05

### AI & Bedrock

| Change | Description |
|--------|-------------|
| **Default model → Claude Sonnet 4.6** | Admin UI and SSM defaults now use the `us.anthropic.claude-sonnet-4-6` inference profile instead of Claude 3 Sonnet / Llama 3. |
| **Higher token limits** | Default max output raised (e.g. 4096 default, 8192 cap) for the new model. |
| **Inference profile IAM** | Lambda roles may invoke `arn:aws:bedrock:*::inference-profile/*` in addition to foundation models. |
| **LangChain dependency bump** | `text_generation` and `playground_generation` pinned to LangChain 1.3+ and related packages (urllib3, aiohttp, cryptography, etc.). |

### Security

| Change | Description |
|--------|-------------|
| **Migration Lambda TLS** | Removed `NODE_TLS_REJECT_UNAUTHORIZED=0`; RDS CA bundle bundled; DB connections use `verify-full` / `rejectUnauthorized: true`. |
| **Text gen DB credentials** | Text generation Lambda uses read-write app user secret, not admin. |
| **Authorizer policy isolation** | New `buildAuthResponse()` returns a fresh IAM policy per request (fixes warm-container `Statement` accumulation). |
| **API Gateway body logging off** | `dataTraceEnabled: false` so request/response bodies are not logged to CloudWatch. |
| **Production S3 CORS** | Localhost removed from production CORS; dev stacks still allow `*`. |
| **WebSocket throttling** | API stage limits: 10 req/s, burst 20 per connection. |
| **Atomic rate limiting** | Daily message count uses single `UPDATE … RETURNING` (no race on concurrent requests). |
| **Fail-closed rate limits** | DB/usage errors return 503 (HTTP) or WebSocket error instead of allowing unlimited Bedrock calls. |
| **Guardrails on all input** | Bedrock guardrail runs on every user-influenced string, including the first-turn case context query. |
| **Playground RBAC** | WebSocket passes `callerRoles`; playground Lambda rejects non-admin/instructor invocations. |
| **Handler DB SSL** | Node `initializeConnection` uses `ssl: "require"` instead of disabled cert verification. |
| **Parameterized DB user passwords** | `db_setup` creates/rotates `app_rw` / `app_tc` with `$1` password parameters (no string interpolation). |
| **CORS misconfig warning** | Lambdas log a warning when `ALLOWED_ORIGIN` is unset (wildcard fallback). |

### Database

| Change | Description |
|--------|-------------|
| **PostgreSQL 17.9** | RDS engine upgraded to `VER_17_9` in CDK. |
| **Migration 006 — `case_reviewers` CASCADE** | Deleting a case automatically removes reviewer rows. |
| **Migration 007 — case indexes** | Indexes on `cases(student_id)`, `(student_id, last_updated DESC)`, and `status` for faster dashboards. |
| **Message counter alignment** | Node `message_counter` routes use UTC calendar day, matching Python enforcement. |

### Lambda & application code

| Change | Description |
|--------|-------------|
| **DB connection health check** | Python Lambdas and Node handlers run `SELECT 1` and reconnect if the pooled connection is stale. |
| **LLM empty-response cap** | Text/playground chat retries up to 3 times, then errors (no infinite loop). |
| **`get_case_details` fix** | Error path returns six values so unpacking never crashes the handler. |
| **Prompt typo** | “detials” → “details” in case context prompts. |
| **Bare `except` cleanup** | Several Lambdas use `except Exception` instead of bare `except`. |
| **Python DB connect style** | `psycopg.connect()` uses keyword args + `sslmode=require` consistently. |

### Infrastructure (CDK)

| Change | Description |
|--------|-------------|
| **RDS CA layer** | `global-bundle.pem` shipped for migration Lambda TLS verification. |
| **Cognito comment** | Comment corrected to match `RETAIN` removal policy. |
| **Bedrock SSM JSON** | Model options parameter uses `Fn.toJsonString` for valid CloudFormation JSON. |

### Testing

| Change | Description |
|--------|-------------|
| **Security hardening CDK tests** | Assert TLS env, user secret, `dataTraceEnabled`, CORS, WebSocket throttle. |
| **Authorizer isolation tests** | Unit + property tests for `buildAuthResponse` (no shared policy state). |
| **Migration tests** | Tests for migrations 006 (CASCADE) and 007 (indexes). |
| **Bedrock stack test** | Validates inference profile ARNs in API stack. |

### DevOps & dependencies

| Change | Description |
|--------|-------------|
| **Dependabot** | Weekly updates for npm (root, frontend, CDK, layers), pip (Lambdas), Docker, and GitHub Actions. |
| **CodeQL** | Scheduled and PR analysis for JavaScript/TypeScript and Python (`security-extended`). |
| **`.gitignore`** | Ignores `__pycache__`, build artifacts; code review docs tracked. |
| **Frontend npm** | Lockfile/package updates (security-related bumps). |

### Documentation

| Change | Description |
|--------|-------------|
| **Code review docs** | Six area reviews + `REMEDIATION-STATUS.md` with fixed/deferred status per finding. |
| **Deployment guide** | Minor updates aligned with new Bedrock/DB steps. |

---

## Deployment notes

After deploying this branch:

1. Run the **db_setup** migration Lambda (or your usual migrate flow) so **006** and **007** apply on existing databases.
2. Confirm **Claude Sonnet 4.6** inference profile is enabled in Bedrock for your account/region.
3. Enable **Dependabot** / **Code scanning** in GitHub repo settings if not already on.

---

## Not in this release (planned / deferred)

| Item | Description |
|------|-------------|
| DynamoDB chat cleanup on case delete | Conversation history still orphaned when a case is deleted. |
| DynamoDB PITR | Point-in-time recovery not enabled on chat tables. |
| Dual NAT gateways | Single NAT remains (AZ failover trade-off). |
| Split `api-stack.ts` | Stack still monolithic. |
| `audioToText` event-driven flow | Still polls Transcribe with `sleep`. |
| Frontend WebSocket unify | Separate connections for chat vs notifications. |

---

*For issue-level traceability, see [`docs/code-reviews/REMEDIATION-STATUS.md`](docs/code-reviews/REMEDIATION-STATUS.md) and [`.kiro/specs/security-hardening/tasks.md`](.kiro/specs/security-hardening/tasks.md).*
