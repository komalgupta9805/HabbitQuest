# Little Wins

Little Wins is a friendly, local-first habit tracker designed as a realistic college hackathon project. It makes consistency visible with daily quests, streaks, XP, levels, challenges, achievement-style wins, and a contribution-map-inspired consistency view.

## What is included

- React/Vite dashboard with responsive navigation, daily checklist, calendar and saved-data analytics
- Registration, login, protected API calls, habit create/edit/archive/restore/delete, search and filters, completion and undo
- Monthly calendar navigation and date-specific completion history from persisted records
- Habit-owned colors and individual 12-week, 6-month, or 1-year activity heatmaps with a four-habit comparison selector
- Per-habit current/best streaks, selected-range completion rate, total check-ins, and weekly/monthly summaries
- Numeric daily progress for measurable habits such as pages, glasses, repetitions, or minutes
- Goal setup fields for start date, icon, duration, daily target and schedule
- Explicit per-account four-week demonstration history loader and sample-only reset action
- Seven-row contribution heatmap with 12-week, 6-month and 1-year ranges
- Original SVG mascot whose state follows persisted milestones
- FastAPI + SQLite persistence with user isolation, expiring sessions, bcrypt password hashing, partial progress, an auditable XP ledger, goals, deterministic insights, streaks, analytics, and achievements
- Simple source layout: `frontend/` is the UI, `backend/` is the API
- EmailJS test emails, opt-in reminders, a persisted notification center, and safe demo previews
- High, Medium, and Low habit priorities with a Today dashboard focus list and quick edits

## Habit priorities

Choose a priority when adding or editing a habit, or change it directly on **Today → Today's Priorities** or **My Habits**. Today's Priorities offers All, High Priority, Due Today, and Completed views. Incomplete habits appear first in priority order; completed habits remain in All and Completed. Due Today means scheduled for the user's local calendar day. Habits are recurring, so their target end date is not treated as an overdue task deadline.

Existing habits gain **Medium** on API startup through the existing SQLite column migration. New habits also default to Medium. The API accepts `High`, `Medium`, and `Low` on habit creation and editing, and `PATCH /habits/{id}/priority` changes only the priority for an authenticated owner. Priority changes do not alter completions, streaks, or analytics.

## Run the interface

```bash
npm run install:all
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Run the API

```bash
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
uvicorn app.main:app --reload
```

The API is available at `http://127.0.0.1:8000`, with interactive docs at `/docs`.

Use `.env.example` as the configuration reference. `HABITQUEST_DATABASE_URL` controls the SQLAlchemy database URL, `HABITQUEST_CORS_ORIGINS` is a comma-separated exact-origin allow-list, and `VITE_API_URL` tells the browser where the API is. For local development, `HABITQUEST_CORS_ORIGIN_REGEX` permits only `localhost` and `127.0.0.1` across Vite fallback ports; replace or disable that expression for deployment and list the deployed frontend origin explicitly. Export these values in the relevant terminal; do not commit a populated `.env` or database.

## EmailJS notifications

Copy `frontend/.env.example` to `frontend/.env`. Replace `YOUR_PUBLIC_KEY` with your real EmailJS public key. The supplied service and template IDs are `service_4hz71oq` and `template_xjkmtun`. Set `VITE_APP_URL` to the browser URL for this app (including its deployment origin in production). Restart Vite after editing `.env`. The `.env` file is ignored by Git; `.env.example` is tracked. The EmailJS public key is a browser identifier, so use EmailJS allowed-domain restrictions and account limits. Do not enter Gmail credentials in this app.

Configure the EmailJS template with **To Email** `{{to_email}}` or `{{email}}`, **To Name** `{{to_name}}`, and **Subject** `{{subject}}`. The body should include `{{message}}`, and may include `{{habit_name}}`, `{{notification_type}}`, and `{{app_url}}`. A suggested concise body is: “Hi {{to_name}}, every little step counts! {{message}} Open Little Wins: {{app_url}}”. The browser SDK supplies both recipient variables with the same signed-in account email from `GET /me`.

