# 🛰️ CIRO – Crisis Intelligence & Response Orchestrator

> **AISeekho Hackathon · Challenge 3** — Agentic multi-source crisis detection, resource allocation, impact simulation, and adaptive false-positive recovery for Islamabad, Pakistan.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                         CIRO System Architecture                        │
└────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐    REST/JSON    ┌──────────────────────┐
  │  Expo Mobile  │◄──────────────►│   FastAPI Backend     │
  │  (3 screens)  │                │   (Port 8000)         │
  └──────────────┘                └──────────┬───────────┘
                                             │ HTTP Poll
                                             ▼
                                   ┌──────────────────────┐
                                   │  LangGraph Pipeline  │
                                   │  (agents.py)         │
                                   └──────────────────────┘
```

---

## LangGraph Agent Pipeline (7 Nodes, Conditional Routing)

```
  ┌─────────────┐
  │  CYCLE START │
  └──────┬──────┘
         │
         ▼
  ┌────────────────────┐
  │ 1. Fusion & Triage │  ← Polls 5 signal streams (Social, Weather, Traffic, Calls, Sensors)
  │  📡 FusionAgent    │    LLM cross-references, scores credibility, flags contradictions
  └─────────┬──────────┘
            │
            ▼
  ┌────────────────────┐
  │ 2. Crisis Analyst  │  ← LLM classifies type (flood/heatwave/…), severity,
  │  🧠 AnalystAgent   │    affected pop., radius, duration, spread risk
  └─────────┬──────────┘
            │
            ▼
  ┌────────────────────┐
  │ 3. Resource Cmd.   │  ← Allocates constrained resources using live Google
  │  ⚡ Commander      │    Maps ETA (Distance Matrix API), shows trade-offs
  └─────────┬──────────┘
            │
            ▼
  ┌────────────────────┐
  │ 4. Execution       │  ← LLM simulates response actions: before/after state,
  │  🎯 ExecutionAgent │    congestion impact, resource cost, side effects
  └─────────┬──────────┘
            │
            ▼
  ┌────────────────────┐
  │ 5. Notification    │  ← Generates tailored messages for 6 stakeholder
  │  📨 NotifAgent     │    audiences (public, hospitals, police, media…)
  └─────────┬──────────┘
            │
            ▼
  ┌────────────────────┐
  │ 6. Verifier        │  ← Reads field reports. Detects contradictions via LLM.
  │  🔎 VerifierAgent  │    Issues retraction if false positive found.
  └─────────┬──────────┘
            │
     ┌──────▼──────┐  false_positive_ids present?
     │  Conditional │─────────────────────────────────────────────────┐
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

> **Key innovation**: The graph is **not a static DAG**. Node 6 (Verifier) uses a `conditional_edge` routing function — if a false positive is detected, the graph dynamically routes to Node 7 (Rollback) which de-allocates resources before terminating. This is evidence of true `observe → reason → decide → act → adapt` behavior.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **LLM Reasoning** | Groq API · Llama 3.3 70B | All 7 agent nodes use structured LLM output |
| **Agent Orchestration** | LangGraph (`StateGraph`) | Conditional graph with `false_positive_ids` routing |
| **Backend API** | FastAPI + Pydantic v2 | Signal streams, CRUD, degraded-mode endpoints, Dashboard |
| **Mobile App** | React Native · Expo SDK 55 | 3 tabs: Dashboard, Map, Agent Log (Light Theme) |
| **Geospatial Intel** | Google Maps Distance Matrix API | Live travel ETAs injected into Commander prompt |
| **Map Rendering** | Leaflet.js via WebView | CartoDB Positron light tiles with accurate GPS markers |

---

## Google Antigravity Integration

This project was **fully orchestrated by Google Antigravity (AI coding assistant)**, which acted as the senior architect throughout every phase:

| Phase | Antigravity Role |
|---|---|
| **Architecture** | Designed the 7-node conditional LangGraph pipeline, identified that a linear DAG is insufficient for true adaptability |
| **Code Generation** | Generated all agent nodes, Pydantic schemas, FastAPI endpoints, React Native screens |
| **Geospatial Intel** | Implemented Google Distance Matrix API integration in Resource Commander and accurate GPS mapping |
| **Innovation Design** | Identified the `Rollback` node gap and implemented adaptive resource de-allocation on false positive |
| **Robustness** | Designed `_outage_mode` flag system with `/api/trigger_outage` for demonstrable degraded-mode recovery |
| **Testing** | Generated 13 automated tests covering all schemas, CRUD endpoints, helpers, and fallback behavior |
| **UI/UX Redesign** | Completely redesigned the mobile app to a minimalist light theme with drill-down navigation |

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
                    lat, lng, timestamp

AgentTrace (ReACT): id, agent_name, step, observation, reasoning,
                    decision, action, outcome, timestamp

