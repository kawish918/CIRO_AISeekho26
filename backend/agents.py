"""
CIRO – LangGraph Multi-Agent Pipeline
Real LLM-powered crisis intelligence using Groq + LangGraph.
"""
import os
import time
import requests
import json
import uuid
import re
from typing import TypedDict, List, Dict, Any, Annotated
from datetime import datetime, timedelta
from operator import add

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field


load_dotenv()

API = "http://localhost:8000/api"

# ─────────────────────────────────────────────
# LLM Setup
# ─────────────────────────────────────────────
llm = ChatGroq(
    temperature=0,
    model_name="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
)



# ─────────────────────────────────────────────
# Shared State
# ─────────────────────────────────────────────
class CrisisState(TypedDict):
    raw_signals: Dict[str, Any]
    fused_anomalies: List[Dict[str, Any]]
    classified_crises: List[Dict[str, Any]]
    resource_inventory: Dict[str, int]
    impact_simulations: List[Dict[str, Any]]
    notifications: List[Dict[str, Any]]
    trace_logs: Annotated[List[Dict[str, Any]], add]
    field_reports: List[Dict[str, Any]]
    cycle: int
    false_positive_ids: List[str]   # crises retracted this cycle

# ─────────────────────────────────────────────
# Pydantic structured outputs
# ─────────────────────────────────────────────
class FusedAnomaly(BaseModel):
    location: str = Field(description="Affected area code like G-10, F-8")
    anomaly_summary: str = Field(description="One-line summary of the detected anomaly")
    credibility_assessment: str = Field(description="Why this is credible or suspicious")
    urgency: str = Field(description="Low, Medium, High, or Critical")
    contradiction_flag: bool = Field(description="True if signals contradict each other")
    composite_confidence: int = Field(description="0-100 overall confidence in this anomaly")

class CrisisClassification(BaseModel):
    crisis_type: str = Field(description="flood, heatwave, accident, infrastructure, power_outage, protest, or disease_cluster")
    location: str = Field(description="Affected area")
    severity: str = Field(description="Low, Medium, High, or Critical")
    confidence_score: int = Field(description="0-100 confidence")
    affected_population: int = Field(description="Estimated affected population count")
    affected_radius_km: float = Field(description="Estimated affected radius in km")
    expected_duration_hours: float = Field(description="Expected crisis duration in hours")
    spread_risk: str = Field(description="Low, Medium, or High")
    likely_evolution: str = Field(description="How the crisis is expected to evolve")
    reasoning: str = Field(description="Detailed reasoning for this classification")

class ResourceDecision(BaseModel):
    crisis_title: str
    priority_score: float = Field(description="Computed Priority Score = Severity_Multiplier × Population ÷ ETA_minutes")
    allocated_resources: List[str] = Field(description="List like '2 Ambulances', '1 Rescue Team'")
    trade_off_reasoning: str = Field(description="Explain priority decisions, reference the Priority Score")
    denied_resources: List[str] = Field(description="Resources requested but unavailable")

class ImpactSim(BaseModel):
    response_action: str
    before_state: str = Field(description="State before action, e.g. 'Severe congestion, 0 teams deployed'")
    expected_after_state: str = Field(description="Expected state after action")
    response_time_improvement: str
    congestion_impact: str
    resource_cost: str
    possible_side_effects: List[str]

class StakeholderMessages(BaseModel):
    public_alert: str
    emergency_services_dispatch: str
    hospital_advisory: str
    utility_notice: str
    transport_alert: str
    media_brief: str

class VerificationResult(BaseModel):
    is_false_positive: bool
    corrected_classification: str = Field(description="What the actual situation is")
    retraction_message: str = Field(description="Public correction message if false positive")
    reasoning: str

# Wrapper models — Groq structured output needs a single Pydantic class, not list[X]
class FusedAnomalyList(BaseModel):
    anomalies: List[FusedAnomaly] = Field(description="List of detected anomalies")

class CrisisClassificationList(BaseModel):
    classifications: List[CrisisClassification] = Field(description="List of classified crises")

class ResourceDecisionList(BaseModel):
    decisions: List[ResourceDecision] = Field(description="List of resource allocation decisions")

class ImpactSimList(BaseModel):
    simulations: List[ImpactSim] = Field(description="List of impact simulations")

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
_cache: Dict[str, Any] = {}

def api_get(endpoint: str):
    try:
        r = requests.get(f"{API}/{endpoint}", timeout=5)
        r.raise_for_status()
        data = r.json()
        _cache[endpoint] = data
        return data
    except Exception as e:
        print(f"  [FALLBACK] {endpoint} failed ({e}), using cache")
        return _cache.get(endpoint, [])

def api_post(endpoint: str, data: dict):
    try:
        requests.post(f"{API}/{endpoint}", json=data, timeout=5)
    except Exception as e:
        print(f"  [ERROR] POST {endpoint} failed: {e}")

def set_status(agent: str, phase: str, cycle: int = 0):
    """Broadcast current agent activity to the mobile app."""
    try:
        requests.put(f"{API}/system_status", json={
            "active_agent": agent, "phase": phase, "cycle": cycle
        }, timeout=3)
    except:
        pass

def trace(agent: str, step: str, observation: str, reasoning: str,
          decision: str, action: str, outcome: str):
    t = {
        "id": str(uuid.uuid4()), "agent_name": agent, "step": step,
        "observation": observation, "reasoning": reasoning,
        "decision": decision, "action": action, "outcome": outcome,
        "timestamp": datetime.now().isoformat()
    }
    api_post("agent_traces", t)
    print(f"  [TRACE] {agent}.{step}: {decision}")
    return t

