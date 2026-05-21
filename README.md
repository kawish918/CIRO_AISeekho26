# 🛰️ CIRO – Crisis Intelligence & Response Orchestrator

> **AISeekho Hackathon · Challenge 3** — Agentic multi-source crisis detection, resource allocation with cognitive friction, impact simulation, and adaptive false-positive recovery for Islamabad, Pakistan.

---

## 🔗 Live Deployment Links

| Platform | URL |
|---|---|
| **Backend API** (Cloud Run) | https://ciro-backend-720063557968.us-central1.run.app |
| **Web Dashboard** (Netlify) | https://kaleidoscopic-pasca-baef63.netlify.app/ |
| **Mobile App** (APK) | https://drive.google.com/drive/folders/1EbteF1fOAdQm27AfUAGA7_JUb2zm1nPz?usp=drive_link |
| **API Health Check** | https://ciro-backend-720063557968.us-central1.run.app/api/health |

---

## 🧑‍⚖️ Judge Walkthrough — Interactive Demo

> **Important:** The backend resets to a clean state on each deployment. When you first open the web app, the dashboard will be empty and the system will be idle. This is by design — CIRO is event-driven and only activates when a signal spike is detected.

### Step 1: Open the Web Dashboard
Open the Netlify URL in your browser. Wait ~5–10 seconds for the Cloud Run backend to cold-start. The connection indicator in the top-right will change from **OFFLINE** → **ONLINE**.

### Step 2: Trigger the Pipeline
Click the **"Trigger Pipeline Run"** button in the control bar. Watch the **Live Multi-Agent Orchestration Graph** at the top — each agent lights up as it processes:

```
Orchestrator → Fusion → Analyst → Advisory Board → Execution → Notify → Verifier
```

Within ~15 seconds, the dashboard will populate with:
- **4 detected events**: G-10 Flood (Critical), F-8 Heatwave (High), I-9 Accident (Low), G-13 Power Flicker (Low)
- **Resource allocations** with live countdown timers
- **Priority Scores** mathematically locked (e.g., Flood: ~75,000 vs Heatwave: ~43,333)

### Step 3: Explore the Detail Panel
Click any crisis card to open the **side drawer** showing:
- 📊 Locked Priority Score formula explanation
- 🏛️ **Advisory Board Debate Transcript** (Field Commander vs. Logistics Director → Synthesizer consensus)
- ⏳ Resource commitment countdowns
- 📈 Impact simulation predictions
- 📨 Tailored stakeholder notifications (6 audiences)

### Step 4: Inject a False-Positive Report
Click **"Inject WASA Field Report"**. This simulates a WASA field engineer contradicting the G-10 Flood — "No flooding found. Root cause is a broken water main."

Watch the **Agent Log tab** — the system automatically:
1. Routes to the **Verification-Only Path** (skips full pipeline)
2. **VerifierAgent** confirms the false positive
3. **RollbackAgent** frees all flood-allocated resources back to inventory
4. G-10 Flood disappears from the dashboard

### Step 5: Observe the Gas Leak Crisis
~30 seconds after rollback, a **new crisis emerges automatically**: Gas Pipeline Rupture at Blue Area. The freed flood resources are reallocated to this new crisis by the Advisory Board.

This demonstrates the **full resource lifecycle**: detect → allocate → verify → rollback → reallocate.

### Step 6: Test Robustness (Optional)
Click **"Simulate API Outage"** to disable Weather and Traffic APIs. The agents will fall back to cached data with a `[DEGRADED]` warning in traces. Click **"Restore APIs"** to resume live data.

### Step 7: View the Map
Switch to the **Crisis Map** tab. Click any crisis in the sidebar to **fly the map** to its GPS coordinates. Markers are severity-colored (red = Critical, amber = High, blue = Medium/Low).

### Step 8: Review Agent Reasoning
Switch to the **Agent Log** tab. Use the filter dropdown to isolate specific agents. Expand any trace card to see the full **ReACT loop** (Observe → Think → Act → Result).

---

## Architecture Overview

