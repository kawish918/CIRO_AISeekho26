import { Activity, BrainCircuit, ShieldAlert, Cpu, Send, CheckCircle2 } from 'lucide-react';

interface AgentFlowProps {
  activeAgent: string;
}

const NODES = [
  { id: 'FusionTriageAgent', label: 'Fusion & Triage', icon: Activity, color: 'fusion' },
  { id: 'CrisisAnalystAgent', label: 'Crisis Analyst', icon: BrainCircuit, color: 'analyst' },
  { id: 'ResourceCommander', label: 'Resource Commander', icon: ShieldAlert, color: 'commander' },
  { id: 'ExecutionAgent', label: 'Execution', icon: Cpu, color: 'execution' },
  { id: 'NotificationAgent', label: 'Notification', icon: Send, color: 'notification' },
  { id: 'VerifierAgent', label: 'Verifier', icon: CheckCircle2, color: 'verifier' },
];

export default function AgentFlow({ activeAgent }: AgentFlowProps) {
  return (
    <div className="glass-panel">
      <h2><Activity size={20} /> Live Agent Flow</h2>
      <div className="flow-container">
        <div className="flow-line"></div>
        {NODES.map((node) => {
          const isActive = activeAgent === node.id;
          const Icon = node.icon;
          return (
            <div key={node.id} className={`node node-${node.color} ${isActive ? 'active' : ''}`}>
              <div className="node-icon">
                <Icon size={isActive ? 28 : 24} />
              </div>
              <div className="node-label">{node.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
