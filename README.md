# 🛰️ CIRO – Crisis Intelligence & Response Orchestrator

> **AISeekho Hackathon · Challenge 3** — Agentic multi-source crisis detection, resource allocation with cognitive friction, impact simulation, and adaptive false-positive recovery for Islamabad, Pakistan.

---

## Architecture Overview

```
  ┌──────────────┐    REST/JSON    ┌──────────────────────┐
  │  Expo Mobile  │◄──────────────►│   FastAPI Backend     │
  │  (3 screens)  │                │   (Port 8000)         │
  └──────────────┘                └──────────┬───────────┘
                                             │
                      ┌──────────────────────┴──────────────────────┐
                      │                                             │
                      ▼                                             ▼
          ┌──────────────────────────┐              ┌──────────────────────────┐
          │  EVENT-DRIVEN TRIGGER    │              │  ResourceMonitor (TTL)   │
          │  • Spike detection in    │              │  • Checks every 5s       │
          │    signal endpoints      │              │  • Auto-frees expired    │
          │  • Social velocity > 15  │              │    resource allocations  │
          │  • Sensor threshold      │              │  • Triggers re-evaluation│
          │    exceeded (Critical)   │              │    on resource freed     │
          │  • Field report →        │              └──────────────────────────┘
          │    Verification-only path│
          └────────────┬─────────────┘
                       │
                       ▼
          ┌──────────────────────────────┐
          │  MasterOrchestrator          │
          │  (agents.py)                 │
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

### Pipeline Concurrency

When a pipeline is running (either full or verification-only), the **30-second cooldown** prevents overlapping triggers. If a new spike arrives mid-pipeline, it is **deferred** until the cooldown expires. Field reports bypass this cooldown to allow immediate verification, but they only invoke the lightweight 2-node verification path (Verifier + Rollback), not the full 7-node pipeline.

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

### Verification-Only Path (Field Report Triggers)

When a field report is posted, the pipeline bypasses the full 7-node path and runs **only** Verifier + Rollback. This prevents re-detection and re-allocation of resources to crises that are about to be retracted.

```
  POST /api/field_reports
       │
       ▼ (cooldown bypassed)
  _verify_only()
       │
       ├─► Verifier Node ─── false positive? ── YES ──► Rollback Node
       │                                                      │
       └──── NO ──► End                                       ▼ End
```

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

The full debate transcript is persisted in the Agent Trace logs, visible in the mobile app's Agent Log tab. Judges can read the AI arguing with itself before reaching consensus.

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

The Resource Commander doesn't guess — it uses a **mathematical Priority Score** to justify allocation:

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

The Priority Score is **locked** — computed in Python before any LLM call and enforced after the Synthesizer returns. The LLM's output is overwritten with our deterministic value.

---

## Resource Lifecycle & TTL Callbacks

Resources aren't just allocated — they have a **Time-To-Live (TTL)** and are automatically freed when the crisis duration expires.

```
  ┌───────────────────────────────────────────────────────────┐
  │              RESOURCE LIFECYCLE                           │
  │                                                           │
  │   Advisory Board allocates:                               │
  │   "3 Ambulances" → G-10 Flood                           │
  │   allocated_at: 14:30:00                                 │
  │   release_at:   14:31:00  (TTL = duration × 0.25 min)   │
  │   status: "active"                                       │
  │                                                           │
  │   ResourceMonitor (every 5s):                            │
  │   ┌──────────────────────────────────────────┐           │
  │   │  if current_time > release_at:           │           │
  │   │    → increment inventory                 │           │
  │   │    → status = "released"                 │           │
  │   │    → post AgentTrace                     │           │
  │   │    → trigger pipeline re-evaluation      │           │
  │   └──────────────────────────────────────────┘           │
  │                                                           │
  │   On crisis deletion (DELETE /api/active_crises):        │
  │   → All associated allocations marked "released"         │
  │   → Timers stop immediately in mobile app                │
  └───────────────────────────────────────────────────────────┘