To send a real test: start both servers, sign in, open **Settings → Email Notifications**, confirm the configuration status, and click **Send Test Email**. The button is limited to one request per minute. A success message means EmailJS accepted the request; check the inbox and spam folder for delivery. A missing public key leaves the rest of the app usable and shows a setup message. Routine emails are off by default; enable the master switch and the desired types in Settings.

If a test fails with `HTTP 412` and `Gmail_API: Request had insufficient authentication scopes`, the browser request reached EmailJS but its connected Gmail account lacks permission to send. In the EmailJS dashboard, open **Email Services**, select the service whose ID matches `VITE_EMAILJS_SERVICE_ID`, reconnect the Google account, approve the requested send-mail permission, save/update the service, and use EmailJS's service test. Then wait one minute and send a new test from Settings. The Google authorization and any refresh token are managed by EmailJS; this app stores neither and cannot repair that connection in source code. Do not paste Google tokens or credentials into this project.

For a presentation, open **Settings → Demo Notifications** and use the four Preview buttons. Open the bell to show each example, then mark one as read and dismiss another. **Email me this example** uses EmailJS with the signed-in account's address and reports the SDK result. Preview actions do not change completions, XP, streaks, or achievements. **Clear demo notifications** hides only demo notification records for the signed-in account. Preview creation is rate limited and capped at 20 records per account per day; clearing does not reset that limit or the email attempt history.

The API computes due events using the browser's `X-Time-Zone` IANA identifier. Pending reminders require a habit reminder time and an incomplete, scheduled local day. Missed notices are created only after that local day ends. Streak reminders become due after 18:00 local time when a current streak has incomplete scheduled habits. Achievement and level-up events follow persisted milestones. Each event has a per-user unique key. The bell refreshes while the app is open; eligible routine emails are claimed once before the browser SDK call. Email status distinguishes `pending`, `attempted`, `accepted` by EmailJS, and `failed`. An interrupted attempt remains `attempted` so it cannot silently send twice; create a new test event after the cooldown if needed. EmailJS in the browser cannot send while the browser is closed. Reliable background delivery would require a separate server-side delivery service, which this project does not configure.

The backend creates `notifications` and `notification_preferences` tables on startup through its existing `create_all` convention. No database reset or manual migration command is required. Notification endpoints require the existing bearer token; listing, preferences, marking read, dismissing, previews, and email outcomes are scoped to the authenticated user. Notification requests require `X-Time-Zone`; clients without a valid IANA time zone receive a clear validation error.

## Password recovery

On the sign-in screen, choose **Forgot password?**, enter the registered email address, then use the one-time link delivered by EmailJS to choose a new password. The link expires after 30 minutes and invalidates all existing sessions once used. For this secure server-side send, also copy the EmailJS values into ignored `backend/.env` as `EMAILJS_PUBLIC_KEY`, `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, and set `APP_URL` to the exact frontend URL. The reset endpoint always reports the same response for registered and unregistered addresses, so accounts cannot be discovered through recovery requests.

Because reset links are created server-side so their tokens never reach the browser, enable **API access from non-browser environments** in EmailJS at **Account → Security**. EmailJS otherwise returns HTTP 403 before accepting the message. Keep the browser-facing origin restrictions enabled for the normal frontend notification feature.

## Test the API

```bash
cd backend
python -m pytest -q
cd ../frontend
npm test
cd ..
npm run build
```

The backend tests select a separate test database before importing the app. They never recreate the development database.

## API map

All private routes require `Authorization: Bearer <token>`. Current route names are retained for frontend compatibility; FastAPI documents schemas and validation at `/docs`.

- Auth/profile: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /me`
- Habits: `GET/POST /habits`, `GET/PUT/DELETE /habits/{id}`, archive, restore, and `GET /habits/{id}/history`
- Tracking: `GET /days/{date}`, `POST/DELETE /habits/{id}/complete`, `PUT /habits/{id}/progress`, `GET /habit-activity`
- Analytics: `GET /calendar/{year}/{month}`, `GET /activity`, `GET /analytics`, `GET /dashboard`, `GET /insights`
- Goals: `GET/POST /goals`, `GET/PUT/DELETE /goals/{id}`, and `POST /goals/{id}/pause|resume|complete`
- Gamification: `GET /gamification/profile`, `GET /gamification/xp`, `GET /gamification/achievements`, and the opt-in `GET /leaderboard`
- Invitations: authenticated `POST /invites`, public validation at `GET /invites/{token}`, and owner-only revocation with `DELETE /invites/{token}`
- Demo/readiness: `POST/DELETE /demo/sample`, `GET /health`
- Notifications: `GET /notifications`, `GET /notifications/unread-count`, `GET /notifications/due`, `POST /notifications/{id}/read|dismiss|email-claim|email-outcome`, `GET/PUT /notification-preferences`, `POST /notifications/test|demo`, `DELETE /notifications/demo`

