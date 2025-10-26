# Team Expense Management API

A Node.js/Express backend for managing teams, budgets, and expenses with budget alerts via email and an AI-assisted feature for categorization and insights.

## What’s inside

- Teams with budgets and members
- Expenses linked to teams with categories and approval workflow
- Budget monitoring with 80% (warning) and 100% (critical) email alerts
- Email notifications via Brevo (Sendinblue), with SMTP/JSON fallback
- AI features: smart category suggestion and spending insights (fallback available)
- Analytics: category breakdown, daily trends, team comparison
- CORS enabled and centralized error handling

## Prerequisites

- Node.js 18+
- MongoDB 6+ running locally or remotely (provide a connection string)

## Setup and run

1. Copy environment file and edit values:

```powershell
Copy-Item .env.example .env
```

2. Install dependencies:

```powershell
npm install
```

3. Start the API (dev):

```powershell
npm run dev
```

Or run in prod mode:

```powershell
npm start
```

Server defaults to http://localhost:5000 (configure with `PORT`).

- Health check: `GET /api/health`
- Service status: `GET /api/v1/dashboard/service-status`

## Environment variables

See `.env.example` for all variables. Minimal to run locally:

- `MONGODB_URI` (e.g., mongodb://localhost:27017/team_expense_management)
- `PORT` (optional; default 5000)
- `CLIENT_URL` (optional; default \*)

Optional integrations:

- Email via Brevo: `BREVO_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME`
- Email via SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- AI via OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL` (default: gpt-4o-mini)
- Budget alerts: `BUDGET_WARNING_THRESHOLD` (default 80), `BUDGET_CRITICAL_THRESHOLD` (default 100)
- Rate limiting (optional): `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`

If email/AI keys are not set, the system still runs: emails are logged via JSON transport and AI falls back to keyword-based heuristics.

## Database and seed

No seed script is required. You can create initial data via the API.

Example (PowerShell) to create a Team:

```powershell
$body = @{ name = "Platform"; description = "Core team"; budget = 50000; currency = "USD"; members = @(@{ name = "Ava"; email = "ava@example.com"; role = "manager" }); createdBy = "admin" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:5000/api/v1/teams -Method Post -ContentType 'application/json' -Body $body
```

Example to create an Expense for that team (replace TEAM_ID):

```powershell
$body = @{ team = "TEAM_ID"; amount = 120.5; description = "Team lunch"; category = "food"; submittedBy = @{ name = "Ava"; email = "ava@example.com" }; currency = "USD" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:5000/api/v1/expenses -Method Post -ContentType 'application/json' -Body $body
```

## API documentation (selected)

All responses follow `{ success, message, data }`. Pagination responses include a `pagination` object.

Teams

- GET `/api/v1/teams` — list teams (supports `page`, `limit`, `status`, `search`)
- GET `/api/v1/teams/:id` — team details + recent expenses
- POST `/api/v1/teams` — create team
  - Body: `{ name, description?, budget, currency?, members?[], createdBy }`
- PUT `/api/v1/teams/:id` — update team fields
- DELETE `/api/v1/teams/:id` — soft delete
- GET `/api/v1/teams/:id/expenses` — team expenses with filters
- GET `/api/v1/teams/:id/analytics` — analytics + projections

Expenses

- GET `/api/v1/expenses` — list expenses with filters
- GET `/api/v1/expenses/:id` — expense details
- POST `/api/v1/expenses` — create expense (supports `multipart/form-data` w/ `receipt`)
  - Body: `{ team, amount, description, category, date?, submittedBy:{name,email}, currency?, tags?[] }`
- PUT `/api/v1/expenses/:id` — update expense (only pending)
- DELETE `/api/v1/expenses/:id` — soft delete
- PUT `/api/v1/expenses/:id/approve` — approve
  - Body: `{ approver:{name,email} }`
- PUT `/api/v1/expenses/:id/reject` — reject
  - Body: `{ rejector:{name,email}, reason }`
- POST `/api/v1/expenses/:id/ai-categorize` — AI category suggestion for a single expense

Dashboard

- GET `/api/v1/dashboard` — overview (summary, status, recent, alerts)
- GET `/api/v1/dashboard/budget-summary` — budgets across teams
- GET `/api/v1/dashboard/alerts` — active alerts
- POST `/api/v1/dashboard/budget-alerts/check` — force alert scan
- GET `/api/v1/dashboard/analytics` — comprehensive analytics
- GET `/api/v1/dashboard/ai-insights/:teamId` — AI insights for team
- GET `/api/v1/dashboard/suspicious-expenses/:teamId` — duplicate/outlier checks
- POST `/api/v1/dashboard/test-email?to=you@example.com` — send a test email

### Example response shape

```json
{
  "success": true,
  "message": "Expense created successfully",
  "data": {
    "_id": "...",
    "team": "...",
    "amount": 120.5,
    "description": "Team lunch",
    "category": "food",
    "status": "pending",
    "aiInsights": { "suggestedCategory": "food", "confidence": 0.76 },
    "createdAt": "..."
  }
}
```

## Email service setup

Primary (recommended): Brevo

- Get an API key from Brevo
- Set `BREVO_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME` in `.env`

Fallback options

- SMTP (set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`)
- JSON transport (default) logs emails locally when no provider is set

Manual alert check:

```powershell
npm run check-alerts
```

## AI feature setup

Chosen feature: Smart categorization (plus spending insights)

- Why: immediate value at creation time; improves data quality with minimal UI change
- Configure `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`)
- If not configured, the system uses keyword-based categorization and a basic insights fallback

Endpoints:

- POST `/api/v1/expenses/:id/ai-categorize`
- GET `/api/v1/dashboard/ai-insights/:teamId`

## Data model

- Team: name, description, budget, currency, members[], totalSpent, alertsSent, createdBy, isActive
- Expense: team, amount, description, category, date, status, submittedBy, receipt, tags[], aiInsights, isActive

Both schemas have helpful indexes for common queries and virtuals for budget metrics.

## Architecture decisions

- Service layer encapsulates business logic; routes are thin
- Normalized schemas (Mongoose) with indexes for common queries
- Validation via express-validator in routes; Mongoose enforces schema-level rules
- Centralized error handling returns consistent JSON errors
- External services wrapped with graceful failure handling; never crash the request path

## Error handling

- 400 on validation errors with details
- 404 on unknown routes/resources
- 500 on unhandled exceptions with a generic message (no sensitive data)

## Security & performance

- CORS is enabled (configurable via `CLIENT_URL`)
- Recommended (dependencies included): helmet, compression, rate limiting, structured logs; enable in `server.js` as needed

## Testing and tools

- Health: `GET /api/health`
- Service status: `GET /api/v1/dashboard/service-status`
- Email test: `POST /api/v1/dashboard/test-email?to=...`
- Budget alerts: `npm run check-alerts`

## Time spent and improvements

- Time spent: ~2–3 hours focusing on service design, integrations, and docs
- With more time I would:
  - Add Jest tests for services (budget thresholds, AI fallbacks, email paths)
  - Add CSV/PDF export and small charts support endpoints
  - Introduce Zod schemas and a validation middleware
  - Add caching for analytics and E2E tests (e.g., with Supertest)

## Assumptions & trade-offs

- No auth is included in this exercise; endpoints are open for simplicity
- Totals are recomputed via hooks; avoids denorm drift while staying simple
- AI and Email degrade gracefully to keep core flows working without secrets
