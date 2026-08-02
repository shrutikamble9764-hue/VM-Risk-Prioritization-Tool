# VM Platform — Standalone Vulnerability Management Tool

Yeh ek complete, custom-built Vulnerability Management platform hai — Qualys/Nessus/Tenable jaisa, lekin aapke exact problems (false positives, weak prioritization, SLA sirf PDF me rehna, manual follow-up, fake-closed tickets) solve karne ke liye banaya gaya hai.

---

## 📋 Poora Feature List — Kya-Kya Karta Hai Yeh Tool

### 1. Composite Risk Scoring Engine (Core Differentiator)
ज्यादातर tools sirf CVSS dikhate hain (0-10 ka ek number, jisme business context nahi hota). Yeh tool ek **transparent composite risk score** banata hai jisme 6 cheezein combine hoti hain:
- **CVSS Base Score** (technical severity) — max 4.0 points
- **EPSS Score** (real-world exploitation probability, FIRST.org ke live API se) — max 2.0 points
- **Threat Intel** — CVE CISA KEV list me hai kya (actively exploited in wild), public exploit/PoC available hai kya — max 2.0 points
- **Asset Criticality** — us system ka business tier (Critical/High/Medium/Low) — max 1.0 point
- **Business Impact** — internet-facing hai kya, sensitive/compliance data handle karta hai kya — max 1.0 point
- **Compensating Controls** — agar WAF/EDR/IPS/MFA/Network Segmentation already laga hai, toh score kam ho jaata hai (real-world risk kam hai)

Har finding ki detail page pe **poora breakdown dikhta hai** — "yeh 9.2 kyun hai" ka jawab, ek-ek factor ke contribution ke saath. Black-box nahi.

### 2. Live Threat Intelligence
- **Real CISA KEV feed** (Known Exploited Vulnerabilities) — har 4 ghante me poll hota hai
- **Real EPSS API** — exploitation probability updates
- Jaise hi koi CVE naya "actively exploited" ban ta hai, uske **saare open findings automatically re-score** ho jaate hain aur asset owner ko **urgent alert email** turant jaata hai — agle scheduled scan ka wait nahi karna padta

### 3. Automated SLA Engine (fixes "SLA sirf PDF me rehta hai" problem)
- Severity-wise configurable SLA (default: Critical=3 din, High=14 din, Medium=30 din, Low=90 din) — Admin panel se change kar sakte ho
- Naya finding create hote hi **turant email** jaata hai owner ko — CVE details, business impact (plain language me), remediation steps, SLA deadline
- **3 automated follow-up reminders**: 50%, 75%, 90% SLA window pe — urgency badhti tone ke saath
- SLA breach hone par **CISO/manager ko escalation email** (poori history ke saath — kab alert gaya, kitne reminders gaye, kuch hua ya nahi)
- Har email **real jaata hai** (Resend service ke through)

### 4. Rescan-to-Verify Workflow (fixes "fake-closed tickets" problem)
- Koi bhi vulnerability seedha "Closed" nahi ho sakti — sirf "Mark Fixed" karne se
- Pehle status "Rescan Pending" me jaata hai
- Verification rescan confirm karta hai fix hua ya nahi:
  - Fix confirmed → auto-close + confirmation email
  - Abhi bhi vulnerable → ticket automatically reopen, escalation flow resume

### 5. False Positive Workflow (abuse-proof)
- Koi bhi FP flag kar sakta hai reason ke saath
- Lekin **senior analyst/admin approval ke bina permanently suppress nahi hoga** — isse log SLA breach dodge karne ke liye FP flag misuse nahi kar sakte
- Scope set kar sakte ho: sirf is asset pe, is asset+CVE pe, ya org-wide pattern

### 6. Risk Acceptance Workflow
- Owner justification + expiry date ke saath risk-accept request kar sakta hai
- Security team approve/deny karti hai
- Expiry ke baad wapas review me aata hai — permanently ignore nahi ho sakta

### 7. Asset Inventory
- Central database: hostname, IP, OS, environment (Prod/Staging/Dev), internet-facing flag, criticality tier, data-sensitivity, compensating controls, owner, team
- "Rogue asset" flagging (jo discover hua par pre-registered nahi tha)
- Asset coverage tracking — kitne assets scan hue, kitne stale hain (30+ din se scan nahi hue)

