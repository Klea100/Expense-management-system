# Team Expense Frontend (Angular 20)

Modern Angular standalone app for managing teams and expenses with budget monitoring, email alerts, and AI insights. Built with PrimeNG and Tailwind CSS.

## Features

- Dashboard with budget summary, top spending teams, and recent alerts
- Teams page with server-side filters, pagination, create/edit/delete
- Team detail with stats, expenses table, filters, and actions (approve/reject)
- Alerts page: view budget alerts, trigger re-checks, send test email, view service status
- Insights page: AI-generated spending insights per team
- Polished UI using PrimeNG v20 + Tailwind CSS

## Tech stack

- Angular 20 (standalone components, signals)
- PrimeNG 20, PrimeIcons, Chart.js 4
- Tailwind CSS 3 (PostCSS/Autoprefixer)
- HttpClient with small service layer per domain

## Prerequisites

- Node.js 18+ and npm 9+
- Backend running at http://localhost:5000 by default (see Configuration)

## Quick start

1. Install dependencies
   - PowerShell:
     ```powershell
     npm install
     ```
2. Start the dev server (frontend)
   - PowerShell:
     ```powershell
     npm start
     ```
   - Open http://localhost:4200
3. Start the backend separately (see backend/README.md)

## Scripts

- `npm start` – run dev server with hot reload
- `npm run build` – production build to `dist/`
- `npm run serve:ssr:team-expense` – run built SSR server (requires `npm run build` first)
- `npm test` – run unit tests

## Configuration

The frontend calls the backend REST API at `API_BASE`.

- Default: `http://localhost:5000/api/v1`
- Override at runtime by setting a global before the app boots (e.g., in `src/index.html`):

  ```html
  <script>
    window.API_BASE = 'http://localhost:5000/api/v1';
  </script>
  ```

No Angular rebuild is needed when changing this value; it’s read at runtime.

## Project structure (key files)

```
src/
	app/
		app.html                  # Shell layout with sidebar navigation
		app.routes.ts             # Lazy routes: dashboard, teams, detail, alerts, insights
		pages/
			dashboard/
				dashboard.page.ts/html
			teams/
				teams.page.ts/html    # List, filters, pagination, create/edit/delete
			team-detail/
				team-detail.page.ts/html  # Stats + expenses table with filters
			alerts/
				alerts.page.ts/html   # Alerts list + test email + service status + reset alerts
			insights/
				insights.page.ts/html
		components/
			create-team-dialog/
			edit-team-dialog/
			create-expense-dialog/
			change-expense-status-dialog/
		services/
			http-state.service.ts   # Central loading state tracker
			teams.service.ts        # Teams CRUD + team expenses
			expenses.service.ts     # Expenses CRUD + actions
		shared/
			api.service.ts          # Dashboard/analytics/alerts/email endpoints
			types.ts                # Shared interfaces (Team, Expense, Pagination, etc.)
	styles.scss                 # Tailwind + small global fixes
```

## Styling

Tailwind is configured via PostCSS. Global utilities are in `src/styles.scss`:

```scss
@tailwind base;
@tailwind components;
@tailwind utilities;
```

PrimeNG Aura light theme is used with utility-first classes; minor global tweaks avoid table overlay clipping.

## Working with data

- Teams: list, search, filter by budget status, create/edit/delete
- Team expenses: search/filter (status, category, date) and approve/reject
- Alerts: budget thresholds are checked on the backend; you can re-check and send a test email from the Alerts page

## Email service (frontend integration)

The Alerts page exposes actions that exercise the backend email integration:

- Send a test email to a recipient using `/dashboard/test-email?to=...`
- Check service status (AI/email configured, timestamp)
- Reset budget alert flags and re-check across teams

Ensure backend environment variables for email (e.g., Brevo API key or SMTP) are set. See backend/README.md.

## SSR (optional)

Build and run the server bundle:

1. Build the app:
   ```powershell
   npm run build
   ```
2. Serve the SSR build:
   ```powershell
   npm run serve:ssr:team-expense
   ```

## Troubleshooting

- CORS error: ensure backend CORS allows `http://localhost:4200` (already enabled in this repo).
- Blank page after deploy: verify `base href="/"` and correct `API_BASE`.
- Emails not received: check backend logs; if no provider is configured, a JSON transport fallback logs emails instead.

## License

MIT
