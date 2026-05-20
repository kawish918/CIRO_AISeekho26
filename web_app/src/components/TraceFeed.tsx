import { Terminal } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface Trace {
  id: string;
  agent_name: string;
  step: string;
  observation: string;
  reasoning: string;
  decision: string;
  outcome: string;
  timestamp: string;
}

interface TraceFeedProps {
  traces: Trace[];
}

export default function TraceFeed({ traces }: TraceFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [traces.length]);

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2><Terminal size={20} /> ReACT Trace Feed</h2>
      {traces.length === 0 ? (
        <div className="empty-state">Waiting for agent pipeline...</div>
      ) : (
        <div className="trace-feed" ref={scrollRef}>
          {traces.map((t) => (
            <div key={t.id} className="trace-item">
              <div className="trace-header">
                <span className="trace-agent">{t.agent_name}</span>
                <span>{new Date(t.timestamp).toLocaleTimeString()}</span>
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
          ))}
        </div>
      )}
    </div>
  );
}
