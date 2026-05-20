import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, RefreshControl, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import { API } from '@/constants/api';

function buildMapHtml(crises: any[]) {
  const markers = crises.map((c: any) => {
    const lat = c.lat ?? 33.6844;
    const lng = c.lng ?? 73.0479;
    const color = c.severity === 'Critical' ? '#DC2626' : c.severity === 'High' ? '#D97706' : '#2563EB';
    const title = (c.title || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
    const pop = (c.affected_population ?? 0).toLocaleString();
    return `
      L.circleMarker([${lat}, ${lng}], {
        radius: 16, color: '${color}', fillColor: '${color}', fillOpacity: 0.35, weight: 3
      }).addTo(map).bindPopup('<b>${title}</b><br>${c.severity} · Pop: ${pop}<br>📍 ${c.location || ""}');
      L.circleMarker([${lat}, ${lng}], {
        radius: 6, color: '${color}', fillColor: '${color}', fillOpacity: 1, weight: 0
      }).addTo(map);
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#F7F8FA;}
    .legend{background:#fff;padding:8px 12px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.15);font:12px system-ui;line-height:20px}
    .legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([33.6950, 73.0350], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB © OSM',
      maxZoom: 19
    }).addTo(map);
    ${markers}
    var legend = L.control({position: 'bottomright'});
    legend.onAdd = function() {
      var div = L.DomUtil.create('div', 'legend');
      div.innerHTML = '<b>Severity</b><br>'
        + '<i style="background:#DC2626"></i>Critical<br>'
        + '<i style="background:#D97706"></i>High<br>'
        + '<i style="background:#2563EB"></i>Medium/Low';
      return div;
    };
    legend.addTo(map);
  </script>
</body>
</html>`;
}

export default function MapScreen() {
  const [crises, setCrises] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API}/active_crises`);
      const data = await res.json();
      setCrises(Array.isArray(data) ? data : []);
    } catch { /* retry */ }
  };

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 5000); return () => clearInterval(i); }, []);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.header}>
        <Text style={s.headerTitle}>📍 Crisis Map</Text>
        <Text style={s.headerSub}>{crises.length} active events · Islamabad</Text>
      </View>
      <View style={s.mapWrap}>
        <WebView
          source={{ html: buildMapHtml(crises) }}
          style={s.map}
          originWhitelist={['*']}
          javaScriptEnabled
          scrollEnabled={false}
        />
      </View>
      <ScrollView style={s.listWrap} showsVerticalScrollIndicator={false}>
        {crises.map((c: any) => {
          const color = c.severity === 'Critical' ? '#DC2626' : c.severity === 'High' ? '#D97706' : '#2563EB';
          return (
            <View key={c.id} style={[s.listCard, { borderLeftColor: color }]}>
              <View style={s.listRow}>
                <View style={[s.dot, { backgroundColor: color }]} />
                <Text style={s.listTitle} numberOfLines={1}>{c.title}</Text>
                <Text style={[s.listSev, { color }]}>{c.severity}</Text>
              </View>
              <Text style={s.listLoc}>📍 {c.location}  •  {c.affected_population?.toLocaleString()} affected</Text>
            </View>
          );
        })}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },
  header: { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E8E9ED' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E' },
  headerSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  mapWrap: { flex: 3, borderBottomWidth: 1, borderBottomColor: '#E8E9ED' },
  map: { flex: 1, backgroundColor: '#F7F8FA' },
  listWrap: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  listCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 3 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  listTitle: { fontSize: 13, fontWeight: '600', color: '#1A1A2E', flex: 1 },
  listSev: { fontSize: 11, fontWeight: '700' },
  listLoc: { fontSize: 11, color: '#6B7280', marginTop: 4, marginLeft: 16 },
});
