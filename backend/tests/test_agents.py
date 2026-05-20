"""
Tests for the LangGraph-based agent pipeline.
Tests the helper functions and structural aspects without calling the LLM.
"""
import pytest
from unittest.mock import patch, MagicMock
import json

# Test the structured output schemas
from agents import (
    FusedAnomaly, CrisisClassification, ResourceDecision,
    ImpactSim, StakeholderMessages, VerificationResult,
    FusedAnomalyList, CrisisClassificationList, ResourceDecisionList, ImpactSimList,
    api_get, trace
)

# ── Pydantic Schema Tests ──
class TestSchemas:
    def test_fused_anomaly_schema(self):
        a = FusedAnomaly(
            location="G-10", anomaly_summary="Flooding reported",
            credibility_assessment="Matches weather data",
            urgency="High", contradiction_flag=False, composite_confidence=85
        )
        assert a.location == "G-10"
        assert a.composite_confidence == 85

    def test_crisis_classification_schema(self):
        c = CrisisClassification(
            crisis_type="flood", location="G-10", severity="Critical",
            confidence_score=90, affected_population=27000,
            affected_radius_km=3.0, expected_duration_hours=8.0,
            spread_risk="High", likely_evolution="Expected to spread",
            reasoning="Multiple sources confirm flooding"
        )
        assert c.crisis_type == "flood"
        assert c.severity == "Critical"
        assert c.affected_population == 27000

    def test_resource_decision_schema(self):
        r = ResourceDecision(
            crisis_title="Flood — G-10",
            priority_score=12000.0,
            allocated_resources=["2 Ambulances", "2 Rescue Teams"],
            trade_off_reasoning="Flood gets priority (Score: 12000) over heatwave (Score: 8667)",
            denied_resources=["1 Drone"]
        )
        assert len(r.allocated_resources) == 2
        assert len(r.denied_resources) == 1
        assert r.priority_score == 12000.0

    def test_impact_sim_schema(self):
        s = ImpactSim(
            response_action="Reroute traffic",
            before_state="Severe congestion",
            expected_after_state="Moderate congestion",
            response_time_improvement="15 min",
            congestion_impact="30% reduction",
            resource_cost="2 units",
            possible_side_effects=["Alternate route congestion"]
        )
        assert s.response_action == "Reroute traffic"
        assert len(s.possible_side_effects) == 1

    def test_stakeholder_messages_schema(self):
        m = StakeholderMessages(
            public_alert="Stay safe",
            emergency_services_dispatch="Deploy to G-10",
            hospital_advisory="Prepare for casualties",
            utility_notice="Check infrastructure",
            transport_alert="Reroute traffic",
            media_brief="Flood at G-10, Critical severity"
        )
        assert m.public_alert == "Stay safe"

    def test_verification_result_schema(self):
        v = VerificationResult(
            is_false_positive=True,
            corrected_classification="Broken water main",
            retraction_message="Previous flood alert retracted",
            reasoning="Field report confirms water main burst"
        )
        assert v.is_false_positive is True

# ── API Helper Tests ──
class TestHelpers:
    def test_api_get_success(self):
        with patch("agents.requests.get") as mock:
            mock.return_value = MagicMock(
                status_code=200,
                json=lambda: [{"id": "1", "text": "test"}]
            )
            mock.return_value.raise_for_status = lambda: None
            result = api_get("social")
            assert len(result) == 1

    def test_api_get_fallback(self):
        with patch("agents.requests.get", side_effect=Exception("timeout")):
            result = api_get("nonexistent_endpoint")
            assert result == [] or isinstance(result, list)

    def test_trace_creates_entry(self):
        with patch("agents.api_post") as mock_post:
            t = trace("TestAgent", "test_step", "obs", "reason", "decide", "act", "ok")
            assert t["agent_name"] == "TestAgent"
            assert t["step"] == "test_step"
            assert "timestamp" in t
            mock_post.assert_called_once()