def get_real_travel_time(origin_str: str, destination_str: str) -> str:
    """Calls Google Distance Matrix API to get real-time ETA."""
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        return "15 mins (Failsafe: No API Key)"
        
    origin = origin_str.replace(" ", "+")
    destination = destination_str.replace(" ", "+")
    url = f"https://maps.googleapis.com/maps/api/distancematrix/json?origins={origin}&destinations={destination}&key={api_key}"
    
    try:
        response = requests.get(url, timeout=5).json()
        if response.get('status') == 'OK':
            elements = response.get('rows', [{}])[0].get('elements', [{}])[0]
            if elements.get('status') == 'OK':
                return elements.get('duration', {}).get('text', "Unknown")
        return "Unknown"
    except Exception as e:
        print(f"  [ERROR] Maps API Error: {e}")
        return "15 mins"

# ─────────────────────────────────────────────
# NODE 1: Fusion & Triage
# ─────────────────────────────────────────────
def fusion_node(state: CrisisState) -> dict:
    print("\n═══ [AGENT: Fusion & Triage] ═══")
    set_status("FusionTriageAgent", "🔍 Polling 5 signal sources & cross-referencing...", state.get("cycle", 0))

    social  = api_get("social")
    weather = api_get("weather")
    traffic = api_get("traffic")
    calls   = api_get("emergency_calls")
    sensors = api_get("sensors")   # IoT sensor stream (water level, temperature)

    raw = {"social": social, "weather": weather, "traffic": traffic,
           "emergency_calls": calls, "sensors": sensors}

    signals_text = json.dumps(raw, indent=2, default=str)[:5000]

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a crisis signal fusion analyst for Islamabad, Pakistan. You receive raw data from 5 sources: social media posts, weather alerts, traffic reports, emergency calls, and IoT sensors (water level / temperature).

Your job:
1. Cross-reference signals across ALL 5 sources to find corroborated anomalies
2. Score credibility: social mention_velocity (high = credible surge), geolocation_confidence, sensor threshold_exceeded
3. Detect contradictions: e.g. flood claim with no rain AND no high water-level sensor = low confidence
4. Assess urgency based on language intensity, call frequency, and sensor severity
5. Flag suspicious, low-confidence, or contradictory signals
6. Only raise an anomaly if at least 2 independent sources corroborate it

Output a list of detected anomalies. If no anomalies found, output an empty list."""),
        ("user", "Raw signals from 5 sources:\n{signals}")
    ])

    structured_llm = llm.with_structured_output(FusedAnomalyList)
    chain = prompt | structured_llm
    result = chain.invoke({"signals": signals_text})
    anomalies = result.anomalies

    anomaly_dicts = [a.model_dump() for a in anomalies]

    t = trace("FusionTriageAgent", "signal_fusion",
        f"Ingested {len(social)} social, {len(weather)} weather, {len(traffic)} traffic, {len(calls)} emergency calls, {len(sensors)} sensors",
        f"Cross-referenced 5 sources. Found {len(anomalies)} anomalies. "
        + (f"Contradictions: {sum(1 for a in anomalies if a.contradiction_flag)}" if anomalies else "No anomalies."),
        f"Forward {len(anomalies)} anomalies to Crisis Analyst",
        "LLM-based multi-source fusion (social+weather+traffic+calls+sensors) with credibility scoring",
        f"{len(anomalies)} anomalies detected")




    return {
        "raw_signals": raw,
        "fused_anomalies": anomaly_dicts,
        "trace_logs": [t],
    }

# ─────────────────────────────────────────────
# NODE 2: Crisis Analyst (LLM Classification)
# ─────────────────────────────────────────────
def analyst_node(state: CrisisState) -> dict:
    print("\n═══ [AGENT: Crisis Analyst] ═══")
    set_status("CrisisAnalystAgent", "🧠 Classifying anomalies with LLM reasoning...", state.get("cycle", 0))

    anomalies = state.get("fused_anomalies", [])
    if not anomalies:
        t = trace("CrisisAnalystAgent", "skip", "No anomalies received",
                  "Nothing to classify", "Skip classification", "No action", "Idle")
        return {"classified_crises": [], "trace_logs": [t]}

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a crisis classification expert for Islamabad, Pakistan.
Given anomalies detected from multi-source fusion, classify each into a structured crisis.

Population estimates: G-10: 45000, G-9: 38000, F-8: 52000, F-7: 40000, I-8: 35000, F-6: 30000.

Crisis types: flood, heatwave, accident, infrastructure, power_outage, protest, disease_cluster.
Severity levels: Low, Medium, High, Critical.

Provide detailed reasoning for each classification including why you chose the severity, what evidence supports it, and how you expect it to evolve."""),
        ("user", "Detected anomalies:\n{anomalies}")
    ])

    structured_llm = llm.with_structured_output(CrisisClassificationList)
    chain = prompt | structured_llm
    result = chain.invoke({"anomalies": json.dumps(anomalies, indent=2)})
    classifications = result.classifications

    crises = []
    for c in classifications:
        crisis = {
            "id": str(uuid.uuid4()),
            "title": f"{c.crisis_type.replace('_', ' ').title()} — {c.location}",
            "description": c.reasoning,
            "crisis_type": c.crisis_type,
            "severity": c.severity,
            "confidence": round(c.confidence_score / 100, 2),
            "location": c.location,
            "status": "Active",
            "affected_population": c.affected_population,
            "expected_duration_hours": c.expected_duration_hours,
            "affected_radius_km": c.affected_radius_km,
            "peak_impact_time": datetime.now().replace(minute=0, second=0).isoformat(),
            "spread_risk": c.spread_risk,
            "uncertainty_range": f"±{100 - c.confidence_score}%",
            "likely_evolution": c.likely_evolution,
            "resources_allocated": [],
            "timestamp": datetime.now().isoformat(),
        }
        crises.append(crisis)

        t = trace("CrisisAnalystAgent", "classify",
            f"Anomaly at {c.location}: confidence {c.confidence_score}%",
            c.reasoning[:200],
            f"Classify as {c.crisis_type} ({c.severity}), pop={c.affected_population}, radius={c.affected_radius_km}km",
            "LLM-powered crisis classification with severity prediction",
            f"Crisis '{crisis['title']}' created (id: {crisis['id'][:8]})")

    return {
        "classified_crises": crises,
        "trace_logs": [trace("CrisisAnalystAgent", "summary",
            f"{len(crises)} crises classified",
            f"Types: {[c['crisis_type'] for c in crises]}",
            "Forward to Resource Commander",
            "Classification complete",
            f"{len(crises)} crises forwarded")],
    }