ImpactSimulation:   id, crisis_id, before_state, response_action,
                    expected_after_state, response_time_improvement,
                    congestion_impact, resource_cost, possible_side_effects[]
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/social` | GET | Social media signal stream (with mention_velocity) |
| `/api/weather` | GET | Weather alerts (503 during simulated outage) |
| `/api/traffic` | GET | Traffic data (503 during simulated outage) |
| `/api/emergency_calls` | GET | Emergency call logs |
| `/api/sensors` | GET | IoT sensor stream (water level, temperature) |
| `/api/dashboard` | GET | Aggregated endpoint for the mobile app home screen |
| `/api/field_reports` | GET / POST | Field verification reports (trigger Verifier) |
| `/api/active_crises` | GET / POST / PUT / DELETE | Crisis lifecycle management |
| `/api/resources` | GET / PUT | Resource inventory (decrements & increments) |
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
# 1. Backend API server
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 2. Agent pipeline (separate terminal)
cd backend
python agents.py

# 3. Mobile app
cd mobile_app
npm install
npx expo start
# Scan QR with Expo Go app
```

> For distribution: update `API` constant in `mobile_app/src/constants/api.ts` with your local IP or hosted backend URL before running.

---

## Scenario Walkthrough

### Cycle 1 — Simultaneous Crisis Detection
1. Fusion agent ingests data from 5 sources: social posts, weather alerts, traffic readings, emergency calls, and IoT sensors.
2. LLM cross-references: G-10 has social + heavy rain + congestion + high water-level sensor → high confidence flood
3. Analyst classifies 2 crises (G-10 Flood, F-8 Heatwave) with severity, population, radius, duration
4. Commander fetches live ETA from PIMS Hospital to G-10 via Google Maps API (e.g. "12 mins") → injects into LLM prompt
5. Resources allocated: Ambulances, Rescue Teams, Field Teams based on constrained inventory
6. Execution simulates rerouting, hospital prep, public alert
7. Notifications sent to 6 audiences (public, hospitals, police, media...)
8. Verifier: no field reports yet → confirms crises active

### Cycle 2 — False Positive Recovery (Adaptation)
1. Field report injected: "No flooding in G-10 — broken water main only, water receding"
2. Verifier LLM compares field report vs. original crisis → `is_false_positive: true`
3. Retraction notification sent to public
4. **Conditional edge fires** → Graph routes to `Rollback` node
5. Rollback parses `"3 Ambulances"`, `"2 Rescue Teams"` → increments inventory
6. Resources freed, inventory updated, system fully adapted

### Robustness Demo (During Demo Video)
1. Call `/api/trigger_outage`
2. Weather + Traffic APIs return 503 → agents fall back to `_cache`
3. Trace log shows: `[FALLBACK] weather failed, using cache`
4. Call `/api/clear_outage` → APIs resume live data

---

## Baseline Comparison

| Capability | Traditional Rule-Based | CIRO (LangGraph + LLM) |
|---|---|---|
| Signal fusion | Manual analyst reviews each source | Automated LLM cross-referencing with credibility scores |
| Crisis classification | Keyword rules, single source | Multi-source reasoning with confidence + uncertainty range |
| Resource allocation | Fixed dispatch tables | Constrained optimization with **live Google Maps ETAs** |
| Multi-crisis coordination | Sequential, one at a time | Parallel prioritization with trade-off reasoning |
| False positive handling | Hours-long review cycle | Automated field-report contradiction detection + retraction |
| Resource recovery | Manual re-dispatch after false alarm | **Automatic rollback via conditional graph node** |
| Stakeholder comms | Generic broadcast | 6 tailored audience messages per crisis per LLM |
| Robustness | Full failure on API downtime | Cache fallback with logged degraded-mode warnings |

---

## Assumptions & Limitations

- All signal data is **synthetic mock data** — clearly labelled, no PII
- Resource inventory resets when FastAPI server restarts
- Maps rendered via **OpenStreetMap / CartoDB** (Google Maps tiles require native EAS build, not compatible with simple Expo Go testing)
- Location coordinate lookup is fuzzy-matched from a static Islamabad sector dictionary to ensure accurate GPS markers
- LLM reasoning quality depends on Groq API availability and rate limits

---

## Cost & Scalability

| Metric | Current (Local) | 10× Scale | 100× Scale |
|---|---|---|---|
| **LLM cost** | ~$0.001/cycle (Groq free tier) | ~$0.01/cycle | Switch to Vertex AI batching |
| **API latency** | 2–5s per full pipeline | Same (LLM bottleneck) | Parallel node execution |
| **Storage** | In-memory | Redis/Postgres handles 1M+ docs | DB auto-scales |
| **Mobile** | Expo Go / APK (local IP) | APK + hosted backend | CDN + load balancer |
| **Agents** | 7 nodes, 1 graph instance | Multiple graph workers | LangGraph Cloud / Ray |
