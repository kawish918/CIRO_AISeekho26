import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, StatusBar
} from 'react-native';
import { API } from '@/constants/api';

const CRISIS_ICONS: Record<string, string> = {
  flood: '🌊', heatwave: '🔥', accident: '🚗', infrastructure: '🏗️',
  power_outage: '⚡', protest: '📢', disease_cluster: '🦠', unknown: '⚠️',
};

const SEV_COLORS: Record<string, { bg: string; text: string }> = {
  Critical: { bg: '#FEE2E2', text: '#DC2626' },
  High:     { bg: '#FEF3C7', text: '#D97706' },
  Medium:   { bg: '#DBEAFE', text: '#2563EB' },
  Low:      { bg: '#D1FAE5', text: '#059669' },
};

const TRIGGER_ICONS: Record<string, string> = {
  social_spike: '📱', sensor_spike: '📡', weather_spike: '🌧️',
  manual: '🔧', resource_freed: '♻️',
};

function formatCountdown(releaseAt: string): string {
  try {
    const diff = new Date(releaseAt).getTime() - Date.now();
    if (diff <= 0) return 'Releasing...';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  } catch { return '--:--'; }
}

const RES_ICONS: Record<string, string> = {
  ambulances: '🚑', police_units: '🚔', rescue_teams: '🛟', shelters: '🏠',
  generators: '⚡', water_tankers: '💧', field_teams: '👷', drones: '🛸',
};

