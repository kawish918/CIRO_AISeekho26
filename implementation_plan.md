# CIRO Mobile App Redesign + Backend Refactor

Complete overhaul of the mobile app UI (light theme, minimalist, drill-down navigation), backend cleanup (remove Google Cloud, use local mock data), and continuous master agent loop.

---

## User Review Required

> [!IMPORTANT]
> **Google Cloud removal**: All Firestore imports and connections in both `main.py` and `agents.py` will be removed. Data will live entirely in-memory via the FastAPI server. This means data resets on server restart.

> [!IMPORTANT]
> **Mobile App complete rewrite**: The current 4-tab dark theme UI will be replaced with a 3-tab light/minimalist design with drill-down navigation. All existing screen files will be replaced.

---

## Proposed Changes

### Component 1: Backend — Remove Google Cloud & Fix API

#### [MODIFY] [main.py](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/backend/main.py)
- **Remove** `google.cloud.firestore` import and the `db` client initialization (lines 9-14)
- **Remove** Firestore reads from `get_active_crises` and `get_agent_traces` — use only in-memory stores
- Ensure all endpoints return consistent, working data without any cloud dependency
- Add a new endpoint `GET /api/dashboard` that returns an aggregated summary for the mobile app home screen:
  ```python
  {
    "crises": [...],          # active crises
    "resources": {...},       # current inventory
    "system_status": {...},   # cycle, active_agent, phase
    "signal_counts": { "social": N, "weather": N, "traffic": N, "emergency": N },
    "notification_count": N,
    "trace_count": N
  }
  ```

#### [MODIFY] [agents.py](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/backend/agents.py)
- **Remove** `google.cloud.firestore` import, `db` client, `fs_push_crisis()`, `fs_push_trace()` and all `fs_push_*` calls
- **Remove** the Firestore batch push in `fusion_node`
- **Make the agent loop continuous**: The `run()` function currently runs Cycle 1, then Cycle 2 (field report injection), then loops every 15s. This stays the same conceptually — it's already a "master loop". The key change is:
  - Add `set_status()` calls between every step so the mobile app always knows what's happening
  - Reduce the inter-cycle wait from 15s to 10s for a snappier demo
  - The master loop never stops (this is already the case with `while True`)

---

### Component 2: Mobile App — Complete UI Redesign

The current app has 4 tabs (Agent Mind, Signals, Crises, Resources) with a dark theme that's hard to navigate. The redesign uses:

- **Light theme** with clean whites, soft grays, and accent colors
- **3 tabs**: Dashboard (home), Map, Agent Logs
- **Drill-down navigation**: Dashboard → Event Detail → Full Agent Report
- **Event-type containers** on the home screen (Weather, Flood, etc.) each with severity/credibility/status boxes

#### [MODIFY] [_layout.tsx](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/mobile_app/src/app/_layout.tsx)
- Switch to using Expo Router's `Stack` navigator as the root, with `Tabs` for the main screens
- Force light theme via `ThemeProvider`

#### [MODIFY] [app-tabs.tsx](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/mobile_app/src/components/app-tabs.tsx)
- Change to 3 tabs: **Dashboard**, **Map**, **Agent Log**
- Use cleaner tab labels and light-theme colors

#### [NEW] [index.tsx](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/mobile_app/src/app/index.tsx) — Dashboard (Home Screen)
Complete rewrite. The home screen shows:
1. **Header**: "CIRO" branding with system status indicator (cycle number, active/idle)
2. **Quick stats row**: Active crises count, resources available, alerts sent
3. **Event containers**: For each active crisis, a card showing:
   - Crisis type icon + title (e.g. "🌊 Urban Flooding — G-10")
   - Three mini-boxes inside: **Severity** (Critical/High/Medium), **Confidence** (87%), **Status** (Active/Resolved)
   - Location + affected population summary
   - Tap to navigate to detail screen
4. **Resource summary bar** showing available/total for key resources
5. Light background, rounded cards, soft shadows

