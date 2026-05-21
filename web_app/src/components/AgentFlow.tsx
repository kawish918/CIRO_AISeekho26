import { 
  Activity, BrainCircuit, ShieldAlert, Cpu, Send, CheckCircle2, 
  Settings, RefreshCw, Scale, User, Timer 
} from 'lucide-react';

interface AgentFlowProps {
  activeAgent: string;
}

const NODES = [
  { id: 'MasterOrchestrator', label: 'Orchestrator', icon: Settings, color: '#0F766E' },
  { id: 'FusionTriageAgent', label: 'Fusion', icon: Activity, color: '#4F46E5' },
  { id: 'CrisisAnalystAgent', label: 'Analyst', icon: BrainCircuit, color: '#D97706' },
  { id: 'ResourceCommander', label: 'Advisory Board', icon: ShieldAlert, color: '#059669' },
  { id: 'FieldCommander', label: 'Field Cmdr', icon: User, color: '#B45309' },
  { id: 'LogisticsDirector', label: 'Logistics Dir', icon: Scale, color: '#6D28D9' },
  { id: 'ExecutionAgent', label: 'Execution', icon: Cpu, color: '#7C3AED' },
  { id: 'NotificationAgent', label: 'Notify', icon: Send, color: '#DB2777' },
  { id: 'VerifierAgent', label: 'Verifier', icon: CheckCircle2, color: '#DC2626' },
  { id: 'RollbackAgent', label: 'Rollback', icon: RefreshCw, color: '#EA580C' },
  { id: 'ResourceMonitor', label: 'TTL Monitor', icon: Timer, color: '#0891B2' },
];

export default function AgentFlow({ activeAgent }: AgentFlowProps) {
  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Activity size={18} style={{ color: '#3b82f6' }} />
        Live Multi-Agent Orchestration Graph
      </h2>
      <div className="flow-wrapper">
        <div className="flow-container-new">
          {NODES.map((node) => {
            const isActive = activeAgent === node.id;
            const Icon = node.icon;
            return (
              <div 
                key={node.id} 
                className={`node-new ${isActive ? 'active' : ''}`}
                style={{ '--node-color': node.color } as React.CSSProperties}
              >
                <div className="node-icon-new">
                  <Icon size={18} />
                </div>
                <span className="node-label-new">{node.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
