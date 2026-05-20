import { AlertTriangle, Package } from 'lucide-react';

interface DashboardProps {
  crises: any[];
  resources: any;
}

export default function Dashboard({ crises, resources }: DashboardProps) {
  return (
    <div style={{ display: 'flex', gap: '2rem' }}>
      <div className="glass-panel" style={{ flex: 1 }}>
        <h2><AlertTriangle size={20} /> Active Crises</h2>
        {crises.length === 0 ? (
          <div className="empty-state">No active crises detected.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Location</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Population</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {crises.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.location}</strong></td>
                  <td style={{ textTransform: 'capitalize' }}>{c.crisis_type.replace('_', ' ')}</td>
                  <td>
                    <span className={`badge badge-${c.severity.toLowerCase()}`}>
                      {c.severity}
                    </span>
                  </td>
                  <td className="mono">{c.affected_population.toLocaleString()}</td>
                  <td>{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="glass-panel" style={{ width: '400px' }}>
        <h2><Package size={20} /> Resources Inventory</h2>
        {Object.keys(resources).length === 0 ? (
          <div className="empty-state">Inventory empty.</div>
        ) : (
          <div className="resource-grid">
            {Object.entries(resources).map(([key, val]: [string, any]) => (
              <div key={key} className="resource-card">
                <div className="resource-val">{val}</div>
                <div className="resource-label">{key.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