## Project notes

Start the API before opening the frontend. The frontend is connected to it at `http://127.0.0.1:8000` by default; set `VITE_API_URL` to use another address. Set `HABITQUEST_DATABASE_URL` for a different SQLite database location (default: `sqlite:///./habitquest.db`, relative to the API working directory). Startup creates missing tables and adds backward-compatible columns without resetting saved data.

On Windows, `zoneinfo` needs the `tzdata` package from `backend/requirements.txt` in the **same Python environment that runs Uvicorn**. If the API returns a time-zone data error, stop it, run `.\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt` from the project root, then restart with `..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload` from `backend/`.

Dashboard percentages use completed scheduled occurrences divided by scheduled occurrences through the current day, with zero shown when no habits are scheduled. The frontend sends the browser's IANA time zone in `X-Time-Zone` so the API uses the user's local calendar day; clients without that header use the server's local day. Progress & Insights shows daily, weekly and monthly trends, prior-period comparisons for the same number of elapsed days, and per-habit and category consistency from saved completions. Archiving pauses occurrences; restoring resumes them. Schedule edits apply from the edit date, preserving earlier schedule calculations. The My Habits page filters active and archived habits and supports restore.

Habit Activity requests only the currently selected one to four habit histories. The selector changes the visible comparison and never deletes or merges records belonging to other habits. Every habit color is persisted with the habit and can be changed in its edit form. Heatmap cells use that color for complete and partial states, while missed scheduled days and unscheduled rest days remain visually distinct. Clicking a cell opens that date in the Today view.

Rewards are server-controlled. A completion earns 20 XP, undo writes a matching reversal, and completing every habit scheduled on a date earns a one-time 40 XP daily bonus. Per-user ledger idempotency keys prevent repeatedly completing and undoing the same date from farming XP. The database uniqueness constraint on `(habit_id, completed_on)` prevents duplicate records. Partial progress does not earn XP until it reaches the numeric daily target. A habit's current streak counts consecutive scheduled dates with a completion; rest days do not break it.

Habits are created once and remain active until archived or deleted. Calendar changes only inspect or toggle the selected date; they do not affect other days. The backend automatically adds its `active` column to an existing local SQLite database without removing prior completions.

Goal duration records a target period without deleting a habit at its end. Progress is the number of distinct completion dates divided by the target duration. Use **Help & settings → Load sample history** only for a deliberate demo; it creates clearly named records for the signed-in account. Reset removes only generated sample habits and their history, leaving real habits intact.

The overall streak counts consecutive dates on which every active scheduled habit was completed. Individual habit streaks skip that habit's unscheduled rest days. A completion earns 20 XP; completing every scheduled habit on a date earns a one-time 40 XP bonus. Undo reverses the completion XP and revokes the date bonus when it is no longer eligible. Levels advance every 100 XP.

## Data maintenance and troubleshooting

Stop the API before copying or replacing SQLite data. With default settings, back up from `backend/` using `cp habitquest.db habitquest.backup.db`. Restore by first retaining the current file as another backup, then copying the chosen backup to `habitquest.db`.

For a clean development reset, stop the API and delete only the explicit database file named by `HABITQUEST_DATABASE_URL`, then restart. The in-app **Reset sample data only** action is safer when you only want to remove Demo Mode records.

Sessions expire after seven days; sign in again when the API returns 401. For frontend network errors, confirm the API is running, `VITE_API_URL` is correct, and the browser origin is covered by `HABITQUEST_CORS_ORIGINS` or the local-only `HABITQUEST_CORS_ORIGIN_REGEX`. Vite may use 5174, 5175, or another port when 5173 is already occupied; the default local regex handles that without allowing public origins.
