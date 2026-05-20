import { useEffect, useState, useRef } from 'react';
import AgentFlow from './components/AgentFlow';
import { Activity, Radio, AlertTriangle, Package, MessageSquare, RefreshCw } from 'lucide-react';

const API = 'http://localhost:8000/api';

const PIPELINE_STEPS = [
  { key: 'FusionTriageAgent',    label: '1. Fusion & Triage',         desc: 'Ingests social, weather, traffic, and emergency call signals. Cross-references and scores credibility.', icon: '📡' },
  { key: 'CrisisAnalystAgent',   label: '2. Crisis Analyst',          desc: 'LLM classifies each anomaly into a crisis type, assigns severity and confidence, estimates affected population.', icon: '🧠' },
  { key: 'ResourceCommander',    label: '3. Resource Commander',      desc: 'Allocates limited resources (ambulances, rescue teams…) across competing crises using live ETA from Google Maps.', icon: '⚡' },
  { key: 'ExecutionAgent',       label: '4. Execution',               desc: 'Simulates response actions. Shows before/after state, congestion impact, resource cost, side effects.', icon: '🎯' },
  { key: 'NotificationAgent',    label: '5. Stakeholder Notification',desc: 'Generates tailored messages for public, hospitals, emergency services, utility companies, transport, media.', icon: '📨' },
  { key: 'VerifierAgent',        label: '6. Verifier',                desc: 'Reads field reports. If contradictions are found (e.g. broken water main ≠ flood), triggers retraction.', icon: '🔎' },
];

