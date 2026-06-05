# Express ATS - Applicant Tracking System

## Prerequisites

**Node.js is required.** Download and install from: https://nodejs.org (LTS version recommended)

After installing Node.js, restart your terminal/PowerShell.

## Setup & Run

```powershell
# 1. Open PowerShell and navigate to the project
cd "C:\Users\PERSONAL\OneDrive\Desktop\ats-app"

# 2. Install all dependencies
npm run install:all

# 3. Start the app (runs both frontend + backend)
npm run dev
```

Then open your browser to: **http://localhost:5173**

## Login Credentials

All users share the default password: **express2024**

| Username | Role      |
|----------|-----------|
| jordan   | Manager   |
| shayne   | Recruiter |
| luke     | Recruiter |
| carl     | Recruiter |
| marc     | Recruiter |
| ru       | Recruiter |
| pam      | Recruiter |

## Offices
- **1511** → Round-robin: Shayne → Luke → Carl
- **STL** → Round-robin: Marc → Ru → Pam

## Features

- **Pipeline** — Kanban board with drag-and-drop across 6 stages (New, LMVM, Scheduled, Confirmed, Kept, Placed)
- **Quick Add** — Phone duplicate check → auto round-robin assignment
- **Candidate Modal** — Edit all fields, append notes, view activity log
- **Dashboard** — KPIs, charts (trend, pie, bar, funnel), recruiter scorecard
- **Alerts** — Stuck/overdue candidates, dismissable alerts
- **Arrival Log** — Track kept/placed show-ups; AI photo scanning via Claude API
- **Closed Leads** — View and reactivate closed candidates
- **Incentive Tracker** — $1 per Kept/Placed candidate, recruiter breakdown
- **Import** — CSV bulk import (manager only) with preview and duplicate detection

## AI Arrival Scanning (Optional)

Set the environment variable before starting the server:
```powershell
$env:ANTHROPIC_API_KEY = "your-key-here"
npm run dev
```

## Tech Stack
- Frontend: React 18 + Vite + Tailwind CSS + Recharts
- Backend: Node.js + Express + SQLite (better-sqlite3)
- Auth: Express sessions + bcrypt
