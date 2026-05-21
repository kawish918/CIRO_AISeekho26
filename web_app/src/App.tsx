import { useEffect, useState } from 'react';
import AgentFlow from './components/AgentFlow';
import Map from './components/Map';
import { 
  AlertTriangle, Package, MessageSquare, RefreshCw, 
  Map as MapIcon, Settings, Compass, 
  Sparkles, Terminal, X, Play, ShieldAlert, Wifi, WifiOff 
} from 'lucide-react';


// Automatically detect host or fallback to Cloud Run live API
const getDefaultApiUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000/api';
    }
  }
  return 'https://ciro-backend-720063557968.us-central1.run.app/api';
};

const CRISIS_ICONS: Record<string, string> = {
  flood: '🌊', heatwave: '🔥', accident: '🚗', infrastructure: '🏗️',
  power_outage: '⚡', protest: '📢', disease_cluster: '🦠', unknown: '⚠️',
};

const RES_ICONS: Record<string, string> = {
  ambulances: '🚑', police_units: '🚔', rescue_teams: '🛟', shelters: '🏠',
  generators: '⚡', water_tankers: '💧', field_teams: '👷', drones: '🛸',
};

const RES_MAX: Record<string, number> = {
  ambulances: 5, police_units: 4, rescue_teams: 3, shelters: 2,
  generators: 3, water_tankers: 2, field_teams: 4, drones: 2,
};

const AGENT_META: Record<string, { label: string; icon: string; color: string }> = {
  MasterOrchestrator: { label: 'Orchestrator', icon: '🛰️', color: '#0F766E' },
  FusionTriageAgent:  { label: 'Fusion', icon: '📡', color: '#4F46E5' },
  CrisisAnalystAgent: { label: 'Analyst', icon: '🧠', color: '#D97706' },
  ResourceCommander:  { label: 'Advisory Board', icon: '⚡', color: '#059669' },
  FieldCommander:     { label: 'Field Commander', icon: '📢', color: '#B45309' },
  LogisticsDirector:  { label: 'Logistics Director', icon: '⚖️', color: '#6D28D9' },
  ExecutionAgent:     { label: 'Execution', icon: '🎯', color: '#7C3AED' },
  NotificationAgent:  { label: 'Notify', icon: '📨', color: '#DB2777' },
  VerifierAgent:      { label: 'Verifier', icon: '🔎', color: '#DC2626' },
  RollbackAgent:      { label: 'Rollback', icon: '♻️', color: '#EA580C' },
  ResourceMonitor:    { label: 'TTL Monitor', icon: '⏱️', color: '#0891B2' },
};

function formatCountdown(releaseAt: string): string {
  try {
    const diff = new Date(releaseAt).getTime() - Date.now();
    if (diff <= 0) return 'Releasing...';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  } catch {
    return '--:--';
  }
}