### 8. Ticketing System
- Har finding ke saath automatically ticket create hota hai
- Status lifecycle: New → Triaged → In Progress → Fix Applied → Rescan Pending → Verified/Closed (ya False Positive / Risk Accepted)
- Bulk actions: reassign owner, bulk mark-fixed (mass patch ke baad)
- Har status change ka audit trail history me store hota hai

### 9. Real-Time Dashboard
- Overall Risk Posture score
- Severity-wise distribution (pie chart)
- MTTR (Mean Time to Remediate) by severity (bar chart)
- Aging report — 30/60/90+ din se open findings
- SLA compliance %, breach count, upcoming breaches (agle 3 din me)
- False Positive rate
- Active exploitation (KEV) overlay — kitne open findings actively exploited hain
- Top 10 vulnerable assets (risk score ke hisaab se ranked)

### 10. Reports
- Filterable CSV export (severity, status, asset, time-range ke hisaab se)
- Executive summary API (JSON, high-level numbers)

### 11. Roles & Access Control
- **Admin** — sab kuch, users banana, SLA config
- **Security Analyst** — findings manage karna, FP/risk-accept approve karna
- **Asset Owner / Team Lead** — apne assets ki findings dekhna, fix mark karna
- **Executive Viewer** — read-only, dashboard/reports
- **Auditor** — read-only, compliance ke liye

---

## ⚠️ Abhi Kya Manual Hai (Phase 2 me aayega)

Findings (vulnerabilities) abhi **manual/API se add hoti hain** — koi bhi analyst API ke through ya (aage banayenge to) UI se finding create kar sakta hai. **Real automatic network/cloud scanning** (jaisa Qualys/Nessus khud IP range scan karke vulnerabilities dhundta hai) abhi is version me nahi hai — woh **Phase 2** hai, jisme open-source scanner (Nuclei) integrate karenge jo diye gaye IP/hosts par khud scan karke automatically yahan findings bhej dega.

---

## PART 1 — GitHub par code daalna (bilkul step-by-step, zero coding knowledge)

### Step 1: GitHub account banao
1. https://github.com kholo, "Sign up" pe click karo, account bana lo (agar pehle se hai to skip karo)

### Step 2: Naya repository banao
1. Login ke baad, top-right corner me "+" icon pe click karo → "New repository"
2. Repository name: `vm-platform` (ya jo naam chaho)
3. "Public" ya "Private" select karo (Private safe hai kyunki isme aapke org ka data structure hoga)
4. **"Add a README file" ko UNCHECK rakho** (hum apna README already la rahe hain)
5. "Create repository" pe click karo

### Step 3: Apne computer par Git install karo
1. https://git-scm.com/downloads se Git download karo apne OS ke hisaab se (Windows/Mac/Linux)
2. Install kar lo (sab default options rakh sakte ho)

### Step 4: Yeh project files apne computer par download karo
Main aapko is poore project ka ek `.zip` file de raha hoon (neeche dekho "vm-platform.zip"). Usko:
1. Apne computer par kisi folder me extract/unzip kar lo (jaise `Documents/vm-platform`)

### Step 5: Code ko GitHub par push karo
Apne computer par ek Terminal (Mac/Linux) ya Command Prompt/PowerShell (Windows) kholo, aur yeh commands ek-ek karke chalao (jahan `vm-platform` folder hai wahan pehle `cd` karke jao):

```bash
cd path/to/vm-platform
git init
git add .
git commit -m "Initial commit - VM Platform"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/vm-platform.git
git push -u origin main
```

`YOUR-USERNAME` ki jagah apna GitHub username daalo. Pehli baar push karte waqt GitHub aapse login maangega (browser khulega, allow kar do).

Bas — aapka poora code ab GitHub par hai. 🎉

---

## PART 2 — Live deploy karna (taaki website ban jaye)

Hum 3 free services use karenge:
1. **Neon** (free PostgreSQL database)
2. **Render** (backend API hosting)
3. **Vercel** (frontend website hosting)

### Step 1: Free Database banao (Neon)
1. https://neon.tech pe jao, GitHub se sign up karo
2. "Create a project" → koi bhi naam do → region select karo (Singapore/Mumbai agar available ho)
3. Project banne ke baad, "Connection String" copy karo (kuch aisa dikhega: `postgresql://user:pass@ep-xxx.neon.tech/dbname`)
4. Isko safe jagah save kar lo — yeh `DATABASE_URL` hai