# ─────────────────────────────────────────────────────────────────────────
# NODE 3: Resource Commander — Advisory Board (Multi-Agent Cognitive Friction)
# working.txt #2: Instead of one LLM deciding resource allocation, three
# sub-agent personas debate before the final structured output is committed.
# ─────────────────────────────────────────────────────────────────────────
def commander_node(state: CrisisState) -> dict:
    print("\n═══ [AGENT: Resource Commander — Advisory Board] ═══")
    set_status("ResourceCommander", "⚡ Advisory Board initiating debate...", state.get("cycle", 0))

    crises = state.get("classified_crises", [])
    if not crises:
        return {"trace_logs": [trace("ResourceCommander", "skip", "No crises", "Nothing to allocate", "Skip", "No action", "Idle")]}

    inventory = state.get("resource_inventory", {})

    # ── Priority Score Matrix (working.txt #3) ──
    # Score = Severity_Multiplier × Affected_Population ÷ ETA_minutes
    # These are LOCKED values — the LLM is NEVER allowed to override them
    SEVERITY_MULTIPLIER = {"Critical": 20, "High": 5, "Medium": 2, "Low": 1}
    eta_map = {}
    eta_minutes_map = {}

    for crisis in crises:
        target_location = crisis["location"] + ", Islamabad, Pakistan"
        eta = get_real_travel_time("PIMS Hospital, Islamabad, Pakistan", target_location)
        eta_map[crisis["id"]] = eta
        print(f"  Live ETA to {target_location}: {eta}")

        eta_mins = 15.0
        try:
            nums = re.findall(r'(\d+)', eta)
            if nums:
                eta_mins = float(nums[0])
                if eta_mins == 0:
                    eta_mins = 1.0
        except:
            pass
        eta_minutes_map[crisis["id"]] = eta_mins

        # Compute and LOCK the Priority Score — the LLM cannot change this
        sev_mult = SEVERITY_MULTIPLIER.get(crisis["severity"], 1)
        population = crisis.get("affected_population", 1000)
        priority_score = round((sev_mult * population) / eta_mins, 1)
        crisis["priority_score"] = priority_score  # locked

        print(f"  Priority Score for {crisis['title']}: {sev_mult} × {population} ÷ {eta_mins} = {priority_score}")

    crises_sorted = sorted(crises, key=lambda c: c.get("priority_score", 0), reverse=True)

    crises_json = json.dumps([{
        "title": c["title"], "crisis_type": c["crisis_type"],
        "severity": c["severity"], "location": c["location"],
        "affected_population": c["affected_population"],
        "priority_score": c.get("priority_score", 0),
        "expected_duration_hours": c.get("expected_duration_hours", 2)
    } for c in crises_sorted], indent=2)
    inventory_json = json.dumps(inventory, indent=2)
    etas_json = json.dumps({eta_map.get(c["id"], "15 mins"): c["title"] for c in crises_sorted})

    # ── SUB-AGENT 1: Field Operations Commander ──────────────────────────
    print("\n  📢 [Advisory Board] Sub-Agent 1: Field Operations Commander...")
    set_status("ResourceCommander", "📢 Field Commander arguing for speed...", state.get("cycle", 0))

    field_prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are the Field Operations Commander for Islamabad Emergency Services. "
            "Your SOLE focus is tactical survival, raw speed, and immediate life-saving. "
            "Pre-computed Priority Scores have already been calculated using: "
            "Score = Severity_Multiplier × Population ÷ ETA  (Critical=20, High=5, Medium=2, Low=1). "
            "Review the active crises. State your AGGRESSIVE tactical dispatch plan — who gets what "
            "resources first and why, referencing the Priority Scores. Be direct. Max 4 sentences."
        )),
        ("user", "Active Crises (with locked Priority Scores):\n{crises}\n\nAvailable Inventory:\n{inventory}\n\nETAs from PIMS Hospital:\n{etas}")
    ])
    field_chain = field_prompt | llm | StrOutputParser()
    field_perspective = field_chain.invoke({
        "crises": crises_json, "inventory": inventory_json, "etas": etas_json
    })
    print(f"\n  📢 [Field Commander]: {field_perspective[:250]}...\n")

    # ── SUB-AGENT 2: Civil Logistics Director ────────────────────────────
    print("  ⚖️ [Advisory Board] Sub-Agent 2: Civil Logistics Director critiquing...")
    set_status("ResourceCommander", "⚖️ Logistics Director reviewing side-effects...", state.get("cycle", 0))

    logistics_prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are the Civil Logistics Director for Islamabad. "
            "Your focus is macro-level coordination, resource conservation, preventing total depletion, "
            "and mitigating dangerous side effects — e.g., leaving a vital sector unprotected, "
            "creating hospital overflow, or generating secondary traffic bottlenecks. "
            "You have seen the Field Commander's aggressive plan. CRITIQUE it. "
            "Identify logistical risks, resource exhaustion bottlenecks, or unintended consequences. "
            "Suggest a more balanced, sustainable alternative. Max 4 sentences."
        )),
        ("user", (
            "Active Crises:\n{crises}\n\n"
            "Available Inventory:\n{inventory}\n\n"
            "Field Commander's Proposal:\n{field_plan}"
        ))
    ])
    logistics_chain = logistics_prompt | llm | StrOutputParser()
    logistics_perspective = logistics_chain.invoke({
        "crises": crises_json, "inventory": inventory_json, "field_plan": field_perspective
    })
    print(f"  ⚖️ [Logistics Director]: {logistics_perspective[:250]}...\n")

    # ── SUB-AGENT 3: Master Synthesizer (Final Structured Output) ────────
    print("  ✅ [Advisory Board] Sub-Agent 3: Master Synthesizer resolving consensus...")
    set_status("ResourceCommander", "✅ Master Synthesizer producing final allocation...", state.get("cycle", 0))

    consensus_prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are the Master Emergency Coordinator for Islamabad. "
            "You have heard the debate between the Field Operations Commander and Civil Logistics Director. "
            "Resolve their conflict using the LOCKED Priority Score values already provided — do NOT recalculate them. "
            "Rules:\n"
            "- priority_score field: copy EXACTLY from the pre-computed values in the crisis data\n"
            "- Allocate highest Priority Score crises first\n"
            "- Never allocate more resources than available in inventory\n"
            "- trade_off_reasoning MUST quote both the Field Commander and the Logistics Director\n"
            "- Synthesize the debate into a single final, mathematically justified allocation plan"
        )),
        ("user", (
            "Active Crises (sorted by Priority Score — USE THESE EXACT SCORES):\n{crises}\n\n"
            "Available Inventory:\n{inventory}\n\n"
            "INTERNAL DEBATE TRANSCRIPT:\n"
            "--- 📢 Field Operations Commander ---\n{field_plan}\n\n"
            "--- ⚖️ Civil Logistics Director ---\n{logistics_plan}"
        ))
    ])
    structured_llm = llm.with_structured_output(ResourceDecisionList)
    consensus_chain = consensus_prompt | structured_llm
    result = consensus_chain.invoke({
        "crises": crises_json, "inventory": inventory_json,
        "field_plan": field_perspective, "logistics_plan": logistics_perspective
    })
    decisions = result.decisions

    # Build debate transcript for trace log
    debate_transcript = (
        f"📢 FIELD OPS COMMANDER:\n{field_perspective}\n\n"
        f"⚖️ CIVIL LOGISTICS DIRECTOR:\n{logistics_perspective}"
    )

    # Apply allocations — ALWAYS use our locked pre-computed scores, NEVER the LLM's score
    for decision in decisions:
        for crisis in crises:
            if decision.crisis_title in crisis["title"] or crisis["title"] in decision.crisis_title:
                crisis["resources_allocated"] = decision.allocated_resources
                decision.priority_score = crisis["priority_score"]  # LOCK: enforce our computed value

                for alloc in decision.allocated_resources:
                    match = re.search(r'(\d+)\s+(.+)', alloc)
                    if match:
                        qty = int(match.group(1))
                        res_name = match.group(2).lower().replace(' ', '_')
                        if not res_name.endswith('s'): res_name += 's'

                        matched_key = None
                        for key in inventory.keys():
                            if res_name in key or key in res_name:
                                inventory[key] = max(0, inventory[key] - qty)
                                matched_key = key
                                break

                        # ── Resource Lifecycle TTL ──
                        duration_hours = crisis.get("expected_duration_hours", 2)
                        ttl_minutes = max(1.0, duration_hours * 0.25)
                        alloc_data = {
                            "id": str(uuid.uuid4()),
                            "crisis_id": crisis["id"],
                            "crisis_title": crisis["title"],
                            "resource_type": matched_key or res_name,
                            "quantity": qty,
                            "allocated_at": datetime.now().isoformat(),
                            "release_at": (datetime.now() + timedelta(minutes=ttl_minutes)).isoformat(),
                            "status": "active"
                        }
                        api_post("resource_allocations", alloc_data)
                break

    # Sync depleted inventory to server
    try:
        requests.put(f"{API}/resources", json=inventory, timeout=5)
    except:
        pass

    # Post traces with full debate transcript visible to judges
    for decision in decisions:
        trace("ResourceCommander", "advisory_board_consensus",
            f"Crisis: {decision.crisis_title} | Score: {decision.priority_score}",
            f"DEBATE:\n{debate_transcript[:500]}\n\nCONSENSUS: {decision.trade_off_reasoning[:200]}",
            f"Allocate: {decision.allocated_resources}" +
            (f" | DENIED: {decision.denied_resources}" if decision.denied_resources else ""),
            "Advisory Board: Field Commander ↔ Logistics Director → Master Synthesizer",
            f"Consensus reached. Score locked at {decision.priority_score}")

    return {
        "classified_crises": crises,
        "trace_logs": [trace("ResourceCommander", "advisory_board_summary",
            f"Advisory Board resolved allocation for {len(crises)} crises",
            f"3-persona debate complete. Locked scores: {[c.get('priority_score', 0) for c in crises]}",
            "Forward to Execution Agent",
            "Multi-Agent Cognitive Friction complete (Field Cmdr ↔ Logistics Dir → Synthesizer)",
            "Resources distributed via Advisory Board consensus")],
    }


