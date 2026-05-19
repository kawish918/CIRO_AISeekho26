# 🛰️ CIRO – Crisis Intelligence & Response Orchestrator

> **AISeekho Hackathon · Challenge 3** — Agentic multi-source crisis detection, resource allocation, impact simulation, and adaptive false-positive recovery for Islamabad, Pakistan.

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
          │  • Spike detection in    │              │  • Checks every 30s      │
          │    signal endpoints      │              │  • Auto-frees expired    │
          │  • Social velocity > 15  │              │    resource allocations  │
          │  • Sensor threshold      │              │  • Triggers re-evaluation│
          │    exceeded (Critical)   │              │    on resource freed     │
          └────────────┬─────────────┘              └──────────────────────────┘
                       │
                       ▼
          ┌──────────────────────────────┐
          │  MasterOrchestrator          │
          │  (agents.py)                 │
          │  └─► LangGraph Pipeline      │
          │       (7 nodes, conditional) │
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
  │                                                  │           │
  │                          ┌───────────────────────▼────────┐ │
  │                          │  _check_and_trigger_spike()    │ │
  │                          │  • 30s cooldown between fires  │ │
  │                          │  • Logs PipelineEvent to API   │ │
  │                          │  • Spawns background thread    │ │
  │                          └───────────────────────┬────────┘ │
  │                                                  │           │
  │                          ┌───────────────────────▼────────┐ │
  │                          │  run_pipeline_once()            │ │
  │                          │  → Full 7-agent LangGraph run   │ │
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
  │ 2. Crisis Analyst  │  ← Classifies type, severity, population, radius,
  │  🧠 AnalystAgent   │    duration, spread risk, uncertainty range
  └─────────┬──────────┘
            ▼
  ┌────────────────────┐
  │ 3. Resource Cmd.   │  ← Priority Score Matrix + live Google Maps ETA
  │  ⚡ Commander      │    Score = Severity × Population ÷ ETA_minutes
  └─────────┬──────────┘
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
     │   Routing    │  NO → END                                        │
     └─────────────┘                                                   │ YES
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

## Priority Score Matrix

The Resource Commander doesn't guess — it uses a **mathematical Priority Score** to justify allocation:

```
  Priority Score = Severity_Multiplier × Affected_Population ÷ Google_Maps_ETA_minutes
```

| Severity | Multiplier |
|---|---|
| Critical | 4 |
| High | 3 |
| Medium | 2 |
| Low | 1 |

**Example**: A Critical flood (×4) affecting 500 people with a 10-minute ETA = Score of **200**. A Medium accident (×2) affecting 50 people with a 5-minute ETA = Score of **20**. The LLM then mathematically justifies assigning ambulances to the flood first, referencing the exact scores in its reasoning.

---

## Resource Lifecycle & TTL Callbacks

Resources aren't just allocated — they have a **Time-To-Live (TTL)** and are automatically freed when the crisis duration expires.

```
  ┌───────────────────────────────────────────────────────────┐
  │              RESOURCE LIFECYCLE                           │
  │                                                           │
  │   Commander allocates:                                    │
  │   "3 Ambulances" → G-10 Flood                           │
  │   allocated_at: 14:30:00                                 │
  │   release_at:   14:34:00  (TTL = duration × 2 min)      │
  │   status: "active"                                       │
  │                                                           │
  │   ResourceMonitor (every 30s):                           │
  │   ┌──────────────────────────────────────────┐           │
  │   │  if current_time > release_at:           │           │
  │   │    → increment inventory                 │           │
  │   │    → status = "released"                 │           │
  │   │    → post AgentTrace                     │           │
  │   │    → trigger pipeline re-evaluation      │           │
  │   └──────────────────────────────────────────┘           │
  └───────────────────────────────────────────────────────────┘
```