const RES_MAX: Record<string, number> = {
  ambulances: 5, police_units: 4, rescue_teams: 3, shelters: 2,
  generators: 3, water_tankers: 2, field_teams: 4, drones: 2,
};

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);
  const [tick, setTick] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/dashboard`);
      const json = await res.json();
      setData(json);
    } catch { /* retry */ }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 3000); return () => clearInterval(i); }, []);
  // Tick every second for countdown timers
  useEffect(() => { const i = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(i); }, []);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const crises = data?.crises || [];
  const resources = data?.resources || {};
  const status = data?.system_status || {};
  const traces = data?.agent_traces || [];
  const simulations = data?.impact_simulations || [];
  const notifications = data?.notifications || [];
  const allocations = data?.resource_allocations || [];
  const pipelineEvents = data?.pipeline_events || [];
  const isActive = status.active_agent && status.active_agent !== 'idle';

  const activeAllocations = allocations.filter((a: any) => a.status === 'active');

  // ── AGENT REPORT VIEW ──
  if (showReport && selected) {
    const crisisTraces = traces;
    const AGENTS = [
      { key: 'FusionTriageAgent', label: 'Fusion & Triage', icon: '📡', color: '#4F46E5' },
      { key: 'CrisisAnalystAgent', label: 'Crisis Analyst', icon: '🧠', color: '#D97706' },
      { key: 'ResourceCommander', label: 'Resource Commander', icon: '⚡', color: '#059669' },
      { key: 'ExecutionAgent', label: 'Execution', icon: '🎯', color: '#7C3AED' },
      { key: 'NotificationAgent', label: 'Notification', icon: '📨', color: '#DB2777' },
      { key: 'VerifierAgent', label: 'Verifier', icon: '🔎', color: '#DC2626' },
      { key: 'RollbackAgent', label: 'Rollback', icon: '♻️', color: '#EA580C' },
      { key: 'ResourceMonitor', label: 'Resource Monitor', icon: '⏱️', color: '#0891B2' },
    ];
    return (
      <View style={s.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7F8FA" />
        <View style={s.detailHeader}>
          <TouchableOpacity onPress={() => setShowReport(false)} style={s.backBtn}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.detailTitle}>Agent Report</Text>
        </View>
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.reportSubtitle}>How agents processed: {selected.title}</Text>
          <View style={s.pipelineFlow}>
            {AGENTS.map((agent, idx) => {
              const agentTraces = crisisTraces.filter((t: any) => t.agent_name === agent.key);
              return (
                <View key={agent.key}>
                  <View style={[s.agentBlock, { borderLeftColor: agent.color }]}>
                    <View style={s.agentBlockHeader}>
                      <Text style={{ fontSize: 20 }}>{agent.icon}</Text>
                      <Text style={[s.agentBlockName, { color: agent.color }]}>{agent.label}</Text>
                      <View style={[s.traceBadge, { backgroundColor: agent.color + '15' }]}>
                        <Text style={[s.traceBadgeText, { color: agent.color }]}>{agentTraces.length} steps</Text>
                      </View>
                    </View>
                    {agentTraces.length === 0 ? (
                      <Text style={s.noTrace}>No traces recorded</Text>
                    ) : agentTraces.map((t: any, i: number) => (
                      <View key={t.id || i} style={s.traceItem}>
                        <Text style={s.traceStep}>[{t.step}]</Text>
                        <View style={s.reactRow}><Text style={s.reactIcon}>👁</Text><Text style={s.reactText}>{t.observation}</Text></View>
                        <View style={s.reactRow}><Text style={s.reactIcon}>🧠</Text><Text style={s.reactText}>{t.reasoning}</Text></View>
                        <View style={s.reactRow}><Text style={s.reactIcon}>⚡</Text><Text style={s.reactText}>{t.decision}</Text></View>
                        <View style={s.reactRow}><Text style={s.reactIcon}>🎯</Text><Text style={s.reactText}>{t.action}</Text></View>
                        <View style={s.reactRow}><Text style={s.reactIcon}>✅</Text><Text style={s.reactText}>{t.outcome}</Text></View>
                      </View>
                    ))}
                  </View>
                  {idx < AGENTS.length - 1 && <View style={s.flowArrow}><Text style={s.flowArrowText}>↓</Text></View>}
                </View>
              );
            })}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ── EVENT DETAIL VIEW ──
  if (selected) {
    const sev = SEV_COLORS[selected.severity] || SEV_COLORS.Medium;
    const crisisSims = simulations.filter((sim: any) => sim.crisis_id === selected.id);
    const crisisNotifs = notifications.filter((n: any) => n.crisis_id === selected.id);
    const crisisAllocs = allocations.filter((a: any) => a.crisis_id === selected.id);
    return (
      <View style={s.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7F8FA" />
        <View style={s.detailHeader}>
          <TouchableOpacity onPress={() => setSelected(null)} style={s.backBtn}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.detailTitle}>Event Detail</Text>
        </View>
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.detailCard}>
            <View style={s.detailTop}>
              <Text style={{ fontSize: 32 }}>{CRISIS_ICONS[selected.crisis_type] || '⚠️'}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.detailCrisisTitle}>{selected.title}</Text>
                <Text style={s.detailLoc}>📍 {selected.location}</Text>
              </View>
              <View style={[s.sevChip, { backgroundColor: sev.bg }]}>
                <Text style={[s.sevChipText, { color: sev.text }]}>{selected.severity}</Text>
              </View>
            </View>
            <Text style={s.detailDesc}>{selected.description}</Text>
          </View>

          <View style={s.metricsGrid}>
            {[
              { label: 'Priority Score', value: selected.priority_score?.toFixed?.(0) || '0', color: '#EA580C' },
              { label: 'Confidence', value: `${(selected.confidence * 100).toFixed(0)}%`, color: '#4F46E5' },
              { label: 'Population', value: selected.affected_population?.toLocaleString(), color: '#DC2626' },
              { label: 'Radius', value: `${selected.affected_radius_km} km`, color: '#D97706' },
              { label: 'Duration', value: `${selected.expected_duration_hours}h`, color: '#059669' },
              { label: 'Spread Risk', value: selected.spread_risk, color: '#7C3AED' },
            ].map(m => (
              <View key={m.label} style={s.metricBox}>
                <Text style={s.metricLabel}>{m.label}</Text>
                <Text style={[s.metricVal, { color: m.color }]}>{m.value}</Text>
              </View>
            ))}
          </View>

          {selected.likely_evolution ? (
            <View style={s.infoCard}>
              <Text style={s.infoCardTitle}>📈 Likely Evolution</Text>
              <Text style={s.infoCardBody}>{selected.likely_evolution}</Text>
            </View>
          ) : null}

          {selected.resources_allocated?.length > 0 && (
            <View style={s.infoCard}>
              <Text style={s.infoCardTitle}>🚑 Resources Allocated</Text>
              {selected.resources_allocated.map((r: string, i: number) => (
                <Text key={i} style={s.resList}>• {r}</Text>
              ))}
            </View>
          )}

          {/* Resource Allocations with TTL Countdowns */}
          {crisisAllocs.length > 0 && (
            <View style={s.infoCard}>
              <Text style={s.infoCardTitle}>⏱️ Allocation Lifecycle</Text>
              {crisisAllocs.map((a: any) => {
                const isReleased = a.status === 'released';
                return (
                  <View key={a.id} style={[s.allocItem, isReleased && { opacity: 0.5 }]}>
                    <View style={s.allocRow}>
                      <Text style={s.allocIcon}>{RES_ICONS[a.resource_type] || '📦'}</Text>
                      <Text style={s.allocText}>{a.quantity} {a.resource_type.replace(/_/g, ' ')}</Text>
                      <View style={[s.allocBadge, { backgroundColor: isReleased ? '#D1FAE5' : '#FEF3C7' }]}>
                        <Text style={[s.allocBadgeText, { color: isReleased ? '#059669' : '#D97706' }]}>
                          {isReleased ? '✓ Released' : `⏳ ${formatCountdown(a.release_at)}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {crisisSims.length > 0 && (
            <View style={s.infoCard}>
              <Text style={s.infoCardTitle}>📊 Impact Simulations</Text>
              {crisisSims.map((sim: any) => (
                <View key={sim.id} style={s.simItem}>
                  <Text style={s.simAction}>{sim.response_action}</Text>
                  <Text style={s.simMeta}>⏱ {sim.response_time_improvement}  •  💰 {sim.resource_cost}</Text>
                </View>
              ))}
            </View>
          )}

          {crisisNotifs.length > 0 && (
            <View style={s.infoCard}>
              <Text style={s.infoCardTitle}>📨 Notifications Sent ({crisisNotifs.length})</Text>
              {crisisNotifs.slice(0, 4).map((n: any) => (
                <View key={n.id} style={s.notifItem}>
                  <Text style={s.notifAud}>{n.audience?.replace(/_/g, ' ')}</Text>
                  <Text style={s.notifMsg} numberOfLines={2}>{n.message}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={s.reportBtn} onPress={() => setShowReport(true)}>
            <Text style={s.reportBtnText}>View Full Agent Report →</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ── MAIN DASHBOARD ──
  const totalRes = Object.values(resources).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
  const lastEvent = pipelineEvents.length > 0 ? pipelineEvents[pipelineEvents.length - 1] : null;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FA" />
      <View style={s.header}>
        <View>
          <Text style={s.logo}>🛰️ CIRO</Text>
          <Text style={s.subtitle}>Crisis Intelligence & Response</Text>
        </View>
        <View style={[s.statusChip, isActive ? s.statusActive : s.statusIdle]}>
          <View style={[s.statusDot, { backgroundColor: isActive ? '#4F46E5' : '#10B981' }]} />
          <Text style={[s.statusText, { color: isActive ? '#4F46E5' : '#10B981' }]}>
            {isActive ? `Cycle ${status.cycle}` : `Idle · C${status.cycle || 0}`}
          </Text>
        </View>
      </View>

      <ScrollView style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />}
        showsVerticalScrollIndicator={false}>

        {/* Stats Row */}
        <View style={s.statsRow}>
          {[
            { val: crises.length, label: 'Active Events', color: '#DC2626', bg: '#FEE2E2' },
            { val: totalRes, label: 'Resources', color: '#059669', bg: '#D1FAE5' },
            { val: data?.notification_count || 0, label: 'Alerts Sent', color: '#D97706', bg: '#FEF3C7' },
          ].map(st => (
            <View key={st.label} style={[s.statCard, { backgroundColor: st.bg + '80' }]}>
              <Text style={[s.statVal, { color: st.color }]}>{st.val}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Event-Driven Trigger Banner */}
        {lastEvent && (
          <View style={s.triggerBanner}>
            <Text style={s.triggerLabel}>⚡ Event-Driven Pipeline</Text>
            <View style={s.triggerRow}>
              <Text style={s.triggerIcon}>{TRIGGER_ICONS[lastEvent.trigger_source] || '🔔'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.triggerSource}>{lastEvent.trigger_source.replace(/_/g, ' ')}</Text>
                <Text style={s.triggerDetail} numberOfLines={1}>{lastEvent.trigger_detail}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Active Agent Banner */}
        {isActive && (
          <View style={s.agentBanner}>
            <Text style={s.agentBannerText}>🤖 {status.active_agent}</Text>
            <Text style={s.agentBannerPhase} numberOfLines={1}>{status.phase}</Text>
          </View>
        )}

        {/* Events */}
        <Text style={s.sectionTitle}>Active Events</Text>
        {crises.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 40 }}>🛡️</Text>
            <Text style={s.emptyTitle}>All Clear</Text>
            <Text style={s.emptyDesc}>No active crises detected. System is monitoring.</Text>
          </View>
        ) : crises.map((c: any) => {
          const sev = SEV_COLORS[c.severity] || SEV_COLORS.Medium;
          const icon = CRISIS_ICONS[c.crisis_type] || '⚠️';
          return (
            <TouchableOpacity key={c.id} style={s.eventCard} onPress={() => setSelected(c)} activeOpacity={0.7}>
              <View style={s.eventTop}>
                <Text style={{ fontSize: 28 }}>{icon}</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.eventTitle}>{c.title}</Text>
                  <Text style={s.eventLoc}>📍 {c.location}  •  Pop: {c.affected_population?.toLocaleString()}</Text>
                </View>
                {/* Priority Score badge */}
                {c.priority_score > 0 && (
                  <View style={s.scoreBadge}>
                    <Text style={s.scoreLabel}>SCORE</Text>
                    <Text style={s.scoreVal}>{c.priority_score?.toFixed?.(0)}</Text>
                  </View>
                )}
              </View>
              <View style={s.eventBoxes}>
                <View style={[s.miniBox, { backgroundColor: sev.bg }]}>
                  <Text style={s.miniBoxLabel}>Severity</Text>
                  <Text style={[s.miniBoxVal, { color: sev.text }]}>{c.severity}</Text>
                </View>
                <View style={[s.miniBox, { backgroundColor: '#EEF2FF' }]}>
                  <Text style={s.miniBoxLabel}>Confidence</Text>
                  <Text style={[s.miniBoxVal, { color: '#4F46E5' }]}>{(c.confidence * 100).toFixed(0)}%</Text>
                </View>
                <View style={[s.miniBox, { backgroundColor: c.status === 'Active' ? '#DBEAFE' : '#D1FAE5' }]}>
                  <Text style={s.miniBoxLabel}>Status</Text>
                  <Text style={[s.miniBoxVal, { color: c.status === 'Active' ? '#2563EB' : '#059669' }]}>{c.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Resource Summary with Allocation Lifecycle */}
        <Text style={s.sectionTitle}>Resources</Text>
        <View style={s.resGrid}>
          {[
            { name: 'Ambulances', key: 'ambulances', icon: '🚑' },
            { name: 'Police', key: 'police_units', icon: '🚔' },
            { name: 'Rescue', key: 'rescue_teams', icon: '🛟' },
            { name: 'Shelters', key: 'shelters', icon: '🏠' },
            { name: 'Generators', key: 'generators', icon: '⚡' },
            { name: 'Tankers', key: 'water_tankers', icon: '💧' },
            { name: 'Field Teams', key: 'field_teams', icon: '👷' },
            { name: 'Drones', key: 'drones', icon: '🛸' },
          ].map(r => {
            const val = resources[r.key] ?? 0;
            const max = RES_MAX[r.key] || 5;
            const pct = max > 0 ? val / max : 0;
            const barColor = pct === 0 ? '#DC2626' : pct < 0.5 ? '#D97706' : '#10B981';
            // Find active allocations for this resource type
            const resAllocs = activeAllocations.filter((a: any) => a.resource_type === r.key);
            return (
              <View key={r.key} style={s.resItem}>
                <Text style={{ fontSize: 18 }}>{r.icon}</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <View style={s.resRow}>
                    <Text style={s.resName}>{r.name}</Text>
                    <Text style={[s.resVal, { color: barColor }]}>{val}/{max}</Text>
                  </View>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
                  </View>
                  {/* Active allocation countdown */}
                  {resAllocs.map((a: any) => (
                    <View key={a.id} style={s.allocMini}>
                      <Text style={s.allocMiniText}>
                        ⏳ {a.quantity} → {a.crisis_title?.split('—')[1]?.trim() || 'Crisis'} · {formatCountdown(a.release_at)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 54, paddingBottom: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E9ED' },
  logo: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', letterSpacing: 0.5 },
  subtitle: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  statusIdle: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  scroll: { flex: 1, paddingHorizontal: 16 },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  statVal: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 10, color: '#6B7280', marginTop: 2, fontWeight: '600' },

  triggerBanner: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#FDBA74' },
  triggerLabel: { fontSize: 10, fontWeight: '800', color: '#EA580C', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  triggerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  triggerIcon: { fontSize: 20 },
  triggerSource: { fontSize: 13, fontWeight: '700', color: '#9A3412', textTransform: 'capitalize' },
  triggerDetail: { fontSize: 11, color: '#C2410C', marginTop: 1 },

  agentBanner: { backgroundColor: '#EEF2FF', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#C7D2FE' },
  agentBannerText: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  agentBannerPhase: { fontSize: 11, color: '#6366F1', marginTop: 2 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 22, marginBottom: 10 },

  emptyState: { alignItems: 'center', padding: 40, backgroundColor: '#FFF', borderRadius: 16, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginTop: 10 },
  emptyDesc: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },

  eventCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  eventTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  eventTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  eventLoc: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  eventBoxes: { flexDirection: 'row', gap: 8 },
  miniBox: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  miniBoxLabel: { fontSize: 9, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  miniBoxVal: { fontSize: 14, fontWeight: '800', marginTop: 2 },

  scoreBadge: { backgroundColor: '#FFF7ED', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', borderWidth: 1, borderColor: '#FDBA74' },
  scoreLabel: { fontSize: 7, fontWeight: '800', color: '#EA580C', letterSpacing: 0.5 },
  scoreVal: { fontSize: 16, fontWeight: '900', color: '#EA580C' },

  resGrid: { backgroundColor: '#FFF', borderRadius: 16, padding: 14 },
  resItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  resRow: { flexDirection: 'row', justifyContent: 'space-between' },
  resName: { fontSize: 12, color: '#374151', fontWeight: '600' },
  resVal: { fontSize: 12, fontWeight: '700' },
  barTrack: { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  allocMini: { marginTop: 4 },
  allocMiniText: { fontSize: 10, color: '#D97706', fontWeight: '600' },

  // Detail screen
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 54, paddingBottom: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E8E9ED', gap: 12 },
  backBtn: { paddingVertical: 6, paddingRight: 8 },
  backText: { fontSize: 15, color: '#4F46E5', fontWeight: '600' },
  detailTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  detailCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginTop: 16 },
  detailTop: { flexDirection: 'row', alignItems: 'center' },
  detailCrisisTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  detailLoc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sevChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  sevChipText: { fontSize: 12, fontWeight: '700' },
  detailDesc: { fontSize: 13, color: '#4B5563', lineHeight: 20, marginTop: 12 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metricBox: { width: '31%', backgroundColor: '#FFF', borderRadius: 12, padding: 12, alignItems: 'center' },
  metricLabel: { fontSize: 9, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase' },
  metricVal: { fontSize: 16, fontWeight: '800', marginTop: 3 },
  infoCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginTop: 12 },
  infoCardTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  infoCardBody: { fontSize: 13, color: '#4B5563', lineHeight: 20 },
  resList: { fontSize: 13, color: '#4F46E5', marginTop: 4 },
  allocItem: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  allocRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  allocIcon: { fontSize: 16 },
  allocText: { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1, textTransform: 'capitalize' },
  allocBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  allocBadgeText: { fontSize: 11, fontWeight: '700' },
  simItem: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  simAction: { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
  simMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  notifItem: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  notifAud: { fontSize: 11, fontWeight: '700', color: '#4F46E5', textTransform: 'capitalize' },
  notifMsg: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  reportBtn: { backgroundColor: '#4F46E5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  reportBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Agent Report
  reportSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 12, marginBottom: 16, paddingHorizontal: 4 },
  pipelineFlow: { paddingHorizontal: 4 },
  agentBlock: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderLeftWidth: 4, marginBottom: 4 },
  agentBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  agentBlockName: { fontSize: 14, fontWeight: '700', flex: 1 },
  traceBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  traceBadgeText: { fontSize: 10, fontWeight: '700' },
  noTrace: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  traceItem: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, marginTop: 6 },
  traceStep: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 4 },
  reactRow: { flexDirection: 'row', gap: 6, marginTop: 3 },
  reactIcon: { fontSize: 12, width: 18 },
  reactText: { fontSize: 11, color: '#374151', flex: 1, lineHeight: 16 },
  flowArrow: { alignItems: 'center', paddingVertical: 4 },
  flowArrowText: { fontSize: 18, color: '#D1D5DB' },
});
