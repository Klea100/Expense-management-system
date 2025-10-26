# Expense Management System

This repository contains a full-stack solution for managing teams, budgets, and expenses, with budget alerts, email notifications, and AI-powered insights.

## What’s included

- **backend/** — Node.js/Express API

  - Teams, expenses, budget monitoring, email alerts, AI category suggestion, analytics
  - MongoDB models, service layer, REST endpoints, centralized error handling
  - Email via Brevo (Sendinblue) or SMTP; AI via OpenAI (optional)
  - See `backend/README.md` for setup, environment variables, and API docs

- **frontend/** — Angular 20 app (in `frontend/team-expense/`)

  - Dashboard, teams, team detail, alerts, insights
  - PrimeNG v20, Tailwind CSS, Chart.js, standalone components
  - Email service integration (test email, service status, reset alerts)
  - See `frontend/team-expense/README.md` for setup and usage

## Quick start

### Backend

1. Copy environment file and edit values:
   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```
2. Install dependencies:
   ```powershell
   cd backend
   npm install
   ```
3. Start the API:
   ```powershell
   npm run dev
   # or for production
   npm start
   ```
4. The API runs at http://localhost:5000 by default

### Frontend

1. Install dependencies:
   ```powershell
   cd frontend/team-expense
   npm install
   ```
2. Start the dev server:
   ```powershell
   npm start
   ```
3. Open http://localhost:4200 in your browser

## Configuration

- Backend: see `backend/.env.example` for all environment variables (MongoDB, email, AI, etc.)
- Frontend: calls backend at `http://localhost:5000/api/v1` by default; override with `window.API_BASE` in `src/index.html` if needed

## Main features

- Teams: create, edit, delete, view budget status
- Expenses: add, approve/reject, filter/search, AI category suggestion
- Budget alerts: automatic email notifications at warning/critical thresholds
- Dashboard: overview, analytics, recent alerts
- Alerts: view, re-check, send test email, reset flags
- Insights: AI-powered spending analysis per team

## Email & AI integration

- Email: configure Brevo or SMTP in backend `.env` for alerts and test emails
- AI: set OpenAI API key for smart categorization and insights (optional)