### Step 2: Email service banao (Resend)
1. https://resend.com pe jao, sign up karo (free tier: 3000 emails/month)
2. Dashboard me "API Keys" → "Create API Key" → copy kar lo (`re_...` se shuru hoga)
3. Abhi ke liye "from" email `onboarding@resend.dev` use kar sakte ho (test ke liye kaam karega). Baad me apna domain verify karke apna khud ka from-email use kar sakte ho.

### Step 3: Backend deploy karo (Render)
1. https://render.com pe jao, GitHub se sign up karo
2. "New +" → "Web Service"
3. Apna `vm-platform` GitHub repo select karo (Render ko GitHub access dena padega — allow kar do)
4. Settings me:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npx prisma generate && npx prisma migrate deploy`
   - **Start Command**: `npm start`
5. "Environment Variables" section me yeh sab add karo (Step 1 aur 2 se jo mila):
   - `DATABASE_URL` = (Neon wali connection string)
   - `JWT_SECRET` = (koi bhi lamba random string, jaise `myS3cretKey12345!@#`)
   - `RESEND_API_KEY` = (Resend wali API key)
   - `ALERT_FROM_EMAIL` = `onboarding@resend.dev`
   - `CISO_ESCALATION_EMAIL` = aapka apna email
   - `FRONTEND_URL` = abhi `*` daal do (Step 4 ke baad update karenge)
6. "Create Web Service" pe click karo. Render ab build karega — 3-5 minute lagenge.
7. Deploy hone ke baad Render ek URL dega jaisa: `https://vm-platform-backend.onrender.com` — isko save kar lo

### Step 4: Database seed karo (pehla admin user banane ke liye)
1. Render dashboard me apni service kholo → "Shell" tab (ya "Console")
2. Yeh command chalao:
   ```bash
   npm run seed
   ```
3. Yeh output me aapko admin email/password dega (default: `admin@example.com` / `ChangeMe123!`) — isse login karoge

### Step 5: Frontend deploy karo (Vercel)
1. https://vercel.com pe jao, GitHub se sign up karo
2. "Add New" → "Project" → apna `vm-platform` repo import karo
3. Settings me:
   - **Root Directory**: `frontend`
   - Framework: Vite (auto-detect ho jayega)
4. "Environment Variables" me add karo:
   - `VITE_API_URL` = Step 3 wala Render URL (jaise `https://vm-platform-backend.onrender.com`)
5. "Deploy" pe click karo. 2 minute me aapki live website ready: `https://vm-platform-xxxx.vercel.app`

### Step 6: Backend ko update karo taaki sirf aapki website use kar sake
1. Render dashboard me wapas jao → Environment Variables
2. `FRONTEND_URL` ko update karo Vercel wale URL se (jaise `https://vm-platform-xxxx.vercel.app`)
3. Save karo — Render automatically redeploy karega

---

## Ab kaise use karo

1. Apna Vercel URL kholo browser me
2. Login karo Step 4 wale admin email/password se
3. Admin panel se naye users banao (analysts, asset owners)
4. Assets register karo (hostname, criticality, owner)
5. Findings/vulnerabilities add karo (abhi manual entry — Phase 2 me hum real scanner (Nuclei) jodenge jo automatically findings create karega)
6. Baaki sab automatic hai — risk score, SLA, emails, dashboard

---

## Important Notes

- **Yeh abhi manual vulnerability entry karta hai.** Real network/cloud scanning (jaisa Qualys/Tenable karta hai) Phase 2 me aayega — usme hum ek open-source scanner (Nuclei) jodenge jo aapke diye hue IP/hosts par real scan karke automatically yahan findings bhej dega.
- Emails **real jaayenge** (Resend ke through) jaise hi SLA reminders due hoti hain ya nayi finding create hoti hai.
- Free tiers ki limits hain (Render free tier thodi der inactive rehne par so jaata hai, Neon free tier ki storage limit hai) — jab real 4000-5000 assets ka scale aayega, paid tier lena padega, lekin abhi test/pilot ke liye free tiers kaafi hain.

Agla step chaho to bolo — main Phase 2 (real Nuclei scanner integration) bana doon.