The mobile app shows live countdown timers for each allocation, and "✓ Released" when resources auto-free.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **LLM Reasoning** | Groq API · Llama 3.3 70B | All 7 agent nodes use structured LLM output |
| **Agent Orchestration** | LangGraph (`StateGraph`) | Conditional graph with `false_positive_ids` routing |
| **Backend API** | FastAPI + Pydantic v2 | Signal streams, CRUD, event-driven triggers, TTL monitor |
| **Mobile App** | React Native · Expo SDK 55 | 3 tabs: Dashboard, Map, Agent Log (Light Theme) |
| **Geospatial Intel** | Google Maps Distance Matrix API | Live travel ETAs for Priority Score calculation |
| **Map Rendering** | Leaflet.js via WebView | CartoDB Positron light tiles with accurate GPS markers |
| **Resource Lifecycle** | FastAPI Background Tasks | TTL-based auto-free with pipeline re-trigger |

---

## Google Antigravity Integration

This project was **fully orchestrated by Google Antigravity (AI coding assistant)**, which acted as the senior architect throughout every phase:

| Phase | Antigravity Role |
|---|---|
| **Architecture** | Designed the 7-node conditional LangGraph pipeline, event-driven spike detection, and TTL resource lifecycle |
| **Code Generation** | Generated all agent nodes, Pydantic schemas, FastAPI endpoints, React Native screens |
| **Priority Matrix** | Implemented the mathematical Priority Score formula injected into the Commander LLM prompt |
| **Resource Lifecycle** | Designed TTL-based resource allocation with auto-free monitor and pipeline re-trigger |
| **Event-Driven Design** | Replaced polling with spike-detection triggers in signal endpoints |
| **Geospatial Intel** | Implemented Google Distance Matrix API integration for accurate Priority Scores |
| **Robustness** | Designed `_outage_mode` flag system with degraded-mode cache fallback |
| **Testing** | Generated 13 automated tests covering all schemas, CRUD endpoints, helpers, and fallback behavior |
| **UI/UX** | Redesigned mobile app with priority score badges, TTL countdown timers, and event-driven trigger indicators |

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
| `/api/field_reports` | GET / POST | Field verification reports (trigger Verifier) |
| `/api/active_crises` | GET / POST / PUT / DELETE | Crisis lifecycle management |
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

Create `backend/.env`:
```env
GROQ_API_KEY=gsk_...
GOOGLE_MAPS_API_KEY=AIza...   # optional — falls back to 15 min ETA
```

### Running Locally

```bash
# 1. Backend API server (includes ResourceMonitor background task)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 2. Master Orchestrator — standalone mode (separate terminal)
#    OR: The pipeline is also triggered event-driven when signal endpoints detect spikes
cd backend
python agents.py
# Starts MasterOrchestrator: polls signals every 5s,
# dispatches full 7-agent pipeline only when anomalies detected

# 3. Mobile app
cd mobile_app
npm install
npx expo start
# Scan QR with Expo Go app
```

> For distribution: update `API` in `mobile_app/src/constants/api.ts` with your local IP (run `ipconfig` → IPv4 Address).

---

## Scenario Walkthrough

### Startup — Event-Driven Detection
- `uvicorn main:app` starts the FastAPI server with the **ResourceMonitor** background task
- Signal endpoints (`/api/social`, `/api/sensors`) include spike detection
- When mention_velocity > 15 or sensor threshold exceeded with Critical severity → **event fires**
- `_check_and_trigger_spike()` logs a `PipelineEvent` and spawns `run_pipeline_once()` in a background thread

### Dispatch 1 — Simultaneous Crisis Detection with Priority Scoring
1. Social spike detected: G-10 mention_velocity=23 → triggers pipeline
2. **Fusion**: Full 5-source fusion — scores mention_velocity, sensor thresholds, contradictions
3. **Analyst**: Classifies 2 crises (G-10 Urban Flood, F-8 Heatwave) with severity, population, radius, duration
4. **Commander**: Computes **Priority Score** for each crisis:
   - G-10 Flood: `4 × 45000 ÷ 12 = 15,000` (Critical severity, large population, 12-min ETA)
   - F-8 Heatwave: `3 × 52000 ÷ 18 = 8,667` (High severity, 18-min ETA)
   - G-10 gets resources **first** — mathematically justified
5. **Commander**: Posts `ResourceAllocation` with TTL (release_at = now + duration × 2 minutes)
6. **Execution**: Simulates rerouting, hospital prep, dispatch — with before/after state and side effects
7. **Notification**: Sends 6 tailored messages (public, hospitals, police, utility, transport, media)
8. **Verifier**: No field reports yet → confirms crises active → graph ends normally

