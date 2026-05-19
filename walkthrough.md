# CIRO Redesign Walkthrough

## Summary

Complete overhaul of the CIRO mobile app and backend:
- **Backend**: Removed all Google Cloud/Firestore dependencies, added `/api/dashboard` aggregation endpoint
- **Mobile App**: Redesigned from dark 4-tab UI to light minimalist 3-tab with drill-down navigation
- **Map**: Fixed with CartoDB light tiles and proper marker placement
- **Tests**: All 13 backend tests passing

---

## Changes Made

### Backend ([main.py](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/backend/main.py))
- Removed `google.cloud.firestore` import and `db` client
- Removed Firestore reads from `get_active_crises` and `get_agent_traces`
- Added `GET /api/dashboard` — aggregated endpoint returning crises, resources, status, signal counts, notifications, simulations, and traces in one call
- Pure in-memory data storage (no cloud dependencies)

### Backend ([agents.py](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/backend/agents.py))
- Removed Firestore import, client setup, `fs_push_crisis()`, `fs_push_trace()`, and batch push
- Reduced inter-cycle wait from 15s to 10s
- Agent loop remains continuous (`while True`) — this IS the master agent

### Mobile App — New Architecture
| Tab | File | Purpose |
|-----|------|---------|
| **Dashboard** | [index.tsx](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/mobile_app/src/app/index.tsx) | Event cards with severity/confidence/status boxes, resource summary |
| **Map** | [map.tsx](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/mobile_app/src/app/map.tsx) | Full-screen Leaflet map with CartoDB light tiles |
| **Agent Log** | [agents-log.tsx](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/mobile_app/src/app/agents-log.tsx) | Expandable trace feed with pipeline progress |

### Drill-Down Navigation (all in index.tsx via state)
1. **Dashboard** → Tap event card
2. **Event Detail** → Full crisis info, metrics grid, resources, simulations, notifications
3. **Agent Report** → Complete pipeline flow showing each agent's ReACT trace

### Deleted Files
- `signals.tsx` (raw signals now accessible via event detail)
- `resources.tsx` (resources shown on dashboard)
- `crises.tsx` (replaced by map.tsx)

---

## Verification

### Backend Tests
```
13 passed in 1.03s
```
All endpoints working including new `/api/dashboard`.

---

## How to Run

```bash
# 1. Backend
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 2. Agent pipeline (separate terminal)
cd backend
python agents.py

# 3. Mobile app (separate terminal)
cd mobile_app
npx expo start
```

### API URL
Currently set to `http://192.168.100.51:8000/api` in [api.ts](file:///c:/Users/kawis/Desktop/Py/CIRO_AISeekho/mobile_app/src/constants/api.ts). Update this if your IP changes.
