import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# ── Signal Source Tests ──
def test_social_endpoint():
    r = client.get("/api/social")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 2
    assert "credibility_score" in data[0]
    assert "geolocation_confidence" in data[0]
    assert "urgency_score" in data[0]

def test_weather_endpoint():
    r = client.get("/api/weather")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 2
    assert any(w["alert_type"] == "Heavy Rain" for w in data)
    assert any(w["alert_type"] == "Extreme Heat" for w in data)

def test_traffic_endpoint():
    r = client.get("/api/traffic")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert "congestion_level" in data[0]

def test_emergency_calls_endpoint():
    r = client.get("/api/emergency_calls")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 2
    assert "frequency" in data[0]

# ── CRUD Tests ──
def test_active_crises_crud():
    crisis = {
        "id": "test-1", "title": "Test Flood", "description": "Test",
        "crisis_type": "flood", "severity": "High", "confidence": 0.85,
        "location": "G-10", "status": "Active", "affected_population": 10000,
        "expected_duration_hours": 6.0, "affected_radius_km": 2.0,
        "peak_impact_time": "2026-01-01T12:00:00", "spread_risk": "High",
        "uncertainty_range": "±10%", "likely_evolution": "Spreading",
        "resources_allocated": ["2 Ambulances"], "timestamp": "2026-01-01T12:00:00"
    }
    r = client.post("/api/active_crises", json=crisis)
    assert r.status_code == 200

    r = client.get("/api/active_crises")
    assert any(c["id"] == "test-1" for c in r.json())

    r = client.delete("/api/active_crises/test-1")
    assert r.status_code == 200

def test_field_reports_crud():
    report = {
        "id": "fr-1", "timestamp": "2026-01-01T12:00:00",
        "location": "G-10", "reporter": "Engineer",
        "description": "Broken water main", "contradicts_crisis_id": "test-1",
        "verified": False
    }
    r = client.post("/api/field_reports", json=report)
    assert r.status_code == 200
    r = client.get("/api/field_reports")
    assert len(r.json()) >= 1

def test_notifications_crud():
    n = {
        "id": "n-1", "crisis_id": "test-1", "audience": "public",
        "message": "Test alert", "priority": "Urgent",
        "timestamp": "2026-01-01T12:00:00"
    }
    r = client.post("/api/notifications", json=n)
    assert r.status_code == 200
    r = client.get("/api/notifications")
    assert len(r.json()) >= 1

def test_impact_simulations_crud():
    sim = {
        "id": "sim-1", "crisis_id": "test-1",
        "before_state": {"congestion": "Severe"},
        "response_action": "Reroute traffic",
        "expected_after_state": {"congestion": "Moderate"},
        "response_time_improvement": "15 min",
        "congestion_impact": "30% reduction",
        "resource_cost": "2 units",
        "possible_side_effects": ["Alternate route congestion"],
        "timestamp": "2026-01-01T12:00:00"
    }
    r = client.post("/api/impact_simulations", json=sim)
    assert r.status_code == 200
    r = client.get("/api/impact_simulations")
    assert len(r.json()) >= 1

def test_agent_traces_crud():
    trace = {
        "id": "t-1", "agent_name": "TestAgent", "step": "test",
        "observation": "obs", "reasoning": "reason",
        "decision": "decide", "action": "act", "outcome": "ok",
        "timestamp": "2026-01-01T12:00:00"
    }
    r = client.post("/api/agent_traces", json=trace)
    assert r.status_code == 200
    r = client.get("/api/agent_traces")
    assert len(r.json()) >= 1

def test_resources_endpoint():
    r = client.get("/api/resources")
    assert r.status_code == 200
    data = r.json()
    assert data["ambulances"] == 5
    assert data["rescue_teams"] == 3
    assert "drones" in data

def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

def test_cache_fallback_404():
    r = client.get("/api/cache/nonexistent")
    assert r.status_code == 404

def test_dashboard_endpoint():
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    data = r.json()
    assert "crises" in data
    assert "resources" in data
    assert "system_status" in data
    assert "signal_counts" in data
    assert "notification_count" in data