### Resource Auto-Free (TTL Lifecycle)
1. **ResourceMonitor** checks every 30 seconds for expired allocations
2. When `current_time > release_at`:
   - Allocation status → "released"
   - Inventory incremented (e.g., 3 Ambulances returned)
   - AgentTrace posted: "ResourceMonitor — auto-freed 3 ambulances"
   - Pipeline re-triggered: "Resources freed — re-evaluating pending crises"
3. Mobile app shows countdown timers ticking down → "✓ Released" when freed

### Dispatch 2 — False Positive Recovery
1. After Cycle 1, a contradictory field report is auto-injected: *"No flooding — broken water main only"*
2. **Verifier** LLM detects contradiction → `is_false_positive: true`
3. Retraction notification sent to all audiences
4. **Conditional edge fires** → routes to **Rollback** node
5. Rollback parses resource strings → increments inventory counts
6. Resources freed, system adapted — true agentic recovery demonstrated

### Continuous Monitoring
- 30-second cooldown between pipeline dispatches prevents thrashing
- Status visible in real-time on mobile **Agent Log** tab
- Priority Scores visible on **Dashboard** event cards

### Robustness Demo
1. POST to `/api/trigger_outage` → Weather + Traffic APIs return 503
2. Agents fall back to `_cache` with logged warning: `[FALLBACK] weather failed, using cache`
3. POST to `/api/clear_outage` → APIs resume live data

---

## Baseline Comparison

| Capability | Traditional Rule-Based | CIRO (LangGraph + LLM) |
|---|---|---|
| Signal fusion | Manual analyst reviews each source | Automated LLM cross-referencing with credibility scores |
| Crisis classification | Keyword rules, single source | Multi-source reasoning with confidence + uncertainty range |
| Resource allocation | Fixed dispatch tables | **Priority Score Matrix** (Severity × Population ÷ ETA) with live Google Maps |
| Multi-crisis coordination | Sequential, one at a time | Parallel prioritization with mathematical trade-off reasoning |
| Resource lifecycle | Indefinite allocation, manual release | **TTL-based auto-free** with pipeline re-trigger |
| Pipeline trigger | Fixed polling interval (wasteful) | **Event-driven spike detection** (efficient) |
| False positive handling | Hours-long review cycle | Automated field-report contradiction detection + retraction |
| Resource recovery | Manual re-dispatch after false alarm | **Automatic rollback via conditional graph node** |
| Stakeholder comms | Generic broadcast | 6 tailored audience messages per crisis per LLM |
| Robustness | Full failure on API downtime | Cache fallback with logged degraded-mode warnings |

---

## Assumptions & Limitations

- All signal data is **synthetic mock data** — clearly labelled, no PII
- Resource inventory resets when FastAPI server restarts
- Maps rendered via **OpenStreetMap / CartoDB** (Google Maps tiles require native EAS build)
- Location coordinate lookup is fuzzy-matched from a static Islamabad sector dictionary
- LLM reasoning quality depends on Groq API availability and rate limits
- TTL durations are accelerated for demo purposes (hours → minutes)

---

## Cost & Scalability

| Metric | Current (Local) | 10× Scale | 100× Scale |
|---|---|---|---|
| **LLM cost** | ~$0.001/cycle (Groq free tier) | ~$0.01/cycle | Switch to Vertex AI batching |
| **API latency** | 2–5s per full pipeline | Same (LLM bottleneck) | Parallel node execution |
| **Storage** | In-memory | Redis/Postgres handles 1M+ docs | DB auto-scales |
| **Mobile** | Expo Go / APK (local IP) | APK + hosted backend | CDN + load balancer |
| **Agents** | 7 nodes, 1 graph instance | Multiple graph workers | LangGraph Cloud / Ray |
| **TTL Monitor** | FastAPI asyncio task | Celery beat / Redis TTL | Distributed task queue |
| **Event triggers** | Thread-based | Message queue (Redis pub/sub) | Kafka / Cloud Pub/Sub |
