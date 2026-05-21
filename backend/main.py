from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid
import random
import asyncio
import threading
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from enum import Enum

# ── Resource Monitor background task ──
_resource_monitor_task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the ResourceMonitor on startup, clean up on shutdown."""
    global _resource_monitor_task
    _resource_monitor_task = asyncio.create_task(_resource_monitor_loop())
    print("  [STARTUP] ResourceMonitor background task started")
    yield
    if _resource_monitor_task:
        _resource_monitor_task.cancel()
        print("  [SHUTDOWN] ResourceMonitor stopped")

app = FastAPI(title="CIRO – Crisis Intelligence & Response Orchestrator", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────
class CrisisType(str, Enum):
    FLOOD = "flood"
    HEATWAVE = "heatwave"
    ACCIDENT = "accident"
    INFRASTRUCTURE = "infrastructure"
    POWER_OUTAGE = "power_outage"
    PROTEST = "protest"
    DISEASE_CLUSTER = "disease_cluster"
    UNKNOWN = "unknown"

class SeverityLevel(str, Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"

class NotificationAudience(str, Enum):
    PUBLIC = "public"
    EMERGENCY_SERVICES = "emergency_services"
    HOSPITALS = "hospitals"
    UTILITY_COMPANIES = "utility_companies"
    TRANSPORT_AUTHORITY = "transport_authority"
    MEDIA_COMMAND_CENTER = "media_command_center"

# ──────────────────────────────────────────────
# Signal Source Schemas
# ──────────────────────────────────────────────
class SocialSignal(BaseModel):
    id: str
    timestamp: str
    location: str
    text: str
    credibility_score: float
    geolocation_confidence: float = 0.0
    urgency_score: float = 0.0
    mention_velocity: int = 1       # how many posts/mentions in last 15 min (misinformation flag)
    contradiction_level: float = 0.0  # 0=consistent, 1=contradicts other sources
    source_type: str = "citizen_post"

class WeatherSignal(BaseModel):
    id: str
    timestamp: str
    alert_type: str
    severity: str
    affected_zones: List[str]
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    wind_speed_kmh: Optional[float] = None

class TrafficSignal(BaseModel):
    id: str
    timestamp: str
    route_name: str
    congestion_level: str
    average_speed: float
    incident_reported: bool = False

class MockSensor(BaseModel):
    id: str
    timestamp: str
    sensor_type: str    # water_level, temperature, smoke, vibration
    location: str
    value: float
    unit: str
    threshold_exceeded: bool
    severity: str       # Normal, Warning, Critical
    incident_reported: bool = False

class EmergencyCall(BaseModel):
    id: str
    timestamp: str
    location: str
    call_type: str
    description: str
    frequency: int = 1  # how many similar calls in last 30 min

class FieldReport(BaseModel):
    id: str
    timestamp: str
    location: str
    reporter: str
    description: str
    contradicts_crisis_id: Optional[str] = None
    verified: bool = False

# ──────────────────────────────────────────────
# Crisis & Response Schemas
# ──────────────────────────────────────────────
class ActiveCrisis(BaseModel):
    id: str
    title: str
    description: str
    crisis_type: str = "unknown"
    severity: str = "Medium"
    confidence: float = 0.5
    location: str
    status: str = "Active"
    affected_population: int = 0
    expected_duration_hours: float = 0.0
    affected_radius_km: float = 0.0
    peak_impact_time: str = ""
    spread_risk: str = "Low"
    uncertainty_range: str = ""
    likely_evolution: str = ""
    resources_allocated: List[str] = []
    priority_score: float = 0.0
    timestamp: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None

# Real Islamabad sector coordinates for map markers
LOCATION_COORDS: Dict[str, tuple] = {
    # Verified GPS centers for each Islamabad sector
    "G-10": (33.6782, 72.9984),   # G-10 Markaz area
    "G-11": (33.6695, 72.9868),   # G-11 center
    "G-6":  (33.7290, 73.0765),   # G-6 Markaz
    "G-7":  (33.7150, 73.0560),   # G-7
    "G-8":  (33.7040, 73.0445),   # G-8
    "G-9":  (33.6930, 73.0280),   # G-9
    "G-13": (33.6492, 72.9685),   # G-13
    "F-6":  (33.7315, 73.0725),   # F-6 Jinnah Super
    "F-7":  (33.7225, 73.0560),   # F-7
    "F-8":  (33.7120, 73.0396),   # F-8 Markaz
    "F-10": (33.7010, 73.0100),   # F-10
    "I-8":  (33.6820, 73.0785),   # I-8
    "I-9":  (33.6690, 73.0760),   # I-9
    "I-10": (33.6590, 73.0440),   # I-10
    "E-7":  (33.7370, 73.0360),   # E-7
    "H-8":  (33.6850, 73.0600),   # H-8
    "Blue Area": (33.7295, 73.0930),  # Blue Area / Civic Centre
    "Murree Road": (33.7050, 73.0629),
    "Margalla":    (33.7556, 73.0590),
}

def resolve_coords(location: str):
    """Fuzzy-match a location string to known Islamabad coordinates."""
    # Try exact match first
    for key, (lat, lng) in LOCATION_COORDS.items():
        if key.lower() in location.lower():
            return lat, lng
    # Default to Islamabad center
    return 33.6844, 73.0479

class ResourceInventory(BaseModel):
    ambulances: int = 5
    police_units: int = 4
    rescue_teams: int = 3
    shelters: int = 2
    generators: int = 3
    water_tankers: int = 2
    field_teams: int = 4
    drones: int = 2

class ImpactSimulation(BaseModel):
    id: str
    crisis_id: str
    before_state: Dict[str, Any]
    response_action: str
    expected_after_state: Dict[str, Any]
    response_time_improvement: str
    congestion_impact: str
    resource_cost: str
    possible_side_effects: List[str]
    timestamp: str = ""

class StakeholderNotification(BaseModel):
    id: str
    crisis_id: str
    audience: str
    message: str
    priority: str = "Normal"
    timestamp: str = ""

class AgentTrace(BaseModel):
    id: str
    agent_name: str
    step: str
    observation: str
    reasoning: str
    decision: str
    action: str
    outcome: str
    timestamp: str = ""

# ──────────────────────────────────────────────
# Resource Allocation with TTL (working.txt #4)
# ──────────────────────────────────────────────
class ResourceAllocation(BaseModel):
    id: str
    crisis_id: str
    crisis_title: str = ""
    resource_type: str          # "ambulances", "rescue_teams", etc.
    quantity: int
    allocated_at: str           # ISO timestamp
    release_at: str             # ISO timestamp (allocated_at + TTL)
    status: str = "active"      # "active" | "released"

# ──────────────────────────────────────────────
# Pipeline Event (working.txt #2 — event-driven)
# ──────────────────────────────────────────────
class PipelineEvent(BaseModel):
    id: str
    trigger_source: str         # "social_spike", "sensor_spike", "weather_spike", "manual", "resource_freed"
    trigger_detail: str
    timestamp: str

# ──────────────────────────────────────────────
# In-memory stores
# ──────────────────────────────────────────────
active_crises: List[ActiveCrisis] = []
notifications: List[StakeholderNotification] = []
impact_simulations: List[ImpactSimulation] = []
agent_traces: List[AgentTrace] = []
field_reports: List[FieldReport] = []
resource_inventory = ResourceInventory()
resource_allocations: List[ResourceAllocation] = []
pipeline_events: List[PipelineEvent] = []

# Cache for degraded-mode fallback
_cache: Dict[str, Any] = {
    "social": [],
    "weather": [],
    "traffic": [],
    "emergency_calls": [],
}

# ──────────────────────────────────────────────
# ── ACTIVE EVENTS ──
# Base signals (always present) + 2 low-level background events
# + 1 conditional post-rollback crisis (gas leak at Blue Area)
_SOCIAL_SIGNALS_BASE = [
    # Event 1: Urban flooding in G-10  (Critical — high velocity)
    ("G-10", "Water levels rising rapidly! Streets flooded, vehicles submerged near markaz.", 0.92, 0.90, 0.95),
    # Event 2: Heatwave emergency in F-8  (High — moderate velocity)
    ("F-8", "Elderly neighbor collapsed from heat. Ambulance not arriving. Extremely hot!",  0.90, 0.88, 0.92),
    # Event 3 (Low): Minor fender-bender at I-9 — low urgency
    ("I-9", "Small car accident near I-9 service road. Minor traffic slowdown, no injuries.", 0.45, 0.55, 0.20),
    # Event 4 (Low): Brief power flicker at G-13 — resolved quickly
    ("G-13", "Power went out for a few seconds in G-13 sector, back on now. Probably load-shedding.", 0.40, 0.50, 0.15),
]
_VELOCITIES_BASE = [23, 11, 3, 2]  # flood=high, heatwave=moderate, accident=low, power=low

# Post-rollback crisis: Gas pipeline rupture at Blue Area
# Only activates AFTER the G-10 flood is rolled back as false positive
_GAS_LEAK_SIGNAL = ("Blue Area", "Strong gas smell near Blue Area commercial buildings! People evacuating offices and shops. Fire brigade called!", 0.89, 0.92, 0.91)
_GAS_LEAK_VELOCITY = 19  # high velocity — will trigger spike detection

def _is_flood_rolled_back() -> bool:
    """Check if the flood crisis has been resolved/rolled back."""
    has_run = len(pipeline_events) > 0
    flood_active = any(
        'flood' in c.crisis_type.lower() or 'flood' in c.title.lower()
        for c in active_crises
    )
    return has_run and not flood_active

# ── Spike detection & event-driven pipeline trigger (working.txt #2) ──
_pipeline_lock = threading.Lock()
_last_pipeline_trigger = 0.0
_PIPELINE_COOLDOWN = 30  # seconds between triggers

def _check_and_trigger_spike(source: str, detail: str):
    """Event-driven: when a data spike is detected, trigger the pipeline."""
    import time
    global _last_pipeline_trigger
    with _pipeline_lock:
        now = time.time()
        # Bypass cooldown for field reports to allow immediate verification/rollback run
        if source != "field_report" and (now - _last_pipeline_trigger < _PIPELINE_COOLDOWN):
            return  # cooldown active
        _last_pipeline_trigger = now

    event = PipelineEvent(
        id=str(uuid.uuid4()),
        trigger_source=source,
        trigger_detail=detail,
        timestamp=datetime.now().isoformat()
    )
    pipeline_events.append(event)
    print(f"  [EVENT-DRIVEN] 🚨 Spike detected → {source}: {detail}")

    # Fire the pipeline in a background thread (non-blocking)
    def _run():
        try:
            from agents import run_pipeline_once
            run_pipeline_once(trigger_source=source, trigger_detail=detail)
        except Exception as e:
            print(f"  [ERROR] Pipeline trigger failed: {e}")
    threading.Thread(target=_run, daemon=True).start()

@app.get("/api/social", response_model=List[SocialSignal])
def get_social(background_tasks: BackgroundTasks = None):
    now = datetime.now().isoformat()

    # Build dynamic signal list
    signals = list(_SOCIAL_SIGNALS_BASE)
    velocities = list(_VELOCITIES_BASE)

    # Conditionally inject gas leak crisis after flood rollback
    if _is_flood_rolled_back():
        signals.append(_GAS_LEAK_SIGNAL)
        velocities.append(_GAS_LEAK_VELOCITY)

    data = [
        SocialSignal(
            id=str(uuid.uuid4()), timestamp=now, location=s[0], text=s[1],
            credibility_score=round(s[2] + random.uniform(-0.03, 0.03), 2),
            geolocation_confidence=round(s[3] + random.uniform(-0.03, 0.03), 2),
            urgency_score=round(s[4] + random.uniform(-0.03, 0.03), 2),
            mention_velocity=velocities[i] + random.randint(-2, 2),
            contradiction_level=0.0,
            source_type="citizen_post"
        ) for i, s in enumerate(signals)
    ]
    _cache["social"] = [d.model_dump() for d in data]

    # Spike detection: if any signal has mention_velocity > 15, trigger pipeline
    for d in data:
        if d.mention_velocity > 15:
            _check_and_trigger_spike("social_spike", f"{d.location}: velocity={d.mention_velocity}, text='{d.text[:60]}'")
            break

    return data

@app.get("/api/sensors", response_model=List[MockSensor])
def get_sensors():
    """Mock IoT sensor stream — water level, temperature, vibration, and gas sensors."""
    now = datetime.now().isoformat()
    data = [
        # Water level sensor in G-10 stormwater drain — confirms flood
        MockSensor(
            id=str(uuid.uuid4()), timestamp=now,
            sensor_type="water_level", location="G-10 Stormwater Drain",
            value=round(1.8 + random.uniform(0, 0.4), 2), unit="meters",
            threshold_exceeded=True, severity=random.choice(["Warning", "Critical"])
        ),
        # Urban heat sensor in F-8 residential zone — confirms heatwave
        MockSensor(
            id=str(uuid.uuid4()), timestamp=now,
            sensor_type="temperature", location="F-8 Residential Zone",
            value=round(46.5 + random.uniform(0, 2.5), 1), unit="celsius",
            threshold_exceeded=True, severity=random.choice(["Warning", "Critical"])
        ),
        # Low-level: vibration sensor at I-9 road (minor accident corroboration)
        MockSensor(
            id=str(uuid.uuid4()), timestamp=now,
            sensor_type="vibration", location="I-9 Service Road",
            value=round(0.3 + random.uniform(0, 0.1), 2), unit="g-force",
            threshold_exceeded=False, severity="Normal"
        ),
        # Low-level: voltage fluctuation sensor at G-13 grid station
        MockSensor(
            id=str(uuid.uuid4()), timestamp=now,
            sensor_type="voltage", location="G-13 Grid Station",
            value=round(215 + random.uniform(-5, 5), 1), unit="volts",
            threshold_exceeded=False, severity="Normal"
        ),
    ]

    # Post-rollback: gas leak sensor at Blue Area
    if _is_flood_rolled_back():
        data.append(MockSensor(
            id=str(uuid.uuid4()), timestamp=now,
            sensor_type="gas_concentration", location="Blue Area Commercial Zone",
            value=round(850 + random.uniform(0, 150), 0), unit="ppm",
            threshold_exceeded=True, severity="Critical"
        ))

    _cache["sensors"] = [d.model_dump() for d in data]

    # Spike detection: if any sensor exceeds threshold with Critical severity
    for d in data:
        if d.threshold_exceeded and d.severity == "Critical":
            _check_and_trigger_spike("sensor_spike", f"{d.location}: {d.sensor_type}={d.value}{d.unit} (Critical)")
            break

    return data

# ── Outage simulation flag (toggled by /api/trigger_outage) ──
_outage_mode: Dict[str, bool] = {"social": False, "weather": False, "traffic": False, "emergency_calls": False}

@app.post("/api/trigger_outage")
def trigger_outage(sources: List[str] = None):
    """Simulates API downtime for demo robustness testing."""
    targets = sources or ["weather", "traffic"]
    for s in targets:
        if s in _outage_mode:
            _outage_mode[s] = True
    return {"status": "outage_triggered", "affected": targets}

@app.post("/api/clear_outage")
def clear_outage():
    for s in _outage_mode:
        _outage_mode[s] = False
    return {"status": "outage_cleared"}

@app.get("/api/outage_status")
def outage_status():
    return _outage_mode

@app.get("/api/weather", response_model=List[WeatherSignal])
def get_weather():
    if _outage_mode["weather"]:
        if _cache.get("weather"):
            print("  [DEGRADED] Weather API down — serving stale cache")
            return _cache["weather"]
        raise HTTPException(status_code=503, detail="Weather API unavailable (simulated outage)")
    now = datetime.now().isoformat()
    data = [
        # Event 1 corroboration: heavy rain in G-10 zone
        WeatherSignal(
            id=str(uuid.uuid4()), timestamp=now,
            alert_type="Heavy Rain", severity=random.choice(["High", "Critical"]),
            affected_zones=["G-10", "G-9"],
            temperature_c=round(27 + random.uniform(0, 3), 1),
            humidity_pct=round(91 + random.uniform(0, 8), 1),
            wind_speed_kmh=round(32 + random.uniform(0, 12), 1)
        ),
        # Event 2 corroboration: extreme heat in F-8 zone
        WeatherSignal(
            id=str(uuid.uuid4()), timestamp=now,
            alert_type="Extreme Heat", severity=random.choice(["High", "Critical"]),
            affected_zones=["F-8", "F-6"],
            temperature_c=round(45 + random.uniform(0, 3), 1),
            humidity_pct=round(14 + random.uniform(0, 8), 1),
            wind_speed_kmh=round(4 + random.uniform(0, 4), 1)
        ),
    ]
    _cache["weather"] = [d.model_dump() for d in data]
    return data

@app.get("/api/traffic", response_model=List[TrafficSignal])
def get_traffic():
    if _outage_mode["traffic"]:
        if _cache.get("traffic"):
            print("  [DEGRADED] Traffic API down — serving stale cache")
            return _cache["traffic"]
        raise HTTPException(status_code=503, detail="Traffic API unavailable (simulated outage)")
    now = datetime.now().isoformat()
    data = [
        # Event 1 corroboration: G-10 road severely congested (confirms flood)
        TrafficSignal(
            id=str(uuid.uuid4()), timestamp=now,
            route_name="Kashmir Highway (G-10 segment)",
            congestion_level=random.choice(["Severe", "Severe", "Critical"]),
            average_speed=round(3 + random.uniform(0, 6), 1),
            incident_reported=True
        ),
        # Low-level: minor slowdown at I-9 (fender-bender corroboration)
        TrafficSignal(
            id=str(uuid.uuid4()), timestamp=now,
            route_name="I-9 Service Road",
            congestion_level="Moderate",
            average_speed=round(25 + random.uniform(0, 10), 1),
            incident_reported=True
        ),
    ]

    # Post-rollback: road closures near Blue Area due to gas leak
    if _is_flood_rolled_back():
        data.append(TrafficSignal(
            id=str(uuid.uuid4()), timestamp=now,
            route_name="Jinnah Avenue (Blue Area)",
            congestion_level=random.choice(["Severe", "Critical"]),
            average_speed=round(2 + random.uniform(0, 3), 1),
            incident_reported=True
        ))

    _cache["traffic"] = [d.model_dump() for d in data]
    return data

@app.get("/api/emergency_calls", response_model=List[EmergencyCall])
def get_emergency_calls():
    now = datetime.now().isoformat()
    data = [
        # Event 1: flood rescue calls from G-10
        EmergencyCall(
            id=str(uuid.uuid4()), timestamp=now, location="G-10",
            call_type="flood_rescue",
            description="Multiple families trapped on rooftops due to rising water levels",
            frequency=random.randint(6, 14)
        ),
        # Event 2: medical emergency calls from F-8
        EmergencyCall(
            id=str(uuid.uuid4()), timestamp=now, location="F-8",
            call_type="medical_emergency",
            description="Heatstroke cases surging in low-income residential area",
            frequency=random.randint(3, 9)
        ),
        # Low-level: single call about minor accident at I-9
        EmergencyCall(
            id=str(uuid.uuid4()), timestamp=now, location="I-9",
            call_type="traffic_accident",
            description="Minor fender-bender on service road, no injuries, requesting traffic police",
            frequency=1
        ),
    ]

    # Post-rollback: gas leak evacuation calls from Blue Area
    if _is_flood_rolled_back():
        data.append(EmergencyCall(
            id=str(uuid.uuid4()), timestamp=now, location="Blue Area",
            call_type="gas_leak_evacuation",
            description="Strong gas odour in commercial zone, multiple buildings evacuating, requesting fire brigade",
            frequency=random.randint(7, 15)
        ))

    _cache["emergency_calls"] = [d.model_dump() for d in data]
    return data

# ──────────────────────────────────────────────
# System Status (for live agent thinking display)
# ──────────────────────────────────────────────
system_status = {
    "cycle": 0,
    "active_agent": "idle",
    "phase": "waiting",
    "last_update": "",
}

@app.get("/api/system_status")
def get_system_status():
    return system_status

@app.put("/api/system_status")
def update_system_status(status: Dict[str, Any]):
    global system_status
    system_status.update(status)
    system_status["last_update"] = datetime.now().isoformat()
    return {"status": "updated"}

# ──────────────────────────────────────────────
# Field Reports
# ──────────────────────────────────────────────
@app.get("/api/field_reports", response_model=List[FieldReport])
def get_field_reports():
    return field_reports

@app.post("/api/field_reports")
def add_field_report(report: FieldReport):
    field_reports.append(report)
    # Event-driven trigger: when a field report is posted, automatically trigger verification pipeline
    _check_and_trigger_spike("field_report", f"New report contradicts crisis {report.contradicts_crisis_id[:8] if report.contradicts_crisis_id else 'none'}")
    return {"status": "success"}

# ──────────────────────────────────────────────
# Active Crises CRUD
# ──────────────────────────────────────────────
@app.get("/api/active_crises", response_model=List[ActiveCrisis])
def get_active_crises():
    return active_crises

@app.post("/api/active_crises")
def create_active_crisis(crisis: ActiveCrisis):
    if crisis.lat is None or crisis.lng is None:
        lat, lng = resolve_coords(crisis.location)
        crisis = crisis.model_copy(update={"lat": lat, "lng": lng})
    active_crises.append(crisis)
    return {"status": "success", "id": crisis.id}

@app.put("/api/active_crises/{crisis_id}")
def update_active_crisis(crisis_id: str, crisis: ActiveCrisis):
    global active_crises
    if crisis.lat is None or crisis.lng is None:
        lat, lng = resolve_coords(crisis.location)
        crisis = crisis.model_copy(update={"lat": lat, "lng": lng})
    for i, c in enumerate(active_crises):
        if c.id == crisis_id:
            active_crises[i] = crisis
            return {"status": "updated"}
    raise HTTPException(status_code=404, detail="Crisis not found")

@app.delete("/api/active_crises/{crisis_id}")
def delete_active_crisis(crisis_id: str):
    global active_crises, resource_allocations
    active_crises = [c for c in active_crises if c.id != crisis_id]
    # Also release all resource allocations for this crisis to stop timers on the mobile app
    for alloc in resource_allocations:
        if alloc.crisis_id == crisis_id:
            alloc.status = "released"
    return {"status": "deleted"}

# ──────────────────────────────────────────────
# Resources
# ──────────────────────────────────────────────
@app.get("/api/resources", response_model=ResourceInventory)
def get_resources():
    return resource_inventory

@app.put("/api/resources")
def update_resources(inv: ResourceInventory):
    global resource_inventory
    resource_inventory = inv
    return {"status": "updated"}

# ──────────────────────────────────────────────
# Notifications
# ──────────────────────────────────────────────
@app.get("/api/notifications", response_model=List[StakeholderNotification])
def get_notifications():
    return notifications

@app.post("/api/notifications")
def add_notification(n: StakeholderNotification):
    notifications.append(n)
    return {"status": "success"}

# ──────────────────────────────────────────────
# Impact Simulations
# ──────────────────────────────────────────────
@app.get("/api/impact_simulations", response_model=List[ImpactSimulation])
def get_impact_simulations():
    return impact_simulations

@app.post("/api/impact_simulations")
def add_impact_simulation(sim: ImpactSimulation):
    impact_simulations.append(sim)
    return {"status": "success"}

# ──────────────────────────────────────────────
# Agent Traces
# ──────────────────────────────────────────────
@app.get("/api/agent_traces", response_model=List[AgentTrace])
def get_agent_traces():
    return agent_traces

@app.post("/api/agent_traces")
def add_agent_trace(trace: AgentTrace):
    agent_traces.append(trace)
    return {"status": "success"}

# ──────────────────────────────────────────────
# Dashboard (aggregated for mobile home screen)
# ──────────────────────────────────────────────
@app.get("/api/dashboard")
def get_dashboard():
    """Aggregated endpoint for the mobile/web app dashboard.
    On first poll (no pipeline events yet), internally triggers signal
    check so the pipeline auto-starts regardless of which client connects first.
    """
    # Auto-trigger: if no pipeline has ever run, check signals for spikes
    if len(pipeline_events) == 0 and len(active_crises) == 0:
        try:
            get_social()   # internally runs spike detection → may fire pipeline
            get_sensors()  # also checks sensor thresholds
        except Exception:
            pass  # non-critical — manual trigger still available

    return {
        "crises": [c.model_dump() for c in active_crises],
        "resources": resource_inventory.model_dump(),
        "system_status": system_status,
        "signal_counts": {
            "social": len(_cache.get("social", [])),
            "weather": len(_cache.get("weather", [])),
            "traffic": len(_cache.get("traffic", [])),
            "emergency": len(_cache.get("emergency_calls", [])),
            "sensors": len(_cache.get("sensors", [])),
        },
        "notification_count": len(notifications),
        "trace_count": len(agent_traces),
        "notifications": [n.model_dump() for n in notifications[-20:]],
        "impact_simulations": [s.model_dump() for s in impact_simulations],
        "agent_traces": [t.model_dump() for t in agent_traces],
        "resource_allocations": [a.model_dump() for a in resource_allocations],
        "pipeline_events": [e.model_dump() for e in pipeline_events[-10:]],
    }

# ──────────────────────────────────────────────
# Cache endpoint (for degraded mode)
# ──────────────────────────────────────────────
@app.get("/api/cache/{source}")
def get_cached(source: str):
    if source in _cache and _cache[source]:
        return {"source": source, "cached": True, "data": _cache[source]}
    raise HTTPException(status_code=404, detail="No cached data")

# ──────────────────────────────────────────────
# Resource Allocations (TTL lifecycle — working.txt #4)
# ──────────────────────────────────────────────
@app.get("/api/resource_allocations", response_model=List[ResourceAllocation])
def get_resource_allocations():
    return resource_allocations

@app.post("/api/resource_allocations")
def add_resource_allocation(alloc: ResourceAllocation):
    resource_allocations.append(alloc)
    return {"status": "success", "id": alloc.id}

# ──────────────────────────────────────────────
# Pipeline Events (event-driven — working.txt #2)
# ──────────────────────────────────────────────
@app.get("/api/pipeline_events")
def get_pipeline_events():
    return [e.model_dump() for e in pipeline_events[-20:]]

@app.post("/api/trigger_pipeline")
def manual_trigger_pipeline():
    """Manually trigger the pipeline (for demo/testing)."""
    _check_and_trigger_spike("manual", "Manual trigger via API")
    return {"status": "triggered"}

# ──────────────────────────────────────────────
# ResourceMonitor — TTL auto-free (working.txt #4)
# ──────────────────────────────────────────────
async def _resource_monitor_loop():
    """Background task: checks active allocations and auto-frees expired ones."""
    while True:
        await asyncio.sleep(5)  # check every 5 seconds for responsive demo
        now = datetime.now()
        freed_any = False
        for alloc in resource_allocations:
            if alloc.status != "active":
                continue
            try:
                release_time = datetime.fromisoformat(alloc.release_at)
                if now >= release_time:
                    # Auto-free this allocation
                    alloc.status = "released"
                    # Increment inventory
                    res_key = alloc.resource_type
                    if hasattr(resource_inventory, res_key):
                        current = getattr(resource_inventory, res_key)
                        setattr(resource_inventory, res_key, current + alloc.quantity)
                    # Post trace log
                    trace_entry = AgentTrace(
                        id=str(uuid.uuid4()),
                        agent_name="ResourceMonitor",
                        step="auto_free",
                        observation=f"Allocation {alloc.id[:8]} for {alloc.quantity} {alloc.resource_type} has expired",
                        reasoning=f"release_at={alloc.release_at} has passed. Crisis: {alloc.crisis_title}",
                        decision=f"Auto-free {alloc.quantity} {alloc.resource_type} back to inventory",
                        action="Increment resource_inventory, mark allocation as released",
                        outcome=f"{alloc.quantity} {alloc.resource_type} returned to available pool",
                        timestamp=now.isoformat()
                    )
                    agent_traces.append(trace_entry)
                    freed_any = True
                    print(f"  [RESOURCE MONITOR] ♻️ Auto-freed {alloc.quantity} {alloc.resource_type} from '{alloc.crisis_title}'")
            except (ValueError, TypeError):
                continue

        if freed_any:
            # Trigger pipeline re-evaluation
            _check_and_trigger_spike("resource_freed", "Resources auto-freed — re-evaluating pending crises")

# ──────────────────────────────────────────────
# Health
# ──────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}