# ─────────────────────────────────────────────
# NODE 4: Execution (Impact Simulation via LLM)
# ─────────────────────────────────────────────
def execution_node(state: CrisisState) -> dict:
    print("\n═══ [AGENT: Execution & Impact Simulation] ═══")
    set_status("ExecutionAgent", "🎯 Simulating impact of response actions...", state.get("cycle", 0))

    crises = state.get("classified_crises", [])
    if not crises:
        return {"trace_logs": [trace("ExecutionAgent", "skip", "No crises", "Nothing to execute", "Skip", "No action", "Idle")]}

    # Push crises to API
    existing = api_get("active_crises")
    existing_locs = {e.get("location", "") + e.get("crisis_type", "") for e in existing}

    sims_all = []
    for crisis in crises:
        key = crisis["location"] + crisis["crisis_type"]
        if key in existing_locs:
            continue
        api_post("active_crises", crisis)

        # LLM impact simulation
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a crisis response simulator. For the given crisis and allocated resources, simulate the impact of response actions.

For each action, provide:
- What the situation looks like BEFORE the action
- The response action taken
- Expected state AFTER the action
- How much faster the response is compared to no-action baseline
- Impact on traffic/congestion
- Resource cost
- Possible side effects or unintended consequences

Be specific and realistic for Islamabad, Pakistan."""),
            ("user", "Crisis: {crisis}\nAllocated resources: {resources}")
        ])

        structured_llm = llm.with_structured_output(ImpactSimList)
        chain = prompt | structured_llm
        result = chain.invoke({
            "crisis": json.dumps({"title": crisis["title"], "type": crisis["crisis_type"],
                                  "severity": crisis["severity"], "location": crisis["location"],
                                  "population": crisis["affected_population"]}, indent=2),
            "resources": json.dumps(crisis["resources_allocated"])
        })
        sims = result.simulations

        for sim in sims:
            sim_dict = {
                "id": str(uuid.uuid4()),
                "crisis_id": crisis["id"],
                "before_state": {"description": sim.before_state},
                "response_action": sim.response_action,
                "expected_after_state": {"description": sim.expected_after_state},
                "response_time_improvement": sim.response_time_improvement,
                "congestion_impact": sim.congestion_impact,
                "resource_cost": sim.resource_cost,
                "possible_side_effects": sim.possible_side_effects,
                "timestamp": datetime.now().isoformat()
            }
            api_post("impact_simulations", sim_dict)
            sims_all.append(sim_dict)

        trace("ExecutionAgent", "simulate",
              f"Crisis: {crisis['title']}",
              f"Generated {len(sims)} impact simulations",
              f"Execute response actions for {crisis['location']}",
              "LLM-powered impact simulation with before/after states",
              f"{len(sims)} simulations created")

    return {
        "impact_simulations": sims_all,
        "trace_logs": [trace("ExecutionAgent", "summary",
            f"Executed {len(crises)} crises",
            f"Total simulations: {len(sims_all)}",
            "Forward to Stakeholder Notification",
            "Execution complete",
            f"{len(sims_all)} impact simulations pushed to API")],
    }

# ─────────────────────────────────────────────
# NODE 5: Stakeholder Notifications (LLM)
# ─────────────────────────────────────────────
def notification_node(state: CrisisState) -> dict:
    print("\n═══ [AGENT: Stakeholder Notification] ═══")
    set_status("NotificationAgent", "📨 Generating stakeholder messages via LLM...", state.get("cycle", 0))

    crises = state.get("classified_crises", [])
    if not crises:
        return {"trace_logs": [trace("NotificationAgent", "skip", "No crises", "Nothing to notify", "Skip", "No action", "Idle")]}

    all_notifs = []
    for crisis in crises:
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a crisis communications expert. Generate tailored notification messages for 6 different audiences about this crisis.

Each message should be appropriate for its audience:
- PUBLIC: Clear, calm, actionable instructions. No jargon.
- EMERGENCY SERVICES: Technical, dispatch-ready with specifics.
- HOSPITALS: Medical preparation focus, expected casualties.
- UTILITY COMPANIES: Infrastructure impact, repair coordination.
- TRANSPORT AUTHORITY: Traffic rerouting, road closures.
- MEDIA/COMMAND CENTER: Factual briefing with statistics.

Be specific to the crisis details provided."""),
            ("user", "Crisis details:\n{crisis}")
        ])

        structured_llm = llm.with_structured_output(StakeholderMessages)
        chain = prompt | structured_llm
        msgs = chain.invoke({
            "crisis": json.dumps({"title": crisis["title"], "type": crisis["crisis_type"],
                                  "severity": crisis["severity"], "location": crisis["location"],
                                  "population": crisis["affected_population"],
                                  "resources": crisis["resources_allocated"],
                                  "duration": crisis["expected_duration_hours"]}, indent=2)
        })

        audiences = {
            "public": msgs.public_alert,
            "emergency_services": msgs.emergency_services_dispatch,
            "hospitals": msgs.hospital_advisory,
            "utility_companies": msgs.utility_notice,
            "transport_authority": msgs.transport_alert,
            "media_command_center": msgs.media_brief,
        }

        for audience, message in audiences.items():
            n = {
                "id": str(uuid.uuid4()), "crisis_id": crisis["id"],
                "audience": audience, "message": message,
                "priority": "Urgent" if crisis["severity"] in ("Critical", "High") else "Normal",
                "timestamp": datetime.now().isoformat()
            }
            api_post("notifications", n)
            all_notifs.append(n)

        trace("NotificationAgent", "notify",
              f"Crisis: {crisis['title']}",
              "Generated tailored messages for 6 audiences using LLM",
              f"Notify all stakeholders about {crisis['crisis_type']} at {crisis['location']}",
              "LLM-powered stakeholder communication",
              "6 notifications sent")

    return {
        "notifications": all_notifs,
        "trace_logs": [trace("NotificationAgent", "summary",
            f"Notified stakeholders for {len(crises)} crises",
            f"Total messages: {len(all_notifs)}",
            "All stakeholders notified",
            "Notification complete",
            f"{len(all_notifs)} messages pushed to API")],
    }

