# web-host-bot

Automated **demo-generation** worker for the outbound pipeline. It does **not**
send email — sending is gated behind admin approval in the dashboard.

### The flow

```
┌─ bot generate  (cron: 07:00 Asia/Colombo, before 9am SL) ───────────────┐
│  read Google Sheet → for each eligible business:                         │
│    enrich (fetch their site) → Claude writes content (schema-locked)     │
│    → create web_host tenant DISABLED (hidden) → draft the email          │
│    → POST /api/outreach (review-queue item) → write "Draft" to the sheet │
│  then notify the admin: "N demos ready for review"                       │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼  (admin opens the dashboard → Review queue)
   preview the demo · edit the site content · edit the email · Approve
        │
        ▼  the SERVER (not the bot) enables the demo + sends the email
┌─ bot sync  (cron: every ~15 min) ───────────────────────────────────────┐
│  pull approved+sent items from the server → write "Sent" + date back to  │
│  the Google Sheet and flip "Pitching Email Send" → TRUE                  │
└──────────────────────────────────────────────────────────────────────────┘
```

Credentials are cleanly split: **Claude + Google live in the bot**, **Resend lives
in the server** (so the dashboard Approve button sends instantly).

Processes **`DAILY_LIMIT` businesses per run** (default 10). Idempotent — rows
already drafted/sent/pitched or with a Demo URL are skipped.

---

## Setup

```bash
cd bot
npm install
cp .env.example .env      # fill in the values
```

1. **Google Sheets** — service-account JSON at `bot/service-account.json`, sheet
   **shared with the service-account email as Editor**. Set `GOOGLE_APPLICATION_CREDENTIALS` + `SHEET_ID`.
2. **Claude** — set `ANTHROPIC_API_KEY` (`CLAUDE_MODEL=claude-opus-4-8`, or `claude-haiku-4-5` for cheap bulk).
3. **web_host** — server running at `HOST_BASE_URL`, the master template registered as a demo with slug `TEMPLATE_SLUG`, and `HOST_ADMIN_PASSWORD` set.
4. **Email/Resend lives in the SERVER's `.env`**, not here — see `server/.env.example` (`RESEND_API_KEY`, `EMAIL_FROM`, `SENDER_ADDRESS`, `UNSUBSCRIBE_URL`, `ADMIN_EMAIL`).

---

## Commands

```bash
npm run dry-run         # generate, but mock everything; writes to bot/_dryrun/. Safe.
npm run check           # 29 offline assertions (no secrets).

node src/index.js generate     # the morning job (default command)
node src/index.js sync         # write approved/sent statuses back to the sheet

# flags: --dry-run  --no-enrich  --only="Ezy Glide"
```

The startup log prints what's live: `live: sheetsWrite=… claude=… host=…`.
Any missing credential falls back to mock for that piece only.

---

## Scheduling

**VPS / Linux (recommended)** — note the `TZ` so "before 9am SL" is correct:
```cron
# generate the day's demos at 07:00 Sri Lanka time
30 1 * * *  cd /opt/web-host-tool/bot && TZ=Asia/Colombo /usr/bin/node src/index.js generate >> /var/log/web-host-bot.log 2>&1
# push approved/sent statuses back to the sheet every 15 minutes
*/15 * * * * cd /opt/web-host-tool/bot && /usr/bin/node src/index.js sync >> /var/log/web-host-bot-sync.log 2>&1
```
(`30 1 * * *` UTC = 07:00 Asia/Colombo. If your crontab already runs in
`Asia/Colombo`, use `0 7 * * *` instead.)

**Windows (Task Scheduler):**
```powershell
$gen = New-ScheduledTaskAction -Execute "node.exe" -Argument "src\index.js generate" -WorkingDirectory "C:\Users\ASUS\Downloads\web_host\bot"
Register-ScheduledTask -TaskName "web-host-bot-generate" -Action $gen -Trigger (New-ScheduledTaskTrigger -Daily -At 7:00am)
$syn = New-ScheduledTaskAction -Execute "node.exe" -Argument "src\index.js sync" -WorkingDirectory "C:\Users\ASUS\Downloads\web_host\bot"
Register-ScheduledTask -TaskName "web-host-bot-sync" -Action $syn -Trigger (New-ScheduledTaskTrigger -Once -At 7:00am -RepetitionInterval (New-TimeSpan -Minutes 15))
```

---

## What's verified offline

`npm run check` — 29 assertions, no secrets, against your **live sheet** (read-only)
and the server's **real `normalizeConfig`**: slug rules, CSV/region parsing,
AI→schema survival (incl. About & FAQs), email-draft personalisation, and a full
dry `generate` run that drafts demos respecting the daily limit with unique slugs.
