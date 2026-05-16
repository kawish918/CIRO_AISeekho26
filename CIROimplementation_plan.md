# Challenge 3 – Gap Analysis & Implementation Plan

## Current State Summary

| Area | What Exists | What's Missing (per Challenge 3) |
|---|---|---|
| **Signal sources** | Social, Weather, Traffic (3 sources) | Emergency calls / field reports (need ≥3, but richer data per source is missing) |
| **Schemas** | Basic Pydantic models | Missing: `confidence`, `affected_population`, `expected_duration`, `likely_evolution`, `affected_radius`, `peak_impact_time`, `spread_risk`, `uncertainty_range` |
| **Credibility scoring** | Simple `> 0.8` threshold | Missing: geolocation confidence, urgency language scoring, mention velocity, contradiction detection |
| **Crisis classification** | Flood / Traffic keyword match | Missing: heatwave, accident, infrastructure, power outage, protest, disease; no confidence score output |
| **Severity & evolution prediction** | None | Entirely missing: affected radius, population, duration, peak impact, spread risk |
| **Resource allocation** | 5 ambulances + 3 rescue teams | Missing: police units, shelters, generators, water tankers, drones; no urgency/travel-time weighting |
| **Multi-crisis coordination** | Processes list sequentially | Missing: explicit trade-off logging when two crises compete for limited resources |
| **Impact simulation** | None | Entirely missing: before state → action → expected after state, response time improvement, congestion impact, resource cost, side effects |
| **Stakeholder notifications** | None | Entirely missing: tailored messages for public, emergency services, hospitals, utility, transport, media |
| **False positive handling** | Hardcoded F-8 retraction | Missing: field-report-driven contradiction, alert retraction with notification, log update |
| **Robustness / degraded mode** | Basic try/except | Missing: API downtime fallback with cached data, stale-data detection, duplicate dedup |
| **Agent trace/logs** | `print()` statements | Missing: structured JSON trace logs showing reasoning, decisions, tool calls, recovery |
| **Tests** | None | No test suite at all |
| **README** | None | Required: architecture, schemas, Antigravity usage, APIs, assumptions, privacy, cost/latency, scalability, baseline comparison |

---

## Proposed Changes

### Backend – Schemas & API (`backend/main.py`)

#### [MODIFY] [main.py](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/backend/main.py)

1. **Enrich `ActiveCrisis` schema** with all required classification fields:
   - `crisis_type`, `confidence`, `affected_population`, `expected_duration_hours`, `affected_radius_km`, `peak_impact_time`, `spread_risk`, `uncertainty_range`, `likely_evolution`
2. **Add `/api/emergency_calls` endpoint** (4th signal source)
3. **Add `/api/field_reports` endpoint** for contradiction scenario
4. **Add `/api/notifications` endpoint** to store & serve stakeholder messages
5. **Add `/api/impact_simulations` endpoint** to store before/after impact data
6. **Add `/api/agent_traces` endpoint** to store structured agent trace logs
7. **Add `/api/resources` endpoint** exposing real-time resource inventory
8. **Add richer mock data** with the example scenario from Challenge 3 (G-10 flooding + heat emergency)

---

### Backend – Agent System (`backend/agents.py`)

#### [MODIFY] [agents.py](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/backend/agents.py)

Major rewrite to close all intelligence gaps:

1. **FusionTriageAgent** – Add:
   - Urgency language scoring (keyword-based NLP)
   - Mention velocity tracking (count signals per location per time window)
   - Contradiction detection (cross-reference social vs weather vs field reports)
   - Geolocation confidence scoring
   - API fallback with cached data on failure (robustness)
   - Duplicate incident deduplication

2. **CrisisAnalystAgent** – Add:
   - Full crisis type classification (flood, heatwave, accident, infrastructure, power outage, protest, disease)
   - Confidence score output
   - Severity & evolution prediction: affected radius, population, duration, peak impact time, spread risk, uncertainty range

3. **ResourceCommanderAgent** – Add:
   - Expanded inventory: police units, shelters, generators, water tankers, drones
   - Priority-weighted allocation based on severity × urgency × population
   - Multi-crisis trade-off logging (when resources are contested)
   - Resource status endpoint sync

4. **ExecutionAgent** – Add:
   - Impact simulation: before state, response action, expected after state, response time improvement, congestion impact, resource cost, side effects
   - Push simulation results to `/api/impact_simulations`

5. **StakeholderNotificationAgent** (NEW) – Add:
   - Generate tailored messages per audience: public, emergency services, hospitals, utility, transport, media/command center
   - Push to `/api/notifications`

6. **VerifierAgent** – Rewrite:
   - Consume `/api/field_reports` for contradiction-based verification
   - Retract alerts + generate correction notifications
   - Log the full escalation → verification → retraction trace

7. **AgentTraceLogger** (NEW utility) – Add:
   - Structured JSON logging of every agent decision: observation, reasoning, decision, action, outcome
   - Push to `/api/agent_traces`

8. **Simulation orchestrator** – Add:
   - Run the exact example scenario from Challenge 3 (G-10 flood + nearby heat emergency)
   - Inject a contradictory field report mid-simulation
   - Handle API downtime gracefully with cached fallback

---

### Backend – Tests (`backend/tests/`)

#### [NEW] [test_main.py](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/backend/tests/test_main.py)

- Test all API endpoints return correct schemas
- Test CRUD on active_crises
- Test field_reports, emergency_calls, notifications, impact_simulations, agent_traces endpoints

#### [NEW] [test_agents.py](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/backend/tests/test_agents.py)

- Test FusionTriageAgent credibility scoring, contradiction detection, fallback behavior
- Test CrisisAnalystAgent classification for each crisis type
- Test ResourceCommanderAgent multi-crisis trade-offs
- Test VerifierAgent retraction flow
- Test StakeholderNotificationAgent message generation

---

### Backend – Documentation

#### [NEW] [README.md](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/README.md)

- Architecture diagram, data schemas, Antigravity usage, APIs/tools, assumptions, privacy/safety note, cost/latency analysis, baseline comparison, scalability discussion, limitations

---

## Verification Plan

### Automated Tests
```bash
cd backend
pip install pytest httpx
pytest tests/ -v
```

### Manual Verification
- Start backend with `uvicorn main:app --reload`
- Run `python agents.py` to execute the full simulation
- Verify agent trace logs at `/api/agent_traces`
- Verify stakeholder notifications at `/api/notifications`
- Verify impact simulations at `/api/impact_simulations`
- Verify false-positive retraction flow in logs

> [!IMPORTANT]
> The mobile app screens (index.tsx, crises.tsx, resources.tsx) will also need minor updates to display the new fields (confidence, population, notifications, impact sim). However, the core challenge scoring is backend-heavy (Antigravity integration 20% + Crisis detection 25% + Resource optimization 20% + Impact simulation 15% = 80%). I'll update the mobile screens to show the new data after the backend is solid.
