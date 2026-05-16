# CIRO – Crisis Intelligence & Response Orchestrator

## Architecture

```
┌─────────────────┐       ┌──────────────────────┐       ┌──────────────────┐
│  Expo Mobile App │◄─────►│  FastAPI Backend      │◄─────►│  Agent Pipeline   │
│  (React Native)  │  REST │  (Mock Signal Server) │  HTTP │  (Python Agents)  │
└─────────────────┘       └──────────────────────┘       └──────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          │  In-Memory Stores  │
                          │ • Active Crises    │
                          │ • Notifications    │
                          │ • Impact Sims      │
                          │ • Agent Traces     │
                          │ • Field Reports    │
                          │ • Resource Inv.    │
                          └───────────────────┘
```

### Components

| Component | Technology | Purpose |
|---|---|---|
| **Backend API** | FastAPI + Pydantic | Mock signal streams, crisis CRUD, resource inventory, notifications, impact sims, agent traces |
| **Agent Pipeline** | Python classes | 6 agents: Fusion/Triage, Crisis Analyst, Resource Commander, Execution, Stakeholder Notification, Verifier |
| **Mobile App** | React Native (Expo) | 3-tab interface: Live Signals, Active Crises, Resources |

## Data Stream Schemas

### Signal Sources (4 sources)
- **Social**: `id, timestamp, location, text, credibility_score, geolocation_confidence, urgency_score, source_type`
- **Weather**: `id, timestamp, alert_type, severity, affected_zones, temperature_c, humidity_pct, wind_speed_kmh`
- **Traffic**: `id, timestamp, route_name, congestion_level, average_speed, incident_reported`
- **Emergency Calls**: `id, timestamp, location, call_type, description, frequency`

### Crisis Classification
`id, title, description, crisis_type, severity, confidence, location, status, affected_population, expected_duration_hours, affected_radius_km, peak_impact_time, spread_risk, uncertainty_range, likely_evolution, resources_allocated`

**Supported crisis types**: flood, heatwave, accident, infrastructure, power_outage, protest, disease_cluster

## Antigravity Usage

Google Antigravity was used to:
1. **Design & scaffold** the entire multi-agent architecture
2. **Generate** all agent classes with reasoning logic
3. **Implement** credibility scoring, contradiction detection, and classification algorithms
4. **Create** the full FastAPI server with enriched Pydantic schemas
5. **Build** the React Native Expo mobile app with 3 screens
6. **Write** 30 automated tests for API endpoints and agent logic
7. **Debug** keyword matching priority issues in crisis classification
8. **Generate** stakeholder notification templates for 6 audiences

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/social` | GET | Social media signals |
| `/api/weather` | GET | Weather alerts |
| `/api/traffic` | GET | Traffic data |
| `/api/emergency_calls` | GET | Emergency call logs |
| `/api/field_reports` | GET/POST | Field verification reports |
| `/api/active_crises` | GET/POST/PUT/DELETE | Active crisis management |
| `/api/resources` | GET/PUT | Resource inventory |
| `/api/notifications` | GET/POST | Stakeholder notifications |
| `/api/impact_simulations` | GET/POST | Before/after impact sims |
| `/api/agent_traces` | GET/POST | Agent reasoning logs |
| `/api/cache/{source}` | GET | Degraded-mode cached data |
| `/api/health` | GET | Health check |

## Setup

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0

# Agent simulation (separate terminal)
cd backend
python agents.py

# Mobile app (separate terminal)
cd mobile_app
npm install
npx expo start
```

## Assumptions
- Mock/synthetic data is used for all signal sources
- Resource inventory starts with fixed quantities per session
- Agent pipeline runs as a standalone Python process polling the API
- In-memory storage resets on server restart

## Privacy & Safety
- No real personal data is collected or stored
- All social posts are synthetic
- No real emergency services are contacted
- System is a prototype for demonstration purposes only

## Cost & Latency
- **API cost**: $0 (all data is locally generated)
- **Latency**: <100ms per API call (local FastAPI)
- **Agent cycle**: ~2-5s per full pipeline run
- **At 10x scale**: Would need persistent database (PostgreSQL) instead of in-memory lists
- **At 100x scale**: Would need message queue (Redis/Kafka), horizontal scaling, and caching layer

## Baseline Comparison
| Feature | Non-Agentic (manual) | CIRO (agentic) |
|---|---|---|
| Signal fusion | Manual cross-reference | Automated with credibility scoring |
| Crisis detection | Human interpretation | Keyword + multi-source classification |
| Resource allocation | Ad-hoc | Priority-weighted with trade-off analysis |
| Response time | Hours | Seconds (automated pipeline) |
| False positive handling | Manual review | Automated field-report verification |

## Limitations
- Classification uses keyword matching, not ML/NLP
- No real geolocation or map integration
- Resource allocation is rule-based, not optimization-based
- In-memory storage, no persistence across restarts
- Single-user, no authentication