```
  ┌──────────────┐    REST/JSON    ┌──────────────────────┐
  │  Expo Mobile  │◄──────────────►│   FastAPI Backend     │
  │  (3 screens)  │                │   (Cloud Run)         │
  ├──────────────┤                └──────────┬───────────┘
  │  Web Dashboard│◄──────────────►           │
  │  (Netlify)    │                           │
  └──────────────┘        ┌───────────────────┴──────────────────────┐
                          │                                          │
                          ▼                                          ▼
              ┌──────────────────────────┐           ┌──────────────────────────┐
              │  EVENT-DRIVEN TRIGGER    │           │  ResourceMonitor (TTL)   │
              │  • Social velocity > 15  │           │  • Checks every 5s       │
              │  • Sensor threshold      │           │  • Auto-frees expired    │
              │    exceeded (Critical)   │           │    resource allocations  │
              │  • Field report →        │           │  • Triggers re-evaluation│
              │    Verification-only path│           └──────────────────────────┘
              └────────────┬─────────────┘
                           │
                           ▼
              ┌──────────────────────────────┐
              │  MasterOrchestrator          │
              │  (agents.py — LangGraph)     │
              │  ├─► Full Pipeline (7 nodes) │
              │  └─► Verify-only path (2)    │
              └──────────────────────────────┘
```

---

## Event-Driven Architecture

Unlike a simple polling loop, CIRO uses **event-driven spike detection**. The system doesn't waste LLM calls scanning when nothing is happening.

```
  ┌─────────────────────────────────────────────────────────────┐
  │                  EVENT-DRIVEN TRIGGER SYSTEM                │
  │                                                             │
  │   Signal endpoints detect anomalies at data ingestion:      │
  │                                                             │
  │   📱 Social API:  mention_velocity > 15  ──────┐           │
  │   📡 Sensor API:  threshold_exceeded + Critical ┤           │
  │   🔧 Manual:      POST /api/trigger_pipeline    ┤           │
  │   ♻️ TTL Monitor: resources auto-freed          ┤           │
  │   📝 Field Report: POST /api/field_reports      ┤           │
  │                                                  │           │
  │                          ┌───────────────────────▼────────┐ │
  │                          │  _check_and_trigger_spike()    │ │
  │                          │  • 30s cooldown (bypassed for  │ │
  │                          │    field reports)               │ │
  │                          │  • Logs PipelineEvent to API   │ │
  │                          │  • Spawns background thread    │ │
  │                          └───────────────────────┬────────┘ │
  │                                                  │           │
  │                          ┌───────────────────────▼────────┐ │
  │                          │  run_pipeline_once()            │ │
  │                          │  ├─ field_report → _verify_only │ │
  │                          │  └─ others → _dispatch_pipeline │ │
  │                          └────────────────────────────────┘ │
  └─────────────────────────────────────────────────────────────┘
```

> **Key innovation**: The graph only wakes up and spends Groq API tokens when it is **explicitly poked by a data spike**. No wasted polling cycles.

---

## LangGraph Agent Pipeline (7 Nodes, Conditional Routing)

