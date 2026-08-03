VM Platform
A Standalone Vulnerability Management Platform

Show Image Show Image Show Image Show Image

VM Platform is a self-contained Vulnerability Management (VM) system built to address well-documented shortcomings in commercial scanners such as Qualys, Tenable, and Rapid7 — CVSS-only prioritization, high false-positive rates, unenforced SLAs, manual triage overhead, and unverified remediation closures. It covers the full lifecycle: risk scoring, asset inventory, notification automation, ticketing, and reporting.

🔗 Live Demo: https://vm-risk-prioritization-tool.vercel.app Demo credentials: demo@example.com / Demo1234! (read-only viewer account)

Table of Contents
Problem Statement
Core Capabilities
Architecture
Tech Stack
Getting Started
Project Structure
Current Scope & Roadmap
Security
Problem Statement

Vulnerability management teams — typically operating with limited headcount relative to the volume of findings a scanner generates — face a recurring set of structural problems:

Industry Problem	Impact
CVSS-only prioritization	Thousands of "critical" findings with no real way to rank true priority
High false-positive rates	Alert fatigue; genuine findings get ignored
SLA policy exists only as a document	No enforcement, no visibility, no accountability
Manual ticket creation and follow-up	Analyst time consumed by admin work instead of analysis
No verification on closure	Tickets marked "fixed" without confirmation; vulnerabilities silently persist
Unclear ownership	Ambiguity between security, IT, and dev teams over who remediates what

VM Platform is architected specifically to close these gaps through automation and workflow enforcement, rather than relying on manual process discipline.

Core Capabilities
🎯 Composite Risk Scoring Engine

Rather than surfacing a raw CVSS score, the platform computes a transparent, weighted Composite Risk Score (0–10) from six factors — CVSS, EPSS (exploit probability, live from FIRST.org), CISA KEV status (active exploitation), asset business criticality, business impact (internet exposure / data sensitivity), and compensating controls (WAF/EDR/MFA, which reduce the score). Every finding shows a full breakdown of how its score was derived — never a black box.

📡 Live Threat Intelligence

Polls the CISA KEV feed and FIRST.org EPSS API on a schedule. When a CVE enters active-exploitation status, all matching open findings are automatically re-scored and owners are alerted immediately — no waiting for the next scan cycle.

⏱ SLA Enforcement Engine

Severity-based configurable SLA deadlines with automated notifications: immediate alert on creation, escalating reminders at 50%/75%/90% of the SLA window, and management escalation on breach — with full notification history.

✅ Verification-Gated Closure

No finding can be marked "Closed" directly — it must pass through a Rescan Pending state and a confirmed verification check. Failed verification automatically reopens the ticket and resumes the SLA/escalation cycle. This eliminates the industry-wide "fake-closed ticket" problem.

🚫 Governed False-Positive & Risk-Acceptance Workflows

False-positive suppression requires senior analyst approval and supports scoped, expiring rules — preventing the FP flag from being used to dodge SLA obligations. Risk acceptance requires documented justification and an expiry date.

📋 Asset Inventory & Ticketing

Centralized asset tracking (hostname, IP, OS, environment, exposure, criticality, data sensitivity, ownership) with an automatic, fully-audited ticket lifecycle per finding.

📊 Real-Time Dashboard & Reporting

Overall risk posture, MTTR by severity, aging analysis, SLA compliance %, false-positive rate, active-exploitation exposure, and filterable CSV export.

📤 Bulk CSV Import

Upload hundreds of assets or findings at once via CSV, with per-row validation and a downloadable template — built for realistic onboarding at scale rather than one-by-one manual entry.

🔐 Role-Based Access Control

Five roles — Admin, Security Analyst, Asset Owner/Team Lead, Executive Viewer, Auditor — govern access and approval authority throughout the platform.

Architecture
Layer	Technology
Backend API	Node.js, Express
Database	PostgreSQL via Prisma ORM
Background Jobs	node-cron (SLA checks every day, threat intel refresh every 4h)
Notifications	Resend (transactional email)
Frontend	React (Vite), Tailwind CSS, Recharts
Auth	JWT, role-scoped middleware
Security	Helmet (HTTP security headers), rate limiting on auth endpoints, strict CORS, HTML-escaped email templates, CSV formula-injection protection

The system deploys as two independent services (API + frontend) against a managed PostgreSQL instance. This deployment is verified against free-tier hosting (Render + Vercel + Neon) for pilot/demo use, and scales to paid infrastructure as asset volume grows.

Tech Stack

Backend: Node.js · Express · Prisma ORM · PostgreSQL · JWT · bcrypt · node-cron · Helmet · Resend Frontend: React 18 · Vite · Tailwind CSS · Recharts · React Router · Axios · PapaParse

Getting Started
Prerequisites
Node.js 18+
A PostgreSQL database (e.g. Neon free tier)
A Resend account for transactional email
Backend
bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, RESEND_API_KEY, etc.
npm install
npx prisma generate
npx prisma db push
npm run seed            # creates default SLA config + an initial admin user
npm start
Frontend
bash
cd frontend
cp .env.example .env    # set VITE_API_URL to your backend URL
npm install
npm run dev
Project Structure
vm-platform/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Data model: assets, findings, tickets, SLA config, etc.
│   │   └── seed.js             # Seeds default SLA tiers + initial admin user
│   └── src/
│       ├── routes/             # REST endpoints (auth, assets, findings, tickets, dashboard, reports, admin)
│       ├── services/           # Risk scoring, threat intel polling, SLA engine, email, scheduler
│       ├── templates/          # Email templates
│       └── middleware/         # Auth + role-based access control
└── frontend/
    └── src/
        ├── pages/               # Dashboard, Findings, Assets, Tickets, Reports, Admin
        ├── components/          # Layout, badges, bulk-upload widget
        ├── context/             # Auth context
        └── api/                 # API client
Current Scope & Roadmap

This release covers the full risk-scoring, SLA-automation, and workflow-governance layer described above. Findings are currently ingested via the UI, API, or CSV bulk import.

Planned next: integration of an open-source scan engine (Nuclei) for automated network/host scanning, so findings can be generated directly from live scans against user-specified assets rather than manual/CSV entry — closing the loop to a fully automated detect → score → remediate → verify pipeline.

Security

This project follows defense-in-depth practices appropriate for a security tool:

Passwords hashed with bcrypt; JWT-based, role-scoped authentication
All database queries parameterized via Prisma ORM (no raw SQL — no SQL injection surface)
HTML-escaping applied to all user-controllable content rendered in email notifications
CSV export sanitized against formula-injection attacks
Strict CORS (no wildcard origins), Helmet security headers, and rate-limiting on authentication endpoints
Secrets are never committed to source control (.env is git-ignored; see .env.example for required variables)

License
This is an independently designed and built platform, not affiliated with or derived from any commercial vulnerability management vendor.
