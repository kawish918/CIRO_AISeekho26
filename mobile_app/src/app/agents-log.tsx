import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  StatusBar, TouchableOpacity, Animated
} from 'react-native';
import { API } from '@/constants/api';

const AGENTS: Record<string, { label: string; icon: string; color: string }> = {
  MasterOrchestrator: { label: 'Orchestrator',     icon: '🛰️', color: '#0F766E' },
  FusionTriageAgent:  { label: 'Fusion',           icon: '📡', color: '#4F46E5' },
  CrisisAnalystAgent: { label: 'Analyst',          icon: '🧠', color: '#D97706' },
  ResourceCommander:  { label: 'Advisory Board',   icon: '⚡', color: '#059669' },
  FieldCommander:     { label: 'Field Cmdr',       icon: '📢', color: '#B45309' },
  LogisticsDirector:  { label: 'Logistics Dir',    icon: '⚖️', color: '#6D28D9' },
  ExecutionAgent:     { label: 'Execution',        icon: '🎯', color: '#7C3AED' },
  NotificationAgent:  { label: 'Notify',           icon: '📨', color: '#DB2777' },
  VerifierAgent:      { label: 'Verifier',         icon: '🔎', color: '#DC2626' },
  RollbackAgent:      { label: 'Rollback',         icon: '♻️', color: '#EA580C' },
  ResourceMonitor:    { label: 'TTL Monitor',      icon: '⏱️', color: '#0891B2' },
};

export default function AgentsLog() {
  const [traces, setTraces]   = useState<any[]>([]);
  const [status, setStatus]   = useState<any>({ active_agent: 'idle', phase: '', cycle: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const fetchData = async () => {
    try {
      const [t, s] = await Promise.all([
        fetch(`${API}/agent_traces`).then(r => r.json()).catch(() => []),
        fetch(`${API}/system_status`).then(r => r.json()).catch(() => status),
      ]);
      setTraces(Array.isArray(t) ? t : []);
      setStatus(s);
    } catch { /* retry */ }
  };

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 2500); return () => clearInterval(i); }, []);

  useEffect(() => {
    if (status.active_agent !== 'idle') {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [status.active_agent]);

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };
  const isActive = status.active_agent !== 'idle';

  const formatTime = (ts: string) => {
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>🤖 Agent Log</Text>
          <Text style={s.headerSub}>{traces.length} trace entries · Cycle {status.cycle || 0}</Text>
        </View>
        {isActive && (
          <Animated.View style={[s.liveBadge, { opacity: pulseAnim }]}>
            <Text style={s.liveText}>● LIVE</Text>
          </Animated.View>
        )}
      </View>

      <ScrollView ref={scrollRef} style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />}
        showsVerticalScrollIndicator={false}>

        {/* Pipeline Progress */}
        {isActive && (
          <View style={s.pipelineBar}>
            {Object.entries(AGENTS).map(([key, agent], idx) => {
              const isAgentActive = status.active_agent === key;
              return (
                <View key={key} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[s.pipeDot, isAgentActive && { backgroundColor: agent.color, borderColor: agent.color }]}>
                    <Text style={{ fontSize: 10 }}>{agent.icon}</Text>
                  </View>
                  {idx < Object.keys(AGENTS).length - 1 && (
                    <View style={[s.pipeLine, isAgentActive && { backgroundColor: agent.color }]} />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {traces.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 40 }}>💤</Text>
            <Text style={s.emptyTitle}>Waiting for agents</Text>
            <Text style={s.emptyDesc}>Run python agents.py in backend/</Text>
          </View>
        ) : (
          traces.slice(-30).reverse().map((t: any, idx: number) => {
            const agent = AGENTS[t.agent_name];
            const color = agent?.color || '#6B7280';
            const isExpanded = expanded === (t.id || idx.toString());
            return (
              <TouchableOpacity
                key={t.id || idx}
                style={[s.traceCard, { borderLeftColor: color }]}
                onPress={() => setExpanded(isExpanded ? null : (t.id || idx.toString()))}
                activeOpacity={0.7}>
                <View style={s.traceHeader}>
                  <View style={[s.agentChip, { backgroundColor: color + '12' }]}>
                    <Text style={[s.agentChipText, { color }]}>{agent?.icon || '•'} {agent?.label || t.agent_name}</Text>
                  </View>
                  <Text style={s.traceTime}>{formatTime(t.timestamp)}</Text>
                </View>
                <Text style={s.traceStep}>[{t.step}]</Text>
                <Text style={s.traceDecision} numberOfLines={isExpanded ? undefined : 2}>{t.decision}</Text>
                {isExpanded && (
                  <View style={s.expandedBlock}>
                    <View style={s.reactRow}><Text style={s.reactLabel}>👁 Observe</Text><Text style={s.reactText}>{t.observation}</Text></View>
                    <View style={s.reactRow}><Text style={s.reactLabel}>🧠 Think</Text><Text style={s.reactText}>{t.reasoning}</Text></View>
                    <View style={s.reactRow}><Text style={s.reactLabel}>🎯 Act</Text><Text style={s.reactText}>{t.action}</Text></View>
                    <View style={s.reactRow}><Text style={s.reactLabel}>✅ Result</Text><Text style={s.reactText}>{t.outcome}</Text></View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 54, paddingBottom: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E8E9ED' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E' },
  headerSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  liveBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  liveText: { fontSize: 11, fontWeight: '800', color: '#DC2626' },
  scroll: { flex: 1, paddingHorizontal: 16 },

  pipelineBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginTop: 12, marginBottom: 4 },
  pipeDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F3F4F6', borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  pipeLine: { width: 16, height: 2, backgroundColor: '#E5E7EB' },

  emptyState: { alignItems: 'center', padding: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginTop: 10 },
  emptyDesc: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  traceCard: { backgroundColor: '#FFF', padding: 14, borderRadius: 12, marginTop: 8, borderLeftWidth: 3 },
  traceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  agentChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  agentChipText: { fontSize: 11, fontWeight: '700' },
  traceTime: { fontSize: 10, color: '#9CA3AF' },
  traceStep: { fontSize: 10, color: '#9CA3AF', marginBottom: 4 },
  traceDecision: { fontSize: 13, color: '#374151', lineHeight: 18 },
  expandedBlock: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  reactRow: { marginTop: 6 },
  reactLabel: { fontSize: 10, fontWeight: '700', color: '#6B7280', marginBottom: 2 },
  reactText: { fontSize: 12, color: '#374151', lineHeight: 17 },
});