```
  ┌──────────────────┐
  │  LangGraph Graph  │  (7-node conditional pipeline, event-driven)
  └────────┬─────────┘
           │
           ▼
  ┌────────────────────┐
  │ 1. Fusion & Triage │  ← Full 5-source fusion with credibility scoring
  │  📡 FusionAgent    │    mention_velocity, sensor thresholds, contradictions
  └─────────┬──────────┘
            ▼
  ┌────────────────────┐
  │ 2. Crisis Analyst  │  ← LLM classifies: type, severity, confidence,
  │  🧠 AnalystAgent   │    population, radius, duration, spread risk
  └─────────┬──────────┘
            ▼
  ┌──────────────────────────────────────────────────────┐
  │ 3. Resource Commander — ADVISORY BOARD               │
  │  ⚡ 3 sub-agent cognitive friction loop:             │
  │                                                      │
  │  📢 Field Operations Commander                      │
  │  "Max ambulances to G-10 NOW. Score 75000 vs 43333" │
  │            ▼                                         │
  │  ⚖️ Civil Logistics Director                        │
  │  "Risk: depleting all ambulances leaves F-7 exposed" │
  │            ▼                                         │
  │  ✅ Master Synthesizer (Structured Output)           │
  │  Resolves debate → locked Priority Scores → Pydantic │
  └─────────┬────────────────────────────────────────────┘
            ▼
  ┌────────────────────┐
  │ 4. Execution       │  ← Before/after simulation, congestion impact,
  │  🎯 ExecutionAgent │    resource cost, side effects per action
  └─────────┬──────────┘
            ▼
  ┌────────────────────┐
  │ 5. Notification    │  ← 6 tailored stakeholder messages
  │  📨 NotifAgent     │    (public, hospitals, police, utility, transport, media)
  └─────────┬──────────┘
            ▼
  ┌────────────────────┐
  │ 6. Verifier        │  ← Field report contradiction detection via LLM
  │  🔎 VerifierAgent  │    Issues retraction if false positive confirmed
  └─────────┬──────────┘
            │
     ┌──────▼──────┐  false_positive_ids present?
     │   Routing    │  NO → END
     └─────────────┘
                       │ YES
                       ▼
         ┌─────────────────────┐
         │ 7. Rollback Agent   │
         │  ♻️ RollbackAgent   │
         │  Parses resource     │
         │  strings, frees      │
         │  inventory counts,   │
         │  pushes to API       │
         └──────────┬──────────┘
                    │
                    ▼ END
```

> **Conditional routing**: Node 6 (Verifier) uses a `conditional_edge` — if a false positive is detected, the graph dynamically routes to Node 7 (Rollback) which de-allocates resources before terminating.

---

## Multi-Agent Cognitive Friction (The Advisory Board)

A single LLM making massive resource allocation decisions lacks the checks and balances required for high-stakes public safety. CIRO's **Advisory Board** pattern splits the Commander node into a mini-consensus loop:

| Sub-Agent | Persona | Focus |
|---|---|---|
| 📢 **Field Operations Commander** | Aggressive tactician | Speed, raw severity, immediate life-saving |
| ⚖️ **Civil Logistics Director** | Strategic planner | Resource conservation, side-effect mitigation, infrastructure protection |
| ✅ **Master Synthesizer** | Neutral arbiter | Resolves the debate, outputs locked Priority Scores via Pydantic |

### How it works:

1. **Field Commander** proposes an aggressive plan (free-text LLM call)
2. **Logistics Director** reads the proposal and **critiques it** — identifying resource depletion risks, infrastructure bottlenecks, and unintended consequences (free-text LLM call)
3. **Master Synthesizer** reads the debate transcript and produces the final **structured allocation** using locked Priority Scores (structured output LLM call)

The full debate transcript is persisted in the Agent Trace logs, visible in both the web dashboard and mobile app's Agent Log tab.

---

## Simulation Events

CIRO processes 4 base events plus 1 conditional post-rollback crisis:

| # | Event | Location | Severity | Signal Velocity | Trigger |
|---|-------|----------|----------|----------------|---------|
| 1 | 🌊 Urban Flood | G-10 Markaz | Critical | 23 (high) | Always active |
| 2 | 🔥 Heatwave Emergency | F-8 Residential | High | 11 (moderate) | Always active |
| 3 | 🚗 Minor Traffic Accident | I-9 Service Road | Low | 3 (low) | Always active |
| 4 | ⚡ Power Flicker | G-13 Grid Station | Low | 2 (low) | Always active |
| 5 | 💨 Gas Pipeline Rupture | Blue Area Commercial | Critical | 19 (high) | **Only after flood rollback** |

Events 3 & 4 demonstrate that the LLM correctly classifies low-priority incidents and allocates minimal resources. Event 5 only appears when the G-10 flood is rolled back as a false positive, demonstrating the full lifecycle: detect → rollback → reallocate freed resources.

---

## What the LLM Decides vs. What is Deterministic