#### [NEW] [event-detail.tsx](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/mobile_app/src/app/event-detail.tsx) — Event Detail Screen
When user taps an event card from Dashboard:
- Full crisis information: description, affected population, radius, duration, spread risk, evolution
- Resources allocated to this crisis
- Impact simulations for this crisis
- Stakeholder notifications sent for this crisis  
- "View Agent Report →" button to drill deeper

#### [NEW] [agent-report.tsx](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/mobile_app/src/app/agent-report.tsx) — Full Agent Report Screen
Deepest drill-down showing:
- Complete flow of how agents handled this crisis (step-by-step timeline)
- Each agent's ReACT trace: Observation → Reasoning → Decision → Action → Outcome
- Color-coded by agent, with timestamps
- Shows the full pipeline: Fusion → Analyst → Commander → Execution → Notification → Verifier (→ Rollback if applicable)

#### [MODIFY] [crises.tsx → map.tsx](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/mobile_app/src/app/crises.tsx) — Renamed to Map Tab
- **Separate dedicated Map tab** (was combined with crisis list before)
- Full-screen Leaflet map via WebView showing all crisis markers
- Fix map markers: ensure `lat`/`lng` come from `LOCATION_COORDS` dictionary and are passed correctly
- Light-themed map tiles (use CartoDB Positron tiles instead of default OSM for lighter look)
- Tappable markers that show crisis info popup
- Legend showing severity colors

#### [DELETE] [signals.tsx](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/mobile_app/src/app/signals.tsx)
- Raw signal data is now accessible from the event detail screen and agent report, not as a separate tab

#### [DELETE] [resources.tsx](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/mobile_app/src/app/resources.tsx)
- Resource inventory is shown on the Dashboard. Outage demo controls moved to a settings button on Dashboard.

#### [NEW] [agents-log.tsx](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/mobile_app/src/app/agents-log.tsx) — Agent Log Tab
- Chronological feed of all agent traces (like the old index.tsx "Agent Mind" but cleaner)
- Shows pipeline progress indicator
- Light theme, clean cards
- Each trace shows agent name, step, reasoning summary
- Tap a trace to expand full details

#### [MODIFY] [api.ts](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/mobile_app/src/constants/api.ts)
- Keep local IP approach but add a comment about production deployment

#### [MODIFY] [theme.ts](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/mobile_app/src/constants/theme.ts)
- Update light theme colors for the new minimalist design

---

### Component 3: Map Fixes

The current map has issues with marker placement. Fixes:
- In `main.py`, the `resolve_coords()` function is already correct with real Islamabad coordinates
- In the mobile app, ensure we always use `crisis.lat` and `crisis.lng` from the API (which are resolved server-side via `resolve_coords`)
- Switch to CartoDB Positron light tiles for better readability
- Add a fallback: if `lat`/`lng` are null, use the fallback Islamabad center coordinates

---

## Open Questions

> [!NOTE]
> **API URL**: Currently hardcoded to `10.135.133.192:8000`. Should I keep this IP or update it? For "deployable" purposes I'll keep `localhost:8000` and add clear instructions for users to change it.

> [!NOTE]
> **Expo Router navigation**: The current app uses `NativeTabs` from `expo-router/unstable-native-tabs`. For the drill-down navigation (Dashboard → Event Detail → Agent Report), I'll use a `Stack` navigator nested inside the tab layout. This is the standard Expo Router pattern.

---

## Verification Plan

### Automated Tests
- Run `cd backend && python -m pytest tests/` to ensure backend tests still pass after Firestore removal
- Start backend with `uvicorn main:app --reload --port 8000` and test all API endpoints manually

### Manual Verification
- Start mobile app with `npx expo start` and verify:
  - Dashboard shows event containers with severity/credibility/status boxes
  - Tapping an event navigates to detail screen
  - Tapping "View Agent Report" navigates to full report
  - Map tab shows correct markers on Islamabad map
  - Agent Log tab shows traces
  - Light theme throughout
  - Pull-to-refresh works on all screens
