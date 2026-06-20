# Noura — Architecture

## What is Noura?

Noura is a mobile-first personal nutrition and fitness tracker built around natural language input and AI coaching. Instead of tapping through dropdown menus or searching food databases, the user describes what they ate or what they trained in plain text (e.g., *"2 huevos, 150g claras, 50g avena con leche de almendras"*) and the AI parses it into structured macronutrient data. The same idea applies to workouts: a single sentence like *"sentadilla 60kg 4x10"* becomes a logged exercise with volume calculated.

Beyond logging, Noura has a conversational AI coach named Noura (powered by Claude) that can answer nutrition and fitness questions, recommend adjustments based on the user's actual recent logs, and generate a personalized weekly meal + workout plan that gets saved to the user's account. That plan then appears alongside each daily log entry as a comparison so the user can see how closely they followed it.

The app is in Spanish, designed for daily use on a phone, and scoped to a single user at a time (no social features). The aesthetic is warm and minimal — beige, terracotta, and sage green — with a fixed bottom navigation bar and no page transitions.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS v4 |
| Backend API | Vercel Serverless Functions (Node.js) |
| Database & Auth | Supabase (PostgreSQL + RLS + Supabase Auth) |
| AI | Anthropic Claude Sonnet 4.6 (`@anthropic-ai/sdk`) |
| Charts | Recharts |
| Markdown | react-markdown |
| Deployment | Vercel |

---

## Project Structure

```
dietgymtrack/
├── src/
│   ├── main.jsx                  # React entry point
│   ├── App.jsx                   # Auth gate + tab routing
│   ├── index.css                 # Tailwind v4 + design tokens
│   ├── components/
│   │   ├── Auth.jsx              # Login / register form
│   │   ├── Dashboard.jsx         # Home tab: daily summary, charts
│   │   ├── NutritionLog.jsx      # Food logging with AI parsing
│   │   ├── WorkoutLog.jsx        # Workout logging with AI parsing
│   │   ├── WeightLog.jsx         # Body weight tracking
│   │   ├── Chat.jsx              # AI coaching chat + plan saving
│   │   ├── Settings.jsx          # Macro goals + sign out
│   │   └── BottomNav.jsx         # 5-tab fixed nav bar
│   └── lib/
│       └── supabase.js           # Supabase client singleton
├── api/
│   ├── parse-nutrition.js        # POST /api/parse-nutrition
│   ├── parse-workout.js          # POST /api/parse-workout
│   └── chat.js                   # POST /api/chat
├── supabase-schema.sql           # Full DB schema + RLS policies
├── vercel.json                   # Vercel rewrites for /api/*
├── vite.config.js
├── index.html                    # Spanish locale, Google Fonts preload
└── package.json
```

---

## Frontend Architecture

### Routing & State

The app is a single-page application. `App.jsx` handles two top-level states:

1. **Auth gate** — Checks `supabase.auth.getSession()` on load and listens to `onAuthStateChange`. Unauthenticated users see `<Auth />`. Authenticated users see the tab shell.
2. **Tab navigation** — Five tabs managed with a `activeTab` string in `App.jsx`. Components are lazily mounted (only rendered once the tab is first visited) to avoid unnecessary Supabase queries on load.

There is no global state manager (no Redux, Zustand, or Context). Each tab component owns its own local state and fetches from Supabase directly via `useEffect`.

### Tab Components

| Tab | Component | Key responsibilities |
|---|---|---|
| Inicio | `Dashboard.jsx` | 7-day calorie chart, macro progress bars, weight trend, recent workouts |
| Comida | `NutritionLog.jsx` | AI food parsing, macro editing, plan comparison, log history |
| Chat | `Chat.jsx` | Conversational AI coach, plan generation via tool use, chat history |
| Entreno | `WorkoutLog.jsx` | AI workout parsing, volume calculation, plan comparison, log history |
| Metas | `Settings.jsx` + `WeightLog.jsx` | Macro goal editing, weight entry, 14-day weight chart |

### Design System

Defined as CSS custom properties in `index.css` using Tailwind v4's `@theme` block:

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#F7F4EE` | Page background (warm beige) |
| `--color-surface` | `#EFEBE3` | Cards and input backgrounds |
| `--color-border` | `#DDD8CE` | Dividers and outlines |
| `--color-terracota` | `#C4714A` | Primary actions, active tab, CTA buttons |
| `--color-salvia` | `#7A9E7E` | Positive/health states, secondary accents |
| `--color-dorado` | `#D4A843` | Warnings, moderate progress |
| `--color-ink` | `#1C1C1A` | Body text |

Typography: **DM Sans** (body, variable weight) and **DM Serif Display** (headings), both from Google Fonts.

Status colors for macro tracking follow a three-tier system: green (≥ 90% of goal), yellow (50–89%), red (< 50%).

---

## API Layer (Vercel Serverless Functions)

All three endpoints live in `/api/` and are routed via `vercel.json` rewrites. They run in Node.js and import `@anthropic-ai/sdk` server-side so the Anthropic API key is never exposed to the browser.

### `POST /api/parse-nutrition`

Accepts `{ text: string }` — a free-text food description in Spanish.

Sends to `claude-sonnet-4-6` with a structured prompt instructing it to return JSON only. Output shape:

```json
{
  "alimentos": [
    {
      "nombre": "string",
      "cantidad_g": number,
      "calorias": number,
      "proteina_g": number,
      "carbs_g": number,
      "grasa_g": number
    }
  ],
  "totales": {
    "calorias": number,
    "proteina_g": number,
    "carbs_g": number,
    "grasa_g": number
  }
}
```

### `POST /api/parse-workout`

Accepts `{ text: string }` — a free-text workout description.

Output shape:

```json
{
  "ejercicios": [
    {
      "nombre": "string",
      "peso_kg": number,
      "series": number,
      "reps": number,
      "volumen_kg": number
    }
  ]
}
```

Bodyweight exercises use `peso_kg: 0`. Volume is `peso_kg × series × reps`.

### `POST /api/chat`

Accepts:

```json
{
  "messages": [{ "role": "user" | "assistant", "content": "string" }],
  "context": {
    "goals": { "kcal_meta": number, "proteina_meta": number, "carbs_meta": number, "grasa_meta": number },
    "plan": { "nutricion": object, "entrenamiento": object } | null,
    "recentNutrition": [...],
    "recentWorkouts": [...],
    "todayLogs": { "nutrition": [...], "workout": [...] }
  }
}
```

The system prompt establishes Claude as **Noura**, a Spanish-speaking nutrition and fitness coach. The full user context (goals, recent logs, today's entries, current plan) is injected into the system prompt on every request so the AI can give personalized, data-aware responses.

Implements one Claude tool: **`guardar_plan`** — when the user asks for a plan, Claude calls this tool with a structured nutrition and workout plan. The API layer intercepts the tool call, extracts the plan object, then makes a second Claude call to generate the conversational response. The plan and the text reply are both returned to the client.

Output:

```json
{
  "content": "string",
  "plan": { "nutricion": object, "entrenamiento": object } | null
}
```

---

## Database (Supabase / PostgreSQL)

All tables require authentication and use Row Level Security policies that restrict every operation to `user_id = auth.uid()`. No user can read or write another user's data.

### Tables

#### `nutrition_logs`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → `auth.users` |
| `fecha` | date | Entry date |
| `descripcion_original` | text | Raw text the user typed |
| `alimentos` | jsonb | Array of parsed food items |
| `totales` | jsonb | `{calorias, proteina_g, carbs_g, grasa_g}` |
| `created_at` | timestamptz | |

#### `workout_logs`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → `auth.users` |
| `fecha` | date | Entry date |
| `descripcion_original` | text | Raw text the user typed |
| `ejercicios` | jsonb | Array of parsed exercises with volume |
| `created_at` | timestamptz | |

#### `weight_logs`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → `auth.users` |
| `fecha` | date | Entry date |
| `peso_kg` | numeric(5,2) | Body weight |
| `created_at` | timestamptz | |
| — | — | Unique constraint on `(user_id, fecha)` |

#### `user_goals`
| Column | Type | Default |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → `auth.users` (unique) |
| `kcal_meta` | integer | 1720 |
| `proteina_meta` | integer | 145 |
| `carbs_meta` | integer | 155 |
| `grasa_meta` | integer | 58 |
| `updated_at` | timestamptz | |

#### `user_plan`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → `auth.users` (unique) |
| `nutricion` | jsonb | Weekly meal plan by meal type |
| `entrenamiento` | jsonb | Weekly workout plan by day |

#### `chat_messages`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → `auth.users` |
| `role` | text | `'user'` or `'assistant'` |
| `content` | text | Message body |
| `created_at` | timestamptz | |

---

## AI Integration

All AI calls use `claude-sonnet-4-6`. The API key (`ANTHROPIC_API_KEY`) is only present in the Vercel server environment — it is never sent to or accessible from the browser.

### AI Feature Map

| Feature | Endpoint | Claude capability used |
|---|---|---|
| Parse food text | `/api/parse-nutrition` | Text generation with JSON output |
| Parse workout text | `/api/parse-workout` | Text generation with JSON output |
| Coaching chat | `/api/chat` | Multi-turn conversation with context injection |
| Plan generation | `/api/chat` (via tool) | Tool use (`guardar_plan`) for structured output |

### Plan Generation Flow

```
User: "Hazme un plan personalizado"
  → Client sends messages + full context to /api/chat
  → Claude generates a plan and calls guardar_plan tool
  → API extracts plan from tool_use block
  → API makes a second Claude call to get conversational text response
  → Returns { content, plan } to client
  → Client saves plan to user_plan table via Supabase
  → Client shows confirmation UI
```

---

## Environment Variables

| Variable | Where used |
|---|---|
| `VITE_SUPABASE_URL` | Browser (Vite exposes `VITE_*` to client) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser (anon/publishable key — safe to expose) |
| `ANTHROPIC_API_KEY` | Server only (Vercel Functions) |

---

## Deployment

Deployed on Vercel. The frontend is built by Vite and served as static assets. The `/api/*` routes are served as Vercel Serverless Functions. `vercel.json` configures the rewrite so `/api/(.*)` hits the function files in `/api/`.

No CI pipeline is configured. Deployments are triggered manually or via Vercel's GitHub integration on push.