# ─────────────────────────────────────────────
# NODE 6: Verifier (False Positive Recovery)
# ─────────────────────────────────────────────
def verifier_node(state: CrisisState) -> dict:
    print("\n═══ [AGENT: Verifier] ═══")
    set_status("VerifierAgent", "🔎 Checking field reports for false positives...", state.get("cycle", 0))

    reports = api_get("field_reports")
    crises = api_get("active_crises")

    if not reports:
        t = trace("VerifierAgent", "check", "No field reports",
                  "No contradictions to verify", "Skip verification", "No action", "Clean")
        return {"trace_logs": [t]}

    unverified = [r for r in reports if not r.get("verified") and r.get("contradicts_crisis_id")]
    if not unverified:
        t = trace("VerifierAgent", "check", f"{len(reports)} reports, all verified or non-contradictory",
                  "Nothing to verify", "Skip", "No action", "Clean")
        return {"trace_logs": [t]}

    # Track which crises were retracted so the rollback node can free resources
    retracted_ids = []
    for report in unverified:
        contra_id = report["contradicts_crisis_id"]
        target = next((c for c in crises if c["id"] == contra_id), None)
        if not target:
            continue

        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a crisis verification agent. A field report has arrived that contradicts an active crisis alert.

Analyze both the original crisis classification and the field report. Determine:
1. Is the original crisis a false positive?
2. What is the corrected classification?
3. Draft a public retraction/correction message if needed.