```

The mobile app shows live countdown timers for each allocation, and "✓ Released" when resources auto-free.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **LLM Reasoning** | Groq API · Llama 3.3 70B | All agent nodes use structured LLM output |
| **Agent Orchestration** | LangGraph (`StateGraph`) | Conditional graph with `false_positive_ids` routing |
| **Cognitive Friction** | 3 sub-agent Advisory Board | Field Commander ↔ Logistics Director → Synthesizer |
| **Backend API** | FastAPI + Pydantic v2 | Signal streams, CRUD, event-driven triggers, TTL monitor |
| **Mobile App** | React Native · Expo SDK 55 | 3 tabs: Dashboard, Map (full-screen Leaflet), Agent Log |
| **Geospatial Intel** | Google Maps Distance Matrix API | Live travel ETAs for Priority Score calculation |
| **Map Rendering** | Leaflet.js via WebView | CartoDB Positron tiles with GPS markers (flex layout) |
| **Resource Lifecycle** | FastAPI Background Tasks | TTL-based auto-free with pipeline re-trigger (5s check) |

---

## Google Antigravity Integration

This project was **fully orchestrated by Google Antigravity (AI coding assistant)**, which acted as the senior architect throughout every phase:

| Phase | Antigravity Role |
|---|---|
| **Architecture** | Designed the 7-node conditional LangGraph pipeline, event-driven spike detection, and TTL resource lifecycle |
| **Advisory Board** | Designed the 3 sub-agent cognitive friction loop (Field Commander ↔ Logistics Director → Synthesizer) |
| **Code Generation** | Generated all agent nodes, Pydantic schemas, FastAPI endpoints, React Native screens |
| **Priority Matrix** | Implemented the mathematical Priority Score formula with locked deterministic values |
| **Resource Lifecycle** | Designed TTL-based resource allocation with auto-free monitor and pipeline re-trigger |
| **Verification Path** | Built the verification-only routing (field reports skip Fusion/Analyst/Commander) |
| **Event-Driven Design** | Replaced polling with spike-detection triggers in signal endpoints |
| **Geospatial Intel** | Implemented Google Distance Matrix API integration for accurate Priority Scores |
| **Robustness** | Designed `_outage_mode` flag system with degraded-mode cache fallback |
| **Testing** | Generated 22 automated tests covering all schemas, CRUD endpoints, helpers, and fallback behavior |
| **UI/UX** | Redesigned mobile app with priority score badges, TTL countdown timers, and full-screen Leaflet map |

Antigravity trace artifacts (workplan, task plans, reasoning logs) are available in the project's `.gemini/` directory.

---

## Data Stream Schemas

### Signal Sources (5 sources ingested each cycle)

```python
SocialSignal:       id, timestamp, location, text, credibility_score,
                    geolocation_confidence, urgency_score, mention_velocity,
                    contradiction_level, source_type

WeatherSignal:      id, timestamp, alert_type, severity, affected_zones[],
                    temperature_c, humidity_pct, wind_speed_kmh

TrafficSignal:      id, timestamp, route_name, congestion_level,
                    average_speed, incident_reported

EmergencyCall:      id, timestamp, location, call_type, description, frequency

MockSensor:         id, timestamp, sensor_type, location, value, unit,
                    threshold_exceeded, severity, incident_reported
```

### Agent Outputs

```python
ActiveCrisis:       id, title, description, crisis_type, severity, confidence,
                    location, status, affected_population, expected_duration_hours,
                    affected_radius_km, peak_impact_time, spread_risk,
                    uncertainty_range, likely_evolution, resources_allocated[],
                    priority_score, lat, lng, timestamp

AgentTrace (ReACT): id, agent_name, step, observation, reasoning,
                    decision, action, outcome, timestamp

ImpactSimulation:   id, crisis_id, before_state, response_action,
                    expected_after_state, response_time_improvement,
                    congestion_impact, resource_cost, possible_side_effects[]

ResourceAllocation: id, crisis_id, crisis_title, resource_type, quantity,
                    allocated_at, release_at, status ("active" | "released")