| Field | Source | Details |
|---|---|---|
| `confidence_score` | **LLM** | Cross-source corroboration assessment (0–100) |
| `affected_population` | **LLM** (guided) | Prompt provides population hints per sector (G-10: 45K, F-8: 52K), but the LLM chooses the final number |
| `affected_radius_km` | **LLM** | Estimated from crisis type and signal data |
| `expected_duration_hours` | **LLM** | Can be 2h (accident) or 48h (heatwave) — no cap |
| `spread_risk` | **LLM** | Low/Medium/High based on type and evolution |
| `severity` | **LLM** | Low/Medium/High/Critical from signal analysis |
| `crisis_type` | **LLM** | flood, heatwave, accident, etc. |
| `priority_score` | **Deterministic (Locked)** | `Severity_Multiplier × Population ÷ ETA` — computed in Python, LLM cannot override |
| `ETA` | **Google Maps API** | Live Distance Matrix call to Google |
| `allocated_resources` | **LLM (Advisory Board)** | 3 sub-agents debate, Synthesizer outputs final list |
| `trade_off_reasoning` | **LLM** | References both sub-agent perspectives |

> The LLM decides *what* each crisis looks like (population, duration, severity). The code then locks the Priority Score using a deterministic formula. The Advisory Board LLM debate decides *who gets what resources*, but cannot change the score.

---

## Priority Score Matrix

```
Priority Score = Severity_Multiplier × Affected_Population ÷ Google_Maps_ETA_minutes
```

| Severity | Multiplier |
|---|---|
| Critical | **20** |
| High | **5** |
| Medium | 2 |
| Low | 1 |

**Example with current events:**
- G-10 Flood (Critical, 45K pop, 12-min ETA): `20 × 45000 ÷ 12 = 75,000`
- F-8 Heatwave (High, 52K pop, 6-min ETA): `5 × 52000 ÷ 6 = 43,333`
- G-10 gets resources **first** — mathematically justified, LLM-proof

The Priority Score is **locked** — computed in Python before any LLM call and enforced after the Synthesizer returns.

---

## Resource Lifecycle & TTL Callbacks

Resources aren't just allocated — they have a **Time-To-Live (TTL)** and are automatically freed when the crisis duration expires.

```
  Advisory Board allocates: "3 Ambulances" → G-10 Flood
  allocated_at: 14:30:00
  release_at:   14:31:00  (TTL = duration × 0.25 min)
  status: "active"

  ResourceMonitor (every 5s):
    if current_time > release_at:
      → increment inventory
      → status = "released"
      → post AgentTrace
      → trigger pipeline re-evaluation
```

Both the web dashboard and mobile app show live countdown timers for each allocation, and "✓ Released" when resources auto-free.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **LLM Reasoning** | Groq API · Llama 3.3 70B | All agent nodes use structured LLM output |
| **Agent Orchestration** | LangGraph (`StateGraph`) | Conditional graph with `false_positive_ids` routing |
| **Cognitive Friction** | 3 sub-agent Advisory Board | Field Commander ↔ Logistics Director → Synthesizer |
| **Backend API** | FastAPI + Pydantic v2 | Signal streams, CRUD, event-driven triggers, TTL monitor |
| **Web Dashboard** | React 19 + Vite + Leaflet.js | 3 tabs: Dashboard, Interactive Map, Agent Log |
| **Mobile App** | React Native · Expo SDK 55 | 3 tabs: Dashboard, Map (full-screen Leaflet), Agent Log |
| **Deployment** | Google Cloud Run + Netlify | Backend: containerized Docker, Frontend: static SPA |
| **Geospatial Intel** | Google Maps Distance Matrix API | Live travel ETAs for Priority Score calculation |
| **Map Rendering** | Leaflet.js + CartoDB Positron | GPS markers with severity-colored circles |
| **Resource Lifecycle** | FastAPI Background Tasks | TTL-based auto-free with pipeline re-trigger (5s check) |

---

## Google Antigravity Integration

This project was **fully orchestrated by Google Antigravity (AI coding assistant)**, which acted as the senior architect throughout every phase:

| Phase | Antigravity Role |
|---|---|
| **Architecture** | Designed the 7-node conditional LangGraph pipeline, event-driven spike detection, and TTL resource lifecycle |
| **Advisory Board** | Designed the 3 sub-agent cognitive friction loop (Field Commander ↔ Logistics Director → Synthesizer) |
| **Code Generation** | Generated all agent nodes, Pydantic schemas, FastAPI endpoints, React Native screens, Web dashboard |
| **Priority Matrix** | Implemented the mathematical Priority Score formula with locked deterministic values |
| **Resource Lifecycle** | Designed TTL-based resource allocation with auto-free monitor and pipeline re-trigger |
| **Verification Path** | Built the verification-only routing (field reports skip Fusion/Analyst/Commander) |
| **Event-Driven Design** | Replaced polling with spike-detection triggers in signal endpoints |
| **Geospatial Intel** | Implemented Google Distance Matrix API integration for accurate Priority Scores |
| **Web Dashboard** | Built the full Mission Control web app with Leaflet maps, glassmorphic dark UI, and detail drawers |
| **Cloud Deployment** | Containerized backend with Dockerfile, deployed to Cloud Run with env vars, Netlify for frontend |
| **Robustness** | Designed `_outage_mode` flag system with degraded-mode cache fallback |
| **Testing** | Generated 22 automated tests covering all schemas, CRUD endpoints, helpers, and fallback behavior |

Antigravity trace artifacts (workplan, task plans, reasoning logs) are available in the project's `.gemini/` directory.

---

## Scenario Walkthrough

### Startup — Event-Driven Detection
- Server starts with the **ResourceMonitor** background task (checks every 5s)
- Signal endpoints (`/api/social`, `/api/sensors`) include spike detection
- When mention_velocity > 15 or sensor threshold exceeded with Critical severity → **event fires**
- `_check_and_trigger_spike()` logs a `PipelineEvent` and spawns `run_pipeline_once()` in a background thread

### Cycle 1 — Simultaneous Crisis Detection with Advisory Board
1. Pipeline trigger → full 7-node pipeline runs
2. **Fusion**: Full 5-source fusion — scores mention_velocity, sensor thresholds, contradictions
3. **Analyst (LLM)**: Classifies 4 events:
   - G-10 Urban Flood: severity=Critical, population~45K, duration~4h
   - F-8 Heatwave: severity=High, population~52K, duration~48h
   - I-9 Accident: severity=Low, minimal resources
   - G-13 Power Flicker: severity=Low, acknowledged but deprioritized
4. **Advisory Board** (3 LLM calls):
   - 📢 **Field Commander**: "Deploy maximum resources to G-10 immediately"
   - ⚖️ **Logistics Director**: "Warning: depleting all rescue teams leaves other sectors unprotected"
   - ✅ **Synthesizer**: Resolves debate → allocates with locked Priority Scores
5. **Execution**: Simulates rerouting, hospital prep, dispatch — with before/after state and side effects
6. **Notification**: Sends 6 tailored messages per crisis (public, hospitals, police, utility, transport, media)
7. **Verifier**: No field reports → confirms crises active → graph ends normally

### Cycle 2 — False-Positive Detection & Rollback
1. Judge clicks "Inject WASA Field Report" → auto-triggers `_verify_only()` (bypasses cooldown)
2. **Verifier** receives the contradictory field report → LLM confirms false positive for G-10 Flood
3. **Rollback** parses resource strings → frees inventory counts
4. G-10 Flood disappears from the dashboard, timers stop immediately
5. F-8 Heatwave remains active with its resources

### Cycle 3 — Post-Rollback Crisis (Gas Leak at Blue Area)
1. After rollback, new signals emerge: gas concentration sensor spikes at Blue Area, social media velocity rises to 19
2. Pipeline auto-triggers on the new spike
3. Advisory Board debates allocation of **freed resources** to the gas leak crisis
4. Full lifecycle demonstrated: detect → rollback → reallocate

### Resource Auto-Free (TTL Lifecycle)
1. **ResourceMonitor** checks every 5 seconds for expired allocations
2. When `current_time > release_at`: allocation released, inventory incremented, pipeline re-triggered
3. Dashboard shows countdown timers ticking down → "✓ Released" when freed

### Robustness Demo
1. Click "Simulate API Outage" → Weather + Traffic APIs return 503
2. Agents fall back to `_cache` with logged warning: `[FALLBACK] weather failed, using cache`
3. Click "Restore APIs" → APIs resume live data