Be thorough in your reasoning."""),
            ("user", "Original crisis:\n{crisis}\n\nField report:\n{report}")
        ])

        structured_llm = llm.with_structured_output(VerificationResult)
        chain = prompt | structured_llm
        result = chain.invoke({
            "crisis": json.dumps(target, indent=2, default=str),
            "report": json.dumps(report, indent=2)
        })

        if result.is_false_positive:
            retracted_ids.append(contra_id)
            # Retract the crisis
            try:
                requests.delete(f"{API}/active_crises/{contra_id}", timeout=5)
            except:
                pass

            # Send correction notification
            retraction = {
                "id": str(uuid.uuid4()), "crisis_id": contra_id,
                "audience": "public", "message": result.retraction_message,
                "priority": "Urgent", "timestamp": datetime.now().isoformat()
            }
            api_post("notifications", retraction)

            trace("VerifierAgent", "retract_false_positive",
                  f"Field report contradicts crisis {contra_id[:8]}",
                  result.reasoning[:300],
                  f"RETRACT crisis. Corrected: {result.corrected_classification}",
                  "LLM-powered verification and retraction",
                  f"Crisis {contra_id[:8]} retracted — routing to Resource Rollback")
        else:
            trace("VerifierAgent", "confirm",
                  f"Field report reviewed for crisis {contra_id[:8]}",
                  result.reasoning[:300],
                  "Crisis confirmed valid, no retraction needed",
                  "LLM-powered verification",
                  "Crisis remains active")

    return {
        "false_positive_ids": retracted_ids,
        "trace_logs": [trace("VerifierAgent", "summary",
            f"Verified {len(unverified)} field reports",
            f"False positives retracted: {len(retracted_ids)}",
            "Verification complete",
            "All reports processed",
            f"{len(retracted_ids)} retractions issued")],
    }

# ─────────────────────────────────────────────
# NODE 7: Rollback (Resource De-allocation on False Positive)
# ─────────────────────────────────────────────
def rollback_node(state: CrisisState) -> dict:
    """Adapts: frees up resources that were allocated to retracted false-positive crises."""
    print("\n╔═══ [AGENT: Rollback — FALSE POSITIVE RECOVERY] ═══")
    set_status("RollbackAgent", "♻️ De-allocating resources from retracted crises...", state.get("cycle", 0))

    retracted = state.get("false_positive_ids", [])
    inventory = api_get("resources") or {}
    crises = state.get("classified_crises", [])

    freed_resources = []
    for crisis_id in retracted:
        # Find the retracted crisis in our local state to know what was allocated
        retracted_crisis = next((c for c in crises if c["id"] == crisis_id), None)
        if not retracted_crisis:
            continue
        allocated = retracted_crisis.get("resources_allocated", [])
        freed_resources.extend(allocated)

        # Parse and return resources to inventory
        for res_str in allocated:
            parts = res_str.lower().split()
            try:
                count = int(parts[0])
            except (ValueError, IndexError):
                count = 1
            if "ambulance" in res_str.lower():
                inventory["ambulances"] = inventory.get("ambulances", 0) + count
            elif "police" in res_str.lower():
                inventory["police_units"] = inventory.get("police_units", 0) + count
            elif "rescue" in res_str.lower():
                inventory["rescue_teams"] = inventory.get("rescue_teams", 0) + count
            elif "shelter" in res_str.lower():
                inventory["shelters"] = inventory.get("shelters", 0) + count
            elif "generator" in res_str.lower():
                inventory["generators"] = inventory.get("generators", 0) + count
            elif "tanker" in res_str.lower() or "water" in res_str.lower():
                inventory["water_tankers"] = inventory.get("water_tankers", 0) + count
            elif "field" in res_str.lower():
                inventory["field_teams"] = inventory.get("field_teams", 0) + count
            elif "drone" in res_str.lower():
                inventory["drones"] = inventory.get("drones", 0) + count

    # Push updated inventory back to API
    try:
        requests.put(f"{API}/resources", json=inventory, timeout=5)
    except:
        pass

    t = trace("RollbackAgent", "deallocate",
          f"{len(retracted)} false-positive crises confirmed by Verifier",
          f"Resources tied to retracted crises must be freed to avoid waste",
          f"De-allocate: {freed_resources}",
          "Parsed resource strings, incremented inventory counters",
          f"Resources freed. Inventory updated. System adapted.")

    print(f"  [ROLLBACK] Freed {len(freed_resources)} resource assignments from {len(retracted)} false positives")
    return {"trace_logs": [t]}

# ─────────────────────────────────────────────
# Build LangGraph
# ─────────────────────────────────────────────
workflow = StateGraph(CrisisState)

workflow.add_node("Fusion", fusion_node)
workflow.add_node("Analyst", analyst_node)
workflow.add_node("Commander", commander_node)
workflow.add_node("Execution", execution_node)
workflow.add_node("Notification", notification_node)
workflow.add_node("Verifier", verifier_node)
workflow.add_node("Rollback", rollback_node)

workflow.set_entry_point("Fusion")
workflow.add_edge("Fusion", "Analyst")
workflow.add_edge("Analyst", "Commander")
workflow.add_edge("Commander", "Execution")
workflow.add_edge("Execution", "Notification")
workflow.add_edge("Notification", "Verifier")
workflow.add_edge("Rollback", END)

def route_after_verify(state: CrisisState) -> str:
    if state.get("false_positive_ids"):
        print(f"  [GRAPH] False positive detected — routing to Rollback node")
        return "rollback"
    return "end"

workflow.add_conditional_edges(
    "Verifier",
    route_after_verify,
    {"rollback": "Rollback", "end": END}
)

graph = workflow.compile()

# ─────────────────────────────────────────────────────────────────────────────
# MASTER ORCHESTRATOR
# ─────────────────────────────────────────────────────────────────────────────
# Architecture:
#
#   ┌─────────────────────────────────────────────┐
#   │         MASTER ORCHESTRATOR (always on)      │
#   │  • Runs in its own thread, never stops       │
#   │  • Polls 5 signal sources every 5 seconds    │
#   │  • Uses Fusion Agent logic to check for new  │
#   │    anomalies (lightweight LLM call)           │
#   │                                              │
#   │  if anomalies detected:                      │
#   │    → dispatch full LangGraph pipeline        │
#   │       (Analyst → Commander → Execution →     │
#   │        Notification → Verifier → Rollback?)  │
#   │                                              │
#   │  if nothing new:                             │
#   │    → stay idle, keep polling                 │
#   └─────────────────────────────────────────────┘
#
# This is the correct "master agent" architecture:
#   - Fusion/Triage is the always-on sensor/watchdog
#   - Full pipeline only fires when warranted
#   - No wasted LLM calls or resource allocation runs
#   - True continuous intelligence, not batch processing
# ─────────────────────────────────────────────────────────────────────────────

import threading

class MasterOrchestrator:
    """
    The always-running master agent that continuously monitors signal sources
    and dispatches the full LangGraph pipeline only when new anomalies are detected.
    """
    POLL_INTERVAL_SECONDS = 5   # how often to check signals (tight loop)
    MIN_PIPELINE_GAP = 30       # min seconds between full pipeline runs (avoid thrash)

    def __init__(self):
        self.cycle = 0
        self.last_pipeline_run = 0.0   # timestamp of last full pipeline dispatch
        self.fp_injected = False       # false positive demo: inject only once
        self.state: CrisisState = {
            "raw_signals": {},
            "fused_anomalies": [],
            "classified_crises": [],
            "resource_inventory": {
                "ambulances": 5, "police_units": 4, "rescue_teams": 3,
                "shelters": 2, "generators": 3, "water_tankers": 2,
                "field_teams": 4, "drones": 2
            },
            "impact_simulations": [],
            "notifications": [],
            "trace_logs": [],
            "field_reports": [],
            "cycle": 0,
            "false_positive_ids": [],
        }
        self._stop_event = threading.Event()

    # ── Lightweight signal poll (no full pipeline) ──────────────────────────
    def _quick_scan(self) -> list:
        """
        Runs ONLY the Fusion Agent logic to check if new anomalies exist.
        Returns list of anomalies. Empty list = nothing to act on.
        """
        set_status("MasterOrchestrator", "👁 Scanning signals...", self.cycle)

        social  = api_get("social")
        weather = api_get("weather")
        traffic = api_get("traffic")
        calls   = api_get("emergency_calls")
        sensors = api_get("sensors")

        raw = {"social": social, "weather": weather, "traffic": traffic,
               "emergency_calls": calls, "sensors": sensors}
        signals_text = json.dumps(raw, indent=2, default=str)[:5000]

        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a crisis watchdog for Islamabad. Scan the incoming signals from 5 sources.
Only report anomalies if AT LEAST 2 independent sources corroborate the same incident.
Score credibility using mention_velocity (high = real surge), sensor threshold_exceeded, and weather severity.
If no corroborated anomalies exist, return an empty list.
This is a lightweight scan — be conservative, only flag clear incidents."""),
            ("user", "Live signals:\n{signals}")
        ])

        try:
            structured_llm = llm.with_structured_output(FusedAnomalyList)
            chain = prompt | structured_llm
            result = chain.invoke({"signals": signals_text})
            return result.anomalies
        except Exception as e:
            print(f"  [MASTER] Quick scan error: {e}")
            return []

    # ── Full pipeline dispatch ───────────────────────────────────────────────
    def _dispatch_pipeline(self):
        """Runs the full 7-agent LangGraph pipeline."""
        self.cycle += 1
        now = time.time()
        self.last_pipeline_run = now

        print(f"\n{'═'*60}")
        print(f"  [MASTER] 🚨 Anomalies detected → Dispatching Full Pipeline (Cycle {self.cycle})")
        print(f"{'═'*60}")

        self.state["cycle"] = self.cycle
        self.state["fused_anomalies"] = []
        self.state["classified_crises"] = []
        self.state["false_positive_ids"] = []

        self.state = graph.invoke(self.state)
        set_status("MasterOrchestrator", f"✅ Cycle {self.cycle} complete. Resuming watch...", self.cycle)

        # ── After Cycle 1: inject false positive field report once ──
        if self.cycle == 1 and not self.fp_injected:
            time.sleep(2)
            self._inject_false_positive()

    def _verify_only(self):
        """
        Verification-only run: skips Fusion→Analyst→Commander→Execution→Notification.
        Runs ONLY Verifier + Rollback using currently active crises on the server.
        Called when a field_report triggers the pipeline — no need to re-detect or re-allocate.
        """
        self.cycle += 1
        print(f"\n{'─'*60}")
        print(f"  [MASTER] 🔍 Verification-only run (Cycle {self.cycle}) — field report received")
        print(f"{'─'*60}")

        # Fetch real active crises from server (use their real IDs, not re-classified ones)
        crises_on_server = api_get("active_crises")
        if not crises_on_server:
            print("  [MASTER] No active crises to verify against.")
            return

        # Build minimal state for verification nodes
        verify_state: CrisisState = {
            **self.state,
            "classified_crises": crises_on_server,
            "false_positive_ids": [],
            "cycle": self.cycle,
        }

        # Run verifier node
        verifier_result = verifier_node(verify_state)
        verify_state.update(verifier_result)

        if verify_state.get("false_positive_ids"):
            print(f"  [MASTER] ♻️ False positives confirmed: {verify_state['false_positive_ids']}")
            rollback_result = rollback_node(verify_state)
            verify_state.update(rollback_result)

        set_status("MasterOrchestrator", f"✅ Verification Cycle {self.cycle} complete.", self.cycle)
        self.state = verify_state

    def _inject_false_positive(self):
        """Injects contradictory field report to demo rollback capability."""
        print(f"\n{'─'*60}")
        print("  [MASTER] 🔍 Injecting false-positive field report for verification demo")
        print(f"{'─'*60}")

        active = api_get("active_crises")
        flood_crisis = next((c for c in active if "flood" in c.get("crisis_type", "").lower()), None)

        if flood_crisis:
            report = {
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now().isoformat(),
                "location": flood_crisis["location"],
                "reporter": "Field Engineer — WASA",
                "description": (
                    "No flooding found at the reported location. Root cause is a "
                    "broken water main on Street 47. Repair crew has been dispatched. "
                    "Water levels are receding and pose no threat to residents."
                ),
                "contradicts_crisis_id": flood_crisis["id"],
                "verified": False,
            }
            api_post("field_reports", report)
            print(f"  [MASTER] Field report injected → Verifier will review on next cycle")
            self.fp_injected = True
        else:
            print("  [MASTER] No flood crisis found to contradict.")

    # ── Main loop ────────────────────────────────────────────────────────────
    def run(self):
        print("=" * 60)
        print("  CIRO – Master Orchestrator STARTED")
        print("  Powered by Groq LLM (Llama 3.3 70B) + LangGraph")
        print(f"  Polling every {self.POLL_INTERVAL_SECONDS}s | Pipeline gap: {self.MIN_PIPELINE_GAP}s")
        print("=" * 60)
        print("  Architecture: MasterOrchestrator → watches always")
        print("                 → dispatches 7-agent pipeline only on new anomalies")
        print("=" * 60)

        while not self._stop_event.is_set():
            now = time.time()
            time_since_last = now - self.last_pipeline_run
            can_dispatch = time_since_last >= self.MIN_PIPELINE_GAP or self.last_pipeline_run == 0.0

            # Always run the lightweight quick scan
            anomalies = self._quick_scan()

            if anomalies and can_dispatch:
                print(f"  [MASTER] ✅ {len(anomalies)} anomaly(s) confirmed → firing pipeline")
                self._dispatch_pipeline()
            elif anomalies and not can_dispatch:
                remaining = int(self.MIN_PIPELINE_GAP - time_since_last)
                print(f"  [MASTER] ⏳ Anomalies seen but pipeline cooldown: {remaining}s remaining")
                set_status("MasterOrchestrator",
                           f"👁 Watching... anomalies present, cooldown {remaining}s", self.cycle)
            else:
                print(f"  [MASTER] 🟢 No new anomalies. Staying alert...")
                set_status("MasterOrchestrator",
                           "🟢 All clear — continuously monitoring 5 sources...", self.cycle)

            # Wait before next scan
            self._stop_event.wait(timeout=self.POLL_INTERVAL_SECONDS)

    def stop(self):
        self._stop_event.set()


