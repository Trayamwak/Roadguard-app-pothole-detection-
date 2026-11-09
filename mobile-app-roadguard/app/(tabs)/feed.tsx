import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton, AppScreen, AppText, EmptyState, PageTitle, Pill, ReportRow } from '@/components/AppUI';
import { useApp } from '@/providers/AppProvider';
import { useColors } from '@/hooks/useColors';
import type { Severity } from '@/types';

const severityOptions: ('All' | Severity)[] = ['All', 'Low', 'Medium', 'High', 'Critical'];
const dateOptions = ['24h', '7 days', '30 days', 'All time'] as const;

export default function FeedScreen() {
  const colors = useColors();
  const { reports, isLoadingReports, confirmPothole, user, firebaseReady, reportError } = useApp();
  const [severity, setSeverity] = useState<(typeof severityOptions)[number]>('All');
  const [dateWindow, setDateWindow] = useState<(typeof dateOptions)[number]>('7 days');
  const filtered = useMemo(() => {
    const cutoff =
      dateWindow === '24h'
        ? Date.now() - 86400000
        : dateWindow === '7 days'
          ? Date.now() - 7 * 86400000
          : dateWindow === '30 days'
            ? Date.now() - 30 * 86400000
            : 0;
    return reports.filter((report) => {
      const matchesSeverity = severity === 'All' || report.severity === severity;
      return matchesSeverity && report.createdAt >= cutoff;
    });
  }, [dateWindow, reports, severity]);

  const confirm = async (id: string) => {
    try {
      await confirmPothole(id);
    } catch (error) {
      Alert.alert('Could not confirm', error instanceof Error ? error.message : 'Try again when signed in.');
    }
  };

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <PageTitle
        eyebrow="Community"
        title="Road report feed"
        subtitle={firebaseReady ? 'Recent reports shared by drivers nearby.' : 'Only this device’s queued reports are available until Firebase is connected.'}
      />
      {reportError ? (
        <View style={[styles.errorBar, { borderColor: colors.border }]}>
          <AppText size={12} tone="warning">{reportError}</AppText>
        </View>
      ) : null}
      <View style={styles.filterGroup}>
        <AppText size={11} tone="muted" weight="bold" style={styles.label}>SEVERITY</AppText>
        <View style={styles.pills}>
          {severityOptions.map((option) => (
            <Pill key={option} title={option} selected={severity === option} onPress={() => setSeverity(option)} />
          ))}
        </View>
      </View>
      <View style={styles.filterGroup}>
        <AppText size={11} tone="muted" weight="bold" style={styles.label}>DATE RANGE</AppText>
        <View style={styles.pills}>
          {dateOptions.map((option) => (
            <Pill key={option} title={option} selected={dateWindow === option} onPress={() => setDateWindow(option)} />
          ))}
        </View>
      </View>
      <View style={styles.feedMeta}>
        <AppText size={13} tone="muted">{filtered.length} {filtered.length === 1 ? 'report' : 'reports'}</AppText>
        <AppText size={11} tone="muted">Newest first</AppText>
      </View>
      {isLoadingReports ? (
        <View style={styles.loading}><ActivityIndicator color={colors.accent} /><AppText size={13} tone="muted">Loading community reports…</AppText></View>
      ) : filtered.length ? (
        <View style={styles.list}>
          {filtered.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              showConfirm={report.userId !== user?.uid}
              onConfirm={() => confirm(report.id)}
              onPress={() => router.push({ pathname: '/report/[id]', params: { id: report.id } })}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="list-outline"
          title="Nothing in this slice"
          description={reports.length ? 'Try another date range or severity.' : 'No shared reports are available yet. Be the first to add one.'}
          action={<AppButton title="Report a pothole" icon="camera-outline" onPress={() => router.push({ pathname: '/report/new', params: { source: 'camera' } })} />}
        />
      )}
      {!user ? <AppText size={11} tone="muted" style={styles.signInNote}>Sign in to confirm reports. Confirmations help prioritize repairs.</AppText> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 14, paddingBottom: 34, gap: 17 },
  filterGroup: { gap: 9 },
  label: { letterSpacing: 1.2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  feedMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  list: { gap: 9 },
  loading: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorBar: { borderWidth: 1, borderRadius: 14, padding: 12 },
  signInNote: { textAlign: 'center', lineHeight: 17 },
});