---

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/social` | GET | Social media signal stream (spike detection triggers pipeline) |
| `/api/weather` | GET | Weather alerts (503 during simulated outage) |
| `/api/traffic` | GET | Traffic data (503 during simulated outage) |
| `/api/emergency_calls` | GET | Emergency call logs |
| `/api/sensors` | GET | IoT sensor stream (spike detection triggers pipeline) |
| `/api/dashboard` | GET | Aggregated endpoint for apps (includes allocations & events) |
| `/api/field_reports` | GET / POST | Field reports (auto-triggers verification-only pipeline) |
| `/api/active_crises` | GET / POST / PUT / DELETE | Crisis lifecycle (DELETE also releases allocations) |
| `/api/resources` | GET / PUT | Resource inventory (decrements & increments) |
| `/api/resource_allocations` | GET / POST | TTL-tracked resource allocations |
| `/api/pipeline_events` | GET | Event-driven pipeline trigger log |
| `/api/trigger_pipeline` | POST | Manually trigger pipeline (for demo) |
| `/api/notifications` | GET / POST | Stakeholder messages (6 audiences) |
| `/api/impact_simulations` | GET / POST | Before/after impact simulations |
| `/api/agent_traces` | GET / POST | ReACT reasoning trace logs |
| `/api/system_status` | GET / PUT | Active agent + phase for live UI |
| `/api/trigger_outage` | POST | Simulate weather/traffic API failure |
| `/api/clear_outage` | POST | Restore all APIs |
| `/api/outage_status` | GET | Current outage flags |
| `/api/cache/{source}` | GET | Degraded-mode stale data fallback |
| `/api/health` | GET | Health check |

---

## Setup (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+
- [Groq API key](https://console.groq.com/) (free tier works)
- Google Maps API key (for live ETAs — optional, defaults to 15 min)

### Environment Variables

Create a file named `.env` inside the `backend/` directory:
```env
GROQ_API_KEY=gsk_...
GOOGLE_MAPS_API_KEY=AIza...   # optional — falls back to 15 min ETA
```

### Running Locally

#### 1. Backend API Server
```bash
cd backend
python -m venv venv
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### 2. Web Dashboard (Vite + React)
```bash
cd web_app
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

#### 3. Mobile App (Expo / React Native)
```bash
cd mobile_app
npm install
npx expo start
```
* **Physical Device**: Download the **Expo Go** app and scan the QR code.
* **Important**: Update `mobile_app/src/constants/api.ts` with your local IP for physical device testing.

---

## Baseline Comparison

| Capability | Traditional Rule-Based | CIRO (LangGraph + LLM) |
|---|---|---|
| Signal fusion | Manual analyst reviews each source | Automated LLM cross-referencing with credibility scores |
| Crisis classification | Keyword rules, single source | Multi-source LLM reasoning with confidence, population, radius, duration, spread risk |
| Resource allocation | Fixed dispatch tables | **Advisory Board** (3 sub-agent debate) + locked **Priority Score Matrix** |
| Decision-making | Single operator judgment | **Cognitive Friction**: Field Commander ↔ Logistics Director → Synthesizer |
| Resource lifecycle | Indefinite allocation, manual release | **TTL-based auto-free** with pipeline re-trigger |
| Pipeline trigger | Fixed polling interval (wasteful) | **Event-driven spike detection** (efficient) |
| False positive handling | Hours-long review cycle | Automated field-report contradiction detection + verification-only path |
| Resource recovery | Manual re-dispatch | **Automatic rollback via conditional graph node** |
| Robustness | Full failure on API downtime | Cache fallback with degraded-mode warnings |

---

## Privacy & Safety Note

- **Synthetic Mock Data:** All inputs used by CIRO are entirely synthetic mock data representing public safety events in Islamabad, Pakistan.
- **No PII:** No personally identifiable information (PII) is captured, stored, or processed by the system.
- **Safety Boundary:** CIRO is a decision-support advisory system prototype; final emergency dispatch authorization and human-in-the-loop overrides remain mandatory.