PipelineEvent:      id, trigger_source, trigger_detail, timestamp
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/social` | GET | Social media signal stream (spike detection triggers pipeline) |
| `/api/weather` | GET | Weather alerts (503 during simulated outage) |
| `/api/traffic` | GET | Traffic data (503 during simulated outage) |
| `/api/emergency_calls` | GET | Emergency call logs |
| `/api/sensors` | GET | IoT sensor stream (spike detection triggers pipeline) |
| `/api/dashboard` | GET | Aggregated endpoint for mobile app (includes allocations & events) |
| `/api/field_reports` | GET / POST | Field verification reports (auto-triggers verification-only pipeline) |
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

## Setup

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

#### 1. Backend API Server & Agent Orchestrator
Open a terminal in the root directory:
```bash
# Navigate to backend folder
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment:
# On Windows (Command Prompt):
venv\Scripts\activate.bat
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server (includes ResourceMonitor background task)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### 2. Web App Dashboard (Vite + React)
Open a new terminal in the root directory:
```bash
# Navigate to web_app folder
cd web_app

# Install dependencies
npm install

# Start the development server
npm run dev
```
Open `http://localhost:5173` in your browser.

#### 3. Mobile App (Expo / React Native)
Open a new terminal in the root directory:
```bash
# Navigate to mobile_app folder
cd mobile_app

# Install dependencies
npm install

# Start Expo
npx expo start
```
* **Simulators**: Press `i` for the iOS simulator or `a` for the Android emulator.
* **Physical Device**: Download the **Expo Go** app from the App Store/Google Play Store and scan the QR code displayed in your terminal.
* **Important**: If running on a physical phone, update the `API` endpoint in `mobile_app/src/constants/api.ts` to your computer's local IP address (e.g., `http://192.168.1.XX:8000/api`) instead of `localhost`.

#### 4. Triggering a Demo Spike (Optional)
If you want to manually trigger the pipeline for a demo, open a new terminal and run:
```bash
curl -X POST http://localhost:8000/api/trigger_pipeline
```

---

## Scenario Walkthrough

### Startup — Event-Driven Detection
- `uvicorn main:app` starts the FastAPI server with the **ResourceMonitor** background task (checks every 5s)
- Signal endpoints (`/api/social`, `/api/sensors`) include spike detection
- When mention_velocity > 15 or sensor threshold exceeded with Critical severity → **event fires**
- `_check_and_trigger_spike()` logs a `PipelineEvent` and spawns `run_pipeline_once()` in a background thread

### Cycle 1 — Simultaneous Crisis Detection with Advisory Board
1. Manual trigger or social spike detected → triggers full pipeline
2. **Fusion**: Full 5-source fusion — scores mention_velocity, sensor thresholds, contradictions
3. **Analyst (LLM)**: Classifies 2 crises with LLM-determined confidence, population, radius, duration, and spread risk:
   - G-10 Urban Flood: severity=Critical, population~45K, duration~4h, radius~2km
   - F-8 Heatwave: severity=High, population~52K, duration~48h, radius~5km
4. **Advisory Board** (3 LLM calls):
   - 📢 **Field Commander**: "Deploy maximum resources to G-10 immediately — Score 75000 dwarfs heatwave's 43333"
   - ⚖️ **Logistics Director**: "Warning: depleting all rescue teams for G-10 leaves F-7/I-8 unprotected for any new event"
   - ✅ **Synthesizer**: Resolves debate → allocates with locked Priority Scores via Pydantic
5. **Commander** posts `ResourceAllocation` with TTL (`release_at = now + duration × 0.25 min`)
6. **Execution**: Simulates rerouting, hospital prep, dispatch — with before/after state and side effects
7. **Notification**: Sends 6 tailored messages (public, hospitals, police, utility, transport, media)
8. **Verifier**: No field reports yet → confirms crises active → graph ends normally
9. **False positive injection**: 2 seconds after Cycle 1, a WASA field report is auto-injected

### Cycle 2 — Autonomous Verification & Rollback
1. `POST /api/field_reports` auto-triggers `_verify_only()` (bypasses cooldown)
2. **Verifier** receives the contradictory field report → LLM confirms false positive
3. **Rollback** parses resource strings → frees inventory counts
4. `DELETE /api/active_crises/{id}` also releases all associated resource allocations
5. G-10 Flood disappears from the app, timers stop immediately
6. F-8 Heatwave remains active with its resources

