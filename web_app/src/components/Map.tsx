import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, MapPin, Users } from 'lucide-react';

interface ActiveCrisis {
  id: string;
  title: string;
  description: string;
  crisis_type: string;
  severity: string;
  confidence: number;
  location: string;
  status: string;
  affected_population: number;
  expected_duration_hours: number;
  priority_score: number;
  lat?: number;
  lng?: number;
}

interface MapProps {
  crises: ActiveCrisis[];
  onSelectCrisis: (crisis: ActiveCrisis) => void;
}

export default function Map({ crises, onSelectCrisis }: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);

  // Initialize map on mount
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // CartoDB Positron theme light map base
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      minZoom: 10,
      maxZoom: 18,
    }).setView([33.695, 73.035], 12.5);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB © OSM',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    markersGroupRef.current = L.featureGroup().addTo(map);

    // Zoom control placement
    map.zoomControl.setPosition('topright');

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when crises list changes
  useEffect(() => {
    const map = mapRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    // Clear old markers
    group.clearLayers();

    crises.forEach((c) => {
      const lat = c.lat ?? 33.6844;
      const lng = c.lng ?? 73.0479;
      const color = c.severity === 'Critical' ? '#ef4444' : c.severity === 'High' ? '#f59e0b' : '#3b82f6';
      
      // Outer ripple / indicator circle
      const outerMarker = L.circleMarker([lat, lng], {
        radius: 18,
        color: color,
        fillColor: color,
        fillOpacity: 0.25,
        weight: 2,
      }).addTo(group);

      // Inner solid coordinate dot
      const innerMarker = L.circleMarker([lat, lng], {
        radius: 7,
        color: '#ffffff',
        fillColor: color,
        fillOpacity: 1,
        weight: 1.5,
      }).addTo(group);

      const popupHtml = `
        <div style="font-family: 'Inter', sans-serif; min-width: 200px; padding: 4px;">
          <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #0d1117;">${c.title}</h4>
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #4b5563; line-height: 1.4;">${c.description.slice(0, 100)}${c.description.length > 100 ? '...' : ''}</p>
          <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
            <span style="background: ${color}20; color: ${color}; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
              ${c.severity}
            </span>
            <span style="font-size: 10px; color: #4b5563; font-weight: 600;">
              Score: ${c.priority_score.toFixed(0)}
            </span>
            <span style="font-size: 10px; color: #6b7280;">
              📍 ${c.location}
            </span>
          </div>
        </div>
      `;

      outerMarker.bindPopup(popupHtml);
      innerMarker.bindPopup(popupHtml);

      // Trigger click event
      innerMarker.on('click', () => {
        onSelectCrisis(c);
      });
    });

    // Auto fit bounds to show all active markers
    if (crises.length > 0) {
      try {
        const bounds = group.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        }
      } catch (err) {
        console.error('Error fitting bounds:', err);
      }
    }
  }, [crises, onSelectCrisis]);

  const handleZoomTo = (c: ActiveCrisis) => {
    const map = mapRef.current;
    if (!map) return;
    const lat = c.lat ?? 33.6844;
    const lng = c.lng ?? 73.0479;
    map.flyTo([lat, lng], 14.5, {
      animate: true,
      duration: 1.2,
    });
    onSelectCrisis(c);
  };

  return (
    <div className="map-layout-grid">
      <div className="map-view-pane" ref={mapContainerRef} style={{ height: 'calc(100vh - 12rem)', borderRadius: '12px', border: '1px solid var(--border-light)' }}></div>
      
      <div className="map-sidebar-pane glass-panel">
        <h3 className="section-title-alt" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
          <MapPin size={18} style={{ color: '#58a6ff' }} />
          Location Registry
        </h3>
        
        {crises.length === 0 ? (
          <div className="empty-state-small">
            <AlertTriangle size={24} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }} />
            <p>No active incidents plotted on coordinates.</p>
          </div>
        ) : (
          <div className="map-incident-list">
            {crises.map((c) => {
              const borderCol = c.severity === 'Critical' ? '#ef4444' : c.severity === 'High' ? '#f59e0b' : '#3b82f6';
              return (
                <div 
                  key={c.id} 
                  className="map-incident-card"
                  onClick={() => handleZoomTo(c)}
                  style={{ borderLeft: `3px solid ${borderCol}` }}
                >
                  <div className="map-incident-header">
                    <span className="map-incident-title">{c.title.split(' — ')[0]}</span>
                    <span className="map-incident-score">{c.priority_score.toFixed(0)}</span>
                  </div>
                  <div className="map-incident-details">
                    <span>📍 {c.location}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <Users size={10} />
                      {c.affected_population.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