# ─────────────────────────────────────────────────────────────────────────────
# EVENT-DRIVEN ENTRY POINT (working.txt #2)
# Called by main.py's spike detection via BackgroundTasks
# ─────────────────────────────────────────────────────────────────────────────
_event_driven_orchestrator = None

def run_pipeline_once(trigger_source: str = "manual", trigger_detail: str = ""):
    """
    Event-driven entry point. Routes based on trigger source:
    - 'field_report': verification-only path (Verifier + Rollback only)
    - all others: full 7-agent pipeline (Fusion → ... → Verifier)
    """
    global _event_driven_orchestrator
    if _event_driven_orchestrator is None:
        _event_driven_orchestrator = MasterOrchestrator()

    orch = _event_driven_orchestrator
    print(f"\n{'═'*60}")
    print(f"  [EVENT-DRIVEN] Pipeline triggered by: {trigger_source}")
    print(f"  Detail: {trigger_detail}")
    print(f"{'═'*60}")

    if trigger_source == "field_report":
        # Skip Fusion/Analyst/Commander/Execution/Notification — go straight to Verifier+Rollback
        orch._verify_only()
    else:
        # Refresh resource inventory from server before dispatching full pipeline
        # (ensures Cycle 2 sees depleted counts from Cycle 1, not stale state)
        try:
            r = requests.get(f"{API}/resources", timeout=5)
            if r.status_code == 200:
                orch.state["resource_inventory"] = r.json()
        except:
            pass
        orch._dispatch_pipeline()


if __name__ == "__main__":
    orchestrator = MasterOrchestrator()
    try:
        orchestrator.run()
    except KeyboardInterrupt:
        print("\n  [MASTER] Shutting down gracefully...")
        orchestrator.stop()
