# HabitQuest

HabitQuest is a friendly, local-first habit tracker designed as a realistic college hackathon project. It makes consistency visible with daily quests, streaks, XP, levels, challenges, achievement-style wins, and a contribution-map-inspired consistency view.

## What is included

- Original React/Vite dashboard with responsive, accessible interactions and browser-history navigation
- Registration, login, protected API calls, habit create/edit/archive/delete, search, completion and undo
- Monthly calendar navigation and date-specific completion history from persisted records
- Goal setup fields for start date, icon, duration, daily target and schedule
- Explicit per-account four-week demonstration history loader and sample-only reset action
- Seven-row contribution heatmap with 10-week, 6-month and 1-year ranges
- Original SVG mascot whose state follows persisted milestones
- FastAPI + SQLite persistence with user isolation, duplicate-completion protection, XP, levels, daily bonuses, streaks, weekly challenges, heatmap data, and achievements
- Simple source layout: `frontend/` is the UI, `backend/` is the API

## Run the interface

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Run the API

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API is available at `http://127.0.0.1:8000`, with interactive docs at `/docs`.

## Test the API

```bash
cd backend
pytest
```

## Project notes

Start the API before opening the frontend. The frontend is connected to it at `http://127.0.0.1:8000` by default; set `VITE_API_URL` to use another address.

Rewards are server-controlled. A completion earns 20 XP, undoing it reverses 20 XP, and completing every habit scheduled today earns a one-time 40 XP daily bonus. The database uniqueness constraint on `(habit_id, completed_on)` prevents duplicate rewards. A habit's current streak counts consecutive scheduled dates with a completion; dates outside its schedule are rest days and do not break the streak. Deleting a habit also deletes its completion history, so it no longer affects analytics.

Habits are created once and remain active until archived or deleted. Calendar changes only inspect or toggle the selected date; they do not affect other days. The backend automatically adds its `active` column to an existing local SQLite database without removing prior completions.

Goal duration records a target period without deleting a habit at its end. Progress is the number of distinct completion dates divided by the target duration. Use **Help & settings → Load sample history** only for a deliberate demo; it creates clearly named records for the signed-in account. Reset removes only generated sample habits and their history, leaving real habits intact.

The overall streak counts consecutive dates on which every active scheduled habit was completed. Individual habit streaks skip that habit's unscheduled rest days. A completion earns 20 XP; completing every scheduled habit on a date earns a one-time 40 XP bonus. Undo reverses the completion XP and revokes the date bonus when it is no longer eligible. Levels advance every 100 XP.