export default function App() {
  const [apiUrl, setApiUrl] = useState(() => {
    return localStorage.getItem('ciro_api_url') || getDefaultApiUrl();
  });
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'traces'>('dashboard');
  const [selectedCrisis, setSelectedCrisis] = useState<any | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, setTick] = useState(0);

  // Aggregated data state
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [outages, setOutages] = useState<Record<string, boolean>>({ weather: false, traffic: false });

  // Traces scroll/history state
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);
  const [traceFilter, setTraceFilter] = useState<string>('all');


  // Poll aggregated dashboard endpoint
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [dashRes, outageRes] = await Promise.all([
          fetch(`${apiUrl}/dashboard`),
          fetch(`${apiUrl}/outage_status`),
        ]);
        if (dashRes.ok && outageRes.ok) {
          const dashJson = await dashRes.json();
          const outageJson = await outageRes.json();
          setDashboardData(dashJson);
          setOutages(outageJson);
          setConnected(true);
        } else {
          setConnected(false);
        }
      } catch {
        setConnected(false);
      }
    };

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 2000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  // Tick interval for resource countdown timers
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update localStorage when apiUrl changes
  const handleApiUrlChange = (newUrl: string) => {
    setApiUrl(newUrl);
    localStorage.setItem('ciro_api_url', newUrl);
  };

  const triggerPipeline = async () => {
    setLoading(true);
    try {
      await fetch(`${apiUrl}/trigger_pipeline`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => setLoading(false), 800);
  };

  const toggleOutage = async () => {
    const active = outages.weather || outages.traffic;
    try {
      if (active) {
        await fetch(`${apiUrl}/clear_outage`, { method: 'POST' });
      } else {
        await fetch(`${apiUrl}/trigger_outage`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(['weather', 'traffic'])
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const injectWasaFieldReport = async () => {
    const crisesList = dashboardData?.crises || [];
    // Locate active flood crisis or G-10 event
    const floodCrisis = crisesList.find(
      (c: any) => c.location.includes('G-10') || c.crisis_type === 'flood'
    );

    if (!floodCrisis) {
      alert("⚠️ Injection requires an active G-10 Flood crisis. Click 'Trigger Pipeline' first to detect the simulation events.");
      return;
    }

    const report = {
      id: `field-${Date.now()}`,
      timestamp: new Date().toISOString(),
      location: 'G-10',
      reporter: 'Field Engineer — WASA',
      description: 'No flooding found. Root cause is a broken water main on Street 47. Repair crew dispatched. Water levels receding, no threat to residents.',
      contradicts_crisis_id: floodCrisis.id,
      verified: false
    };

    try {
      await fetch(`${apiUrl}/field_reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      });
      alert('♻️ WASA field report injected! Skip-routing verification running now. Look at the dashboard/traces tab to observe the rollback.');
    } catch (e) {
      console.error(e);
    }
  };

  // Helper selectors
  const crises = dashboardData?.crises || [];
  const resources = dashboardData?.resources || {};
  const status = dashboardData?.system_status || { active_agent: 'idle', phase: 'Waiting for backend...', cycle: 0 };
  const traces = dashboardData?.agent_traces || [];
  const simulations = dashboardData?.impact_simulations || [];
  const notifications = dashboardData?.notifications || [];
  const allocations = dashboardData?.resource_allocations || [];
  const events = dashboardData?.pipeline_events || [];
  const signalCounts = dashboardData?.signal_counts || { social: 0, weather: 0, traffic: 0, emergency: 0, sensors: 0 };

  const activeOutages = Object.values(outages).some(Boolean);


  const getSeverityClass = (sev: string) => {
    if (sev === 'Critical') return 'badge-critical';
    if (sev === 'High') return 'badge-high';
    if (sev === 'Medium') return 'badge-medium';
    return 'badge-low';
  };

  // Filter traces
  const filteredTraces = traces.filter((t: any) => {
    if (traceFilter === 'all') return true;
    if (traceFilter === 'advisory') return t.agent_name === 'ResourceCommander' || t.agent_name === 'FieldCommander' || t.agent_name === 'LogisticsDirector';
    return t.agent_name === traceFilter;
  });

  // Extract Advisory Board debate transcript for selected crisis
  const getSelectedCrisisDebate = () => {
    if (!selectedCrisis) return null;
    const debateTrace = traces.find(
      (t: any) => t.agent_name === 'ResourceCommander' && 
                 t.step === 'advisory_board_consensus' && 
                 t.observation.includes(selectedCrisis.id)
    );
    if (!debateTrace) {
      // Fallback: match by title
      const alternativeTrace = traces.find(
        (t: any) => t.agent_name === 'ResourceCommander' && 
                   t.step === 'advisory_board_consensus' && 
                   t.observation.toLowerCase().includes(selectedCrisis.location.toLowerCase())
      );
      return alternativeTrace ? alternativeTrace.reasoning : null;
    }
    return debateTrace.reasoning;
  };

  // Parse debate text into speaker segments
  const parseDebateSpeech = (reasoningText: string) => {
    if (!reasoningText) return [];
    
    // Find text between FIELD OPS COMMANDER and CIVIL LOGISTICS DIRECTOR
    const commanderTag = '📢 FIELD OPS COMMANDER:';
    const directorTag = '⚖️ CIVIL LOGISTICS DIRECTOR:';
    const consensusTag = '\n\nCONSENSUS:';
    
    let commanderText = '';
    let directorText = '';
    let consensusText = '';

    const cmdIdx = reasoningText.indexOf(commanderTag);
    const dirIdx = reasoningText.indexOf(directorTag);
    const conIdx = reasoningText.indexOf(consensusTag);

    if (cmdIdx !== -1 && dirIdx !== -1) {
      commanderText = reasoningText.substring(cmdIdx + commanderTag.length, dirIdx).trim();
      if (conIdx !== -1) {
        directorText = reasoningText.substring(dirIdx + directorTag.length, conIdx).trim();
        consensusText = reasoningText.substring(conIdx + consensusTag.length).trim();
      } else {
        directorText = reasoningText.substring(dirIdx + directorTag.length).trim();
      }
    } else {
      // fallback
      return [{ speaker: 'System Consensus', text: reasoningText, color: '#8b949e' }];

    }

    return [
      { speaker: 'Field Operations Commander 📢', text: commanderText, color: '#B45309' },
      { speaker: 'Civil Logistics Director ⚖️', text: directorText, color: '#6D28D9' },
      { speaker: 'Synthesizer Consensus ✅', text: consensusText, color: '#34d399' }
    ];
  };

  const debateSegments = parseDebateSpeech(getSelectedCrisisDebate() || '');

  return (
    <div className="app-container">
      {/* ── HEADER ── */}
      <header className="header">
        <div>
          <h1>🛰️ CIRO Mission Control</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Crisis Intelligence & Response Orchestrator — LangGraph × Groq Llama 3.3 70B
          </p>
        </div>

        {/* API connection panel */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.25rem 0.5rem', gap: '0.5rem' }}>
            <Settings size={14} style={{ color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              value={apiUrl} 
              onChange={(e) => handleApiUrlChange(e.target.value)}
              placeholder="API endpoint URL" 
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.75rem', width: '280px', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.85rem', borderRadius: '8px', background: connected ? 'rgba(52,211,153,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${connected ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)'}`, color: connected ? '#34d399' : '#ef4444', fontSize: '0.75rem', fontWeight: 700 }}>
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {connected ? 'ONLINE' : 'OFFLINE'}
          </div>

          {activeOutages && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.85rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: '0.75rem', fontWeight: 700 }}>
              <AlertTriangle size={14} />
              API DEGRADED MODE
            </div>
          )}
        </div>
      </header>

      {/* ── TOOLBAR / CONTROLS ── */}
      <div className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
        <div className="control-grid">
          <button className="control-btn" onClick={triggerPipeline} disabled={loading}>
            <Play size={15} style={{ color: '#34d399' }} />
            {loading ? 'Triggering...' : 'Trigger Pipeline Run'}
          </button>
          
          <button 
            className={`control-btn ${activeOutages ? 'btn-active-outage' : ''}`}
            onClick={toggleOutage}
          >
            <AlertTriangle size={15} />
            {activeOutages ? 'Restore APIs' : 'Simulate API Outage'}
          </button>
          
          <button className="control-btn" onClick={injectWasaFieldReport}>
            <RefreshCw size={15} style={{ color: '#ea580c' }} />
            Inject WASA Field Report
          </button>

          {/* Navigation Tabs */}
          <div className="tabs-navigation" style={{ marginLeft: 'auto' }}>
            <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
              <Compass size={15} />
              Dashboard
            </button>
            <button className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
              <MapIcon size={15} />
              Crisis Map
            </button>
            <button className={`tab-btn ${activeTab === 'traces' ? 'active' : ''}`} onClick={() => setActiveTab('traces')}>
              <Terminal size={15} />
              Agent Log
            </button>
          </div>
        </div>
      </div>

      {/* ── ACTIVE AGENT PROGRESS FLOW ── */}
      <AgentFlow activeAgent={status.active_agent} />

      {/* ── DASHBOARD TAB ── */}
      {activeTab === 'dashboard' && (
        <div className="dashboard-grid">
          {/* LEFT: Stats, Spike Info, Active Crises */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Stats row */}
            <div className="stats-row-alt">
              <div className="stat-card-alt">
                <div className="stat-val-alt" style={{ color: '#ef4444' }}>{crises.length}</div>
                <div className="stat-label-alt">Active Events</div>
              </div>
              <div className="stat-card-alt">
                <div className="stat-val-alt" style={{ color: '#34d399' }}>
                  {Object.values(resources).reduce((a: number, b: any) => a + b, 0)} / {Object.values(RES_MAX).reduce((a, b) => a + b, 0)}
                </div>
                <div className="stat-label-alt">Resource Inventory</div>
              </div>
              <div className="stat-card-alt">
                <div className="stat-val-alt" style={{ color: '#bc8cff' }}>{notifications.length}</div>
                <div className="stat-label-alt">Alerts Tailored</div>
              </div>
            </div>

            {/* Event-driven spike trigger notification banner */}
            {events.length > 0 && (
              <div className="trigger-banner-alt">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Sparkles size={18} style={{ color: '#ea580c' }} />
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Event-Driven Trigger</div>
                    <div style={{ fontSize: '0.85rem', color: '#f0f6fc', marginTop: '0.15rem' }}>
                      <strong>{events[events.length - 1].trigger_source.replace(/_/g, ' ')}</strong>: {events[events.length - 1].trigger_detail}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {new Date(events[events.length - 1].timestamp).toLocaleTimeString()}
                </span>
              </div>
            )}

            {/* Active Crises Panel */}
            <div className="glass-panel">
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                Active Crisis Deployments
              </h2>
              {crises.length === 0 ? (
                <div className="empty-state">
                  <ShieldAlert size={36} style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }} />
                  <p>All sectors normal. CIRO pipeline is idle.</p>
                </div>
              ) : (
                <div className="crisis-cards-list">
                  {crises.map((c: any) => {
                    const sevClass = getSeverityClass(c.severity);
                    const icon = CRISIS_ICONS[c.crisis_type] || '⚠️';
                    return (
                      <div 
                        key={c.id} 
                        className="crisis-item-card" 
                        onClick={() => setSelectedCrisis(c)}
                      >
                        <div className="crisis-top-row">
                          <span className="crisis-type-badge">{icon} {c.crisis_type.replace(/_/g, ' ')}</span>
                          {c.priority_score > 0 && (
                            <span className="priority-score-badge-new">
                              SCORE: {c.priority_score.toFixed(0)}
                            </span>
                          )}
                        </div>
                        <h3 className="crisis-item-title">{c.title}</h3>
                        <div className="crisis-item-meta">
                          📍 {c.location} &nbsp;•&nbsp; Population: {c.affected_population.toLocaleString()} &nbsp;•&nbsp; Confidence: {(c.confidence * 100).toFixed(0)}%
                        </div>
                        <div className="crisis-item-chips">
                          <span className={`badge ${sevClass}`} style={{ fontSize: '0.65rem' }}>{c.severity}</span>
                          <span className="crisis-chip-mini">Duration: {c.expected_duration_hours}h</span>
                          <span className="crisis-chip-mini">Radius: {c.affected_radius_km}km</span>
                          <span className="crisis-chip-mini" style={{ color: c.status === 'Active' ? '#58a6ff' : '#34d399', background: c.status === 'Active' ? 'rgba(88,166,255,0.06)' : 'rgba(52,211,153,0.06)' }}>Status: {c.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ingestion stream counts */}
            <div className="glass-panel" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Ingestion Pipeline:</span>
                <span>📱 Social: {signalCounts.social} &nbsp;|&nbsp; 🌧️ Weather: {signalCounts.weather} &nbsp;|&nbsp; 🚗 Traffic: {signalCounts.traffic} &nbsp;|&nbsp; ☎️ Calls: {signalCounts.emergency} &nbsp;|&nbsp; 📡 Sensors: {signalCounts.sensors}</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Resource Inventory, allocations */}
          <div className="glass-panel">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Package size={18} style={{ color: '#34d399' }} />
              Resource Fleet Inventory
            </h2>
            <div className="resource-summary-panel">
              {[
                { key: 'ambulances', name: 'Ambulances', icon: '🚑' },
                { key: 'police_units', name: 'Police Units', icon: '🚔' },
                { key: 'rescue_teams', name: 'Rescue Teams', icon: '🛟' },
                { key: 'shelters', name: 'Emergency Shelters', icon: '🏠' },
                { key: 'generators', name: 'Mobile Generators', icon: '⚡' },
                { key: 'water_tankers', name: 'Water Tankers', icon: '💧' },
                { key: 'field_teams', name: 'Field Teams', icon: '👷' },
                { key: 'drones', name: 'Surveillance Drones', icon: '🛸' },
              ].map((res) => {
                const count = resources[res.key] ?? 0;
                const max = RES_MAX[res.key] || 5;
                const ratio = max > 0 ? count / max : 0;
                const barColor = ratio === 0 ? '#ef4444' : ratio < 0.5 ? '#f59e0b' : '#10b981';
                
                // Fetch active allocations for this resource type
                const resAllocs = allocations.filter(
                  (a: any) => a.resource_type === res.key && a.status === 'active'
                );

                return (
                  <div key={res.key} className="resource-item-row">
                    <div className="resource-item-header">
                      <span>{res.icon} {res.name}</span>
                      <span style={{ fontFamily: 'JetBrains Mono', color: barColor }}>{count} / {max}</span>
                    </div>
                    <div className="resource-progress-track">
                      <div 
                        className="resource-progress-fill" 
                        style={{ width: `${ratio * 100}%`, backgroundColor: barColor }}
                      ></div>
                    </div>
                    {resAllocs.length > 0 && (
                      <div className="resource-allocations-list">
                        {resAllocs.map((a: any) => (
                          <div key={a.id} className="resource-allocation-mini">
                            <span>⏳</span>
                            <span>{a.quantity} unit{a.quantity > 1 ? 's' : ''} committed to {a.crisis_title.split(' — ')[0]} ({formatCountdown(a.release_at)})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CRISIS MAP TAB ── */}
      {activeTab === 'map' && (
        <Map crises={crises} onSelectCrisis={(c) => setSelectedCrisis(c)} />
      )}

      {/* ── AGENT LOG TAB ── */}
      {activeTab === 'traces' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Agent filter toolbar */}
          <div className="agent-log-bar">
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <Terminal size={16} style={{ color: '#bc8cff' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Agent Traces: {filteredTraces.length}</span>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Filter Agent:</span>
              <select 
                value={traceFilter} 
                onChange={(e) => setTraceFilter(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', borderRadius: '6px', color: '#fff', fontSize: '0.75rem', padding: '0.25rem 0.5rem', outline: 'none' }}
              >
                <option value="all">All Agents</option>
                <option value="MasterOrchestrator">Orchestrator</option>
                <option value="FusionTriageAgent">Fusion & Triage</option>
                <option value="CrisisAnalystAgent">Crisis Analyst</option>
                <option value="advisory">Advisory Board (Commander/Logistics/Synthesizer)</option>
                <option value="ExecutionAgent">Execution Agent</option>
                <option value="NotificationAgent">Notification Agent</option>
                <option value="VerifierAgent">Verifier Agent</option>
                <option value="RollbackAgent">Rollback Agent</option>
                <option value="ResourceMonitor">Resource TTL Monitor</option>
              </select>
            </div>
          </div>

          {/* Trace log cards */}
          {filteredTraces.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <MessageSquare size={36} style={{ margin: '0 auto 0.75rem auto' }} />
              <p>No agent execution traces matching the filter found.</p>
            </div>
          ) : (
            <div className="agent-log-list">
              {filteredTraces.slice().reverse().map((t: any, idx: number) => {
                const agent = AGENT_META[t.agent_name];
                const color = agent?.color || '#8b949e';
                const isExpanded = expandedTrace === `${t.id}-${idx}`;

                return (
                  <div 
                    key={`${t.id}-${idx}`}
                    className="agent-log-card"
                    style={{ borderLeft: `3px solid ${color}` }}
                    onClick={() => setExpandedTrace(isExpanded ? null : `${t.id}-${idx}`)}
                  >
                    <div className="agent-log-header">
                      <span className="agent-badge-chip" style={{ backgroundColor: `${color}15`, color: color }}>
                        {agent?.icon || '🤖'} {agent?.label || t.agent_name}
                      </span>
                      <span className="agent-log-time">
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="agent-log-step">[{t.step}]</div>
                    <div className="agent-log-desc">
                      {t.decision.slice(0, 160)}{t.decision.length > 160 ? '...' : ''}
                    </div>

                    {isExpanded && (
                      <div className="expanded-log-details">
                        <div className="expanded-block-row">
                          <div className="expanded-block-label">👁️ Observation</div>
                          <div className="expanded-block-text">{t.observation}</div>
                        </div>
                        <div className="expanded-block-row">
                          <div className="expanded-block-label">🧠 Reasoning</div>
                          <div className="expanded-block-text" style={{ whiteSpace: 'pre-wrap' }}>{t.reasoning}</div>
                        </div>
                        <div className="expanded-block-row">
                          <div className="expanded-block-label">🎯 Action</div>
                          <div className="expanded-block-text">{t.action}</div>
                        </div>
                        <div className="expanded-block-row">
                          <div className="expanded-block-label">✅ Outcome</div>
                          <div className="expanded-block-text">{t.outcome}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── DETAILS PANEL MODAL (DRAWER) ── */}
      {selectedCrisis && (
        <div className="modal-overlay" onClick={() => setSelectedCrisis(null)}>
          <div className="modal-content-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-alt">
              <span className="crisis-type-badge" style={{ fontSize: '0.8rem' }}>
                {CRISIS_ICONS[selectedCrisis.crisis_type] || '⚠️'} {selectedCrisis.crisis_type.replace(/_/g, ' ')}
              </span>
              <button className="modal-close-btn" onClick={() => setSelectedCrisis(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div>
              <h2 className="modal-title-alt">{selectedCrisis.title}</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>📍 Location: {selectedCrisis.location}</p>
            </div>

            <p className="modal-desc-alt">{selectedCrisis.description}</p>

            <div className="modal-meta-grid">
              <div className="modal-meta-box">
                <div className="modal-meta-label">Severity</div>
                <div className="modal-meta-val" style={{ color: selectedCrisis.severity === 'Critical' ? '#ef4444' : selectedCrisis.severity === 'High' ? '#f59e0b' : '#3b82f6' }}>
                  {selectedCrisis.severity}
                </div>
              </div>
              <div className="modal-meta-box">
                <div className="modal-meta-label">Confidence</div>
                <div className="modal-meta-val" style={{ color: '#bc8cff' }}>
                  {(selectedCrisis.confidence * 100).toFixed(0)}%
                </div>
              </div>
              <div className="modal-meta-box">
                <div className="modal-meta-label">Population</div>
                <div className="modal-meta-val" style={{ color: '#58a6ff' }}>
                  {selectedCrisis.affected_population.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Locked Priority Score explanation */}
            <div className="glass-panel" style={{ background: 'rgba(234, 88, 12, 0.05)', borderColor: 'rgba(234, 88, 12, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase' }}>Locked Priority Score</span>
                <span className="priority-score-badge-new">{selectedCrisis.priority_score.toFixed(1)}</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Computed deterministically in Python to prevent LLM override. Formula:
                <br />
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px', display: 'inline-block', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>
                  Score = (Severity Multiplier × Population) ÷ travel_time_mins
                </code>
                <br />
                Severity Multipliers: Critical = 20, High = 5, Medium = 2, Low = 1.
              </p>
            </div>

            {/* Advisory Board Debate Transcript */}
            {debateSegments.length > 0 ? (
              <div className="debate-box">
                <h4>
                  <ShieldAlert size={16} />
                  Advisory Board Cognitive Friction Debate
                </h4>
                <div className="debate-transcript-scroller">
                  {debateSegments.map((seg, i) => (
                    <div key={i} className="debate-speech-bubble">
                      <div className="debate-speaker" style={{ color: seg.color }}>{seg.speaker}</div>
                      <div className="debate-text">{seg.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="debate-box">
                <h4 style={{ color: 'var(--text-secondary)' }}>
                  <ShieldAlert size={16} />
                  Advisory Board Debate
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  Wait for Advisory Board consensus traces to load debate segments...
                </p>
              </div>
            )}

            {/* Resource allocations countdown */}
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>Active Resource Commitments</h3>
              {allocations.filter((a: any) => a.crisis_id === selectedCrisis.id).length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No active resources allocated to this incident.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {allocations.filter((a: any) => a.crisis_id === selectedCrisis.id).map((a: any) => {
                    const isReleased = a.status === 'released';
                    return (
                      <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', padding: '0.5rem 0.75rem', borderRadius: '8px', opacity: isReleased ? 0.4 : 1 }}>
                        <span style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>
                          {RES_ICONS[a.resource_type] || '📦'} {a.quantity} {a.resource_type.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isReleased ? '#34d399' : '#f59e0b' }}>
                          {isReleased ? '✓ Released' : `⏳ ${formatCountdown(a.release_at)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Impact simulation summaries */}
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>Response Impact Predictions</h3>
              {simulations.filter((s: any) => s.crisis_id === selectedCrisis.id).length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Simulation metrics pending execution agent run...</p>
              ) : (
                <div>
                  {simulations.filter((s: any) => s.crisis_id === selectedCrisis.id).map((sim: any) => (
                    <div key={sim.id} className="sim-row-item">
                      <div className="sim-row-action">{sim.response_action}</div>
                      <div className="sim-row-metrics">
                        ⏱️ Travel Time Improvement: {sim.response_time_improvement}
                        <br />
                        🚗 Congestion Level Impact: {sim.congestion_level_impact || sim.congestion_impact}
                        <br />
                        💸 Committed Cost: {sim.resource_cost}
                        {sim.possible_side_effects?.length > 0 && (
                          <div style={{ marginTop: '0.25rem', color: '#ff7b72', fontSize: '0.7rem' }}>
                            ⚠️ Side effects: {sim.possible_side_effects.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications tailor messages */}
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>Tailored Public & Stakeholder Alerts</h3>
              {notifications.filter((n: any) => n.crisis_id === selectedCrisis.id).length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Alert generation pending notification agent dispatch...</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {notifications.filter((n: any) => n.crisis_id === selectedCrisis.id).map((n: any) => (
                    <div key={n.id} className="notif-row-item">
                      <div className="notif-row-audience">{n.audience.replace(/_/g, ' ')}</div>
                      <div className="notif-row-msg">{n.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