function App() {
  const [status, setStatus]     = useState<any>({ active_agent: 'idle', phase: 'Waiting for backend...', cycle: 0 });
  const [traces, setTraces]     = useState<any[]>([]);
  const [crises, setCrises]     = useState<any[]>([]);
  const [resources, setResources] = useState<any>({});
  const [signals, setSignals]   = useState<any>({ social: [], weather: [], traffic: [], calls: [] });
  const [connected, setConnected] = useState(false);
  const traceRef = useRef<HTMLDivElement>(null);
  const prevTracesLen = useRef(0);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [s, t, c, r, soc, wea, tra, cal] = await Promise.all([
          fetch(`${API}/system_status`).then(r => r.json()).catch(() => status),
          fetch(`${API}/agent_traces`).then(r => r.json()).catch(() => []),
          fetch(`${API}/active_crises`).then(r => r.json()).catch(() => []),
          fetch(`${API}/resources`).then(r => r.json()).catch(() => ({})),
          fetch(`${API}/social`).then(r => r.json()).catch(() => []),
          fetch(`${API}/weather`).then(r => r.json()).catch(() => []),
          fetch(`${API}/traffic`).then(r => r.json()).catch(() => []),
          fetch(`${API}/emergency_calls`).then(r => r.json()).catch(() => []),
        ]);
        setStatus(s); setTraces(t); setCrises(c); setResources(r);
        setSignals({ social: soc, weather: wea, traffic: tra, calls: cal });
        setConnected(true);
      } catch { setConnected(false); }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 1500);
    return () => clearInterval(interval);
  }, []);

  // auto-scroll traces
  useEffect(() => {
    if (traces.length !== prevTracesLen.current) {
      prevTracesLen.current = traces.length;
      traceRef.current?.scrollTo({ top: traceRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [traces.length]);

  const isThinking = status.active_agent !== 'idle';
  const activeStep = PIPELINE_STEPS.findIndex(s => s.key === status.active_agent);

  const sevBadgeClass = (sev: string) => {
    if (sev === 'Critical') return 'badge badge-critical';
    if (sev === 'High') return 'badge badge-high';
    if (sev === 'Medium') return 'badge badge-medium';
    return 'badge badge-low';
  };

  return (
    <div className="app-container">
      {/* ── HEADER ── */}
      <header className="header">
        <div>
          <h1>🛰️ CIRO Mission Control</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Crisis Intelligence & Response Orchestrator — LangGraph × Groq Llama 3.3 70B
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Signals Ingested</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#58a6ff' }}>
              {signals.social.length + signals.weather.length + signals.traffic.length + signals.calls.length}
            </div>
          </div>
          <div className={`status-badge ${!connected ? 'disconnected' : ''}`} style={{
            borderColor: connected ? (isThinking ? 'rgba(59,130,246,0.5)' : 'rgba(16,185,129,0.5)') : 'rgba(239,68,68,0.5)',
            color: connected ? (isThinking ? '#58a6ff' : '#10b981') : '#ef4444',
            background: connected ? (isThinking ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)') : 'rgba(239,68,68,0.1)',
          }}>
            <div className="status-dot" style={{ backgroundColor: 'currentColor' }}></div>
            {connected ? (isThinking ? `Cycle ${status.cycle} — Active` : `Cycle ${status.cycle} — Idle`) : 'Backend Offline'}
          </div>
        </div>
      </header>

      {/* ── PIPELINE FLOW ── */}
      <AgentFlow activeAgent={status.active_agent} />

      {/* ── CURRENT STEP CALLOUT ── */}
      {activeStep >= 0 && (
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <span style={{ fontSize: '2rem' }}>{PIPELINE_STEPS[activeStep].icon}</span>
            <div>
              <div style={{ fontWeight: 700, color: '#58a6ff', fontSize: '1rem' }}>{PIPELINE_STEPS[activeStep].label}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{PIPELINE_STEPS[activeStep].desc}</div>
              <div style={{ marginTop: '0.5rem', color: '#c9d1d9', fontSize: '0.875rem', fontStyle: 'italic' }}>↳ {status.phase}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN GRID ── */}
      <div className="main-grid">
        <div className="left-column">

          {/* Raw Signals */}
          <div className="glass-panel">
            <h2><Radio size={18} /> Raw Signal Feeds
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                {signals.social.length} social · {signals.weather.length} weather · {signals.traffic.length} traffic · {signals.calls.length} calls
              </span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {signals.social.slice(0, 2).map((s: any) => (
                <div key={s.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                  <div style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 700 }}>🗣 SOCIAL · {s.location}</div>
                  <div style={{ fontSize: '0.8rem', color: '#c9d1d9', marginTop: '0.25rem' }}>{s.text}</div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>Cred: {(s.credibility_score * 100).toFixed(0)}% · Urgency: {(s.urgency_score * 100).toFixed(0)}%</div>
                </div>
              ))}
              {signals.weather.slice(0, 1).map((w: any) => (
                <div key={w.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
                  <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700 }}>🌦 WEATHER · {w.alert_type}</div>
                  <div style={{ fontSize: '0.8rem', color: '#c9d1d9', marginTop: '0.25rem' }}>{w.severity} · {w.temperature_c}°C · {w.humidity_pct}% humidity</div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>Zones: {w.affected_zones?.join(', ')}</div>
                </div>
              ))}
              {signals.traffic.slice(0, 1).map((t: any) => (
                <div key={t.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                  <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>🚗 TRAFFIC · {t.route_name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#c9d1d9', marginTop: '0.25rem' }}>{t.congestion_level} · {t.average_speed} km/h</div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Crises */}
          <div className="glass-panel">
            <h2><AlertTriangle size={18} /> Active Crises
              <span style={{ marginLeft: 'auto', fontSize: '0.875rem', fontWeight: 400, color: crises.length > 0 ? '#ef4444' : '#10b981' }}>
                {crises.length} active
              </span>
            </h2>
            {crises.length === 0 ? (
              <div className="empty-state">No crises detected yet. Start agents.py to begin.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Crisis</th><th>Location</th><th>Severity</th><th>Population</th><th>Resources</th></tr></thead>
                <tbody>
                  {crises.map((c: any) => (
                    <tr key={c.id}>
                      <td><strong>{c.title}</strong><br /><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.crisis_type}</span></td>
                      <td>{c.location}</td>
                      <td><span className={sevBadgeClass(c.severity)}>{c.severity}</span></td>
                      <td className="mono">{c.affected_population?.toLocaleString()}</td>
                      <td style={{ fontSize: '0.75rem', color: '#58a6ff' }}>{c.resources_allocated?.slice(0,2).join(', ')}{c.resources_allocated?.length > 2 ? '…' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Resources */}
          <div className="glass-panel">
            <h2><Package size={18} /> Resource Inventory
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>Depletes as Commander allocates</span>
            </h2>
            <div className="resource-grid">
              {Object.entries(resources).map(([key, val]: [string, any]) => (
                <div key={key} className="resource-card">
                  <div className="resource-val" style={{ color: val === 0 ? '#ef4444' : val <= 1 ? '#f59e0b' : '#10b981' }}>{val}</div>
                  <div className="resource-label">{key.replace('_', ' ')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── TRACE FEED ── */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 2rem)', overflow: 'hidden' }}>
          <h2><MessageSquare size={18} /> ReACT Trace Log
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{traces.length} entries</span>
          </h2>
          {traces.length === 0 ? (
            <div className="empty-state" style={{ flex: 1 }}>
              <RefreshCw size={32} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
              <p>Waiting for agents.py to run...</p>
              <code style={{ fontSize: '0.75rem', marginTop: '0.5rem', display: 'block' }}>cd backend && python agents.py</code>
            </div>
          ) : (
            <div className="trace-feed" ref={traceRef}>
              {traces.map((t: any, i: number) => {
                const agentColors: Record<string, string> = {
                  FusionTriageAgent: 'var(--color-fusion)', CrisisAnalystAgent: 'var(--color-analyst)',
                  ResourceCommander: 'var(--color-commander)', ExecutionAgent: 'var(--color-execution)',
                  NotificationAgent: 'var(--color-notification)', VerifierAgent: 'var(--color-verifier)',
                };
                const color = agentColors[t.agent_name] || '#6b7280';
                return (
                  <div key={t.id || i} className="trace-item" style={{ borderLeftColor: color }}>
                    <div className="trace-header">
                      <span className="trace-agent" style={{ color }}>{t.agent_name}</span>
                      <span>{t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : ''}</span>
                    </div>
                    <div className="trace-step mono">[{t.step}]</div>
                    <div className="react-block">
                      <div className="react-label">🧠 Thought</div>
                      <div className="react-text">{t.reasoning}</div>
                    </div>
                    <div className="react-block">
                      <div className="react-label">⚡ Action</div>
                      <div className="react-text">{t.decision}</div>
                    </div>
                    <div className="react-block">
                      <div className="react-label">👁️ Observe</div>
                      <div className="react-text">{t.outcome}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