### Resource Auto-Free (TTL Lifecycle)
1. **ResourceMonitor** checks every 5 seconds for expired allocations
2. When `current_time > release_at`:
   - Allocation status → "released"
   - Inventory incremented (e.g., 3 Ambulances returned)
   - AgentTrace posted: "ResourceMonitor — auto-freed 3 ambulances"
   - Pipeline re-triggered: "Resources freed — re-evaluating pending crises"
3. Mobile app shows countdown timers ticking down → "✓ Released" when freed

### Robustness Demo
1. POST to `/api/trigger_outage` → Weather + Traffic APIs return 503
2. Agents fall back to `_cache` with logged warning: `[FALLBACK] weather failed, using cache`
3. POST to `/api/clear_outage` → APIs resume live data

---

## Baseline Comparison

| Capability | Traditional Rule-Based | CIRO (LangGraph + LLM) |
|---|---|---|
| Signal fusion | Manual analyst reviews each source | Automated LLM cross-referencing with credibility scores |
| Crisis classification | Keyword rules, single source | Multi-source LLM reasoning with confidence, population, radius, duration, spread risk — all AI-determined |
| Resource allocation | Fixed dispatch tables | **Advisory Board** (3 sub-agent debate) + locked **Priority Score Matrix** with live Google Maps ETA |
| Decision-making | Single operator judgment | **Cognitive Friction**: Field Commander ↔ Logistics Director → Synthesizer |
| Multi-crisis coordination | Sequential, one at a time | Parallel prioritization with mathematical trade-off reasoning |
| Resource lifecycle | Indefinite allocation, manual release | **TTL-based auto-free** with pipeline re-trigger (5s checks) |
| Pipeline trigger | Fixed polling interval (wasteful) | **Event-driven spike detection** (efficient, source-aware routing) |
| False positive handling | Hours-long review cycle | Automated field-report contradiction detection + verification-only path |
| Resource recovery | Manual re-dispatch after false alarm | **Automatic rollback via conditional graph node** + allocation release |
| Stakeholder comms | Generic broadcast | 6 tailored audience messages per crisis per LLM |
| Robustness | Full failure on API downtime | Cache fallback with logged degraded-mode warnings |

---

## Assumptions & Limitations

- All signal data is **synthetic mock data** — clearly labelled, no PII
- Resource inventory resets when FastAPI server restarts
- Maps rendered via **OpenStreetMap / CartoDB** (Google Maps tiles require native EAS build)
- Location coordinate lookup is fuzzy-matched from a static Islamabad sector dictionary
- LLM reasoning quality depends on Groq API availability and rate limits
- TTL durations are accelerated for demo purposes (hours → ~1 minute)
- Crisis classification fields (population, duration, radius, confidence, spread_risk) are **fully LLM-determined** — the prompt provides population hints per sector, but the LLM chooses final values

---

## Cost & Scalability

| Metric | Current (Local) | 10× Scale | 100× Scale |
|---|---|---|---|
| **LLM cost** | ~$0.003/cycle (Groq free tier, 3 Advisory Board calls + 4 node calls) | ~$0.03/cycle | Switch to Vertex AI batching |
| **API latency** | 5–10s per full pipeline (3 extra calls for Advisory Board) | Same (LLM bottleneck) | Parallel node execution |
| **Storage** | In-memory | Redis/Postgres handles 1M+ docs | DB auto-scales |
| **Mobile** | Expo Go / APK (local IP) | APK + hosted backend | CDN + load balancer |
| **Agents** | 7 nodes + 3 sub-agents, 1 graph instance | Multiple graph workers | LangGraph Cloud / Ray |
| **TTL Monitor** | FastAPI asyncio task (5s) | Celery beat / Redis TTL | Distributed task queue |
| **Event triggers** | Thread-based | Message queue (Redis pub/sub) | Kafka / Cloud Pub/Sub |

---

## Privacy & Safety Note

- **Synthetic Mock Data:** All inputs (signals, social posts, sensor readings, emergency calls, field reports) used by CIRO are entirely synthetic mock data representing public safety events in Islamabad, Pakistan.
- **No PII:** No personally identifiable information (PII) is captured, stored, or processed by the system.
- **Safety Boundary:** CIRO is a decision-support advisory system prototype; final emergency dispatch authorization and human-in-the-loop overrides remain mandatory for physical resource mobilization in public safety environments.

