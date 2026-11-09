import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppButton, AppScreen, AppText, Panel, PageTitle, Pill, SeverityBadge, SmallIconButton } from '@/components/AppUI';
import { SkeletonReportCard } from '@/components/SkeletonLoader';
import { getLocalReports, deleteLocalReport, getScanHistory } from '@/lib/storage';
import { useColors } from '@/hooks/useColors';
import type { PotholeReport, ScanRecord, Severity } from '@/types';

const severityFilters = ['All', 'Low', 'Medium', 'High', 'Critical'] as const;
const dateFilters = ['7 days', '30 days', 'All'] as const;

export default function ScanHistoryScreen() {
  const colors = useColors();
  const [reports, setReports] = useState<PotholeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState<(typeof severityFilters)[number]>('All');
  const [dateWindow, setDateWindow] = useState<(typeof dateFilters)[number]>('30 days');

  const loadData = async () => {
    setLoading(true);
    try {
      const stored = await getLocalReports();
      setReports(stored);
    } catch (e) {
      console.warn('Failed to load local reports:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const filtered = reports.filter((report) => {
    const cutoff =
      dateWindow === '7 days'
        ? Date.now() - 7 * 86400000
        : dateWindow === '30 days'
          ? Date.now() - 30 * 86400000
          : 0;

    const matchesDate = report.createdAt >= cutoff;
    const matchesSeverity = severity === 'All' || report.severity === severity;
    return matchesDate && matchesSeverity;
  });

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Scan',
      'Are you sure you want to delete this scan from local storage?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteLocalReport(id);
            setReports((prev) => prev.filter((r) => r.id !== id));
          },
        },
      ],
    );
  };

  const shareScan = async (report: PotholeReport) => {
    const where = report.address || `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`;
    await Share.share({
      title: 'Roadguard Pothole Report',
      message: `${report.severity} Severity Pothole (${report.confidence}% confidence) detected at ${where} on ${new Date(report.createdAt).toLocaleString()}. Saved on-device with Roadguard.`,
    });
  };

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <View style={styles.top}>
        <SmallIconButton icon="chevron-back" accessibilityLabel="Go back" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <PageTitle
            eyebrow="On-Device Storage"
            title="Saved Scans"
            subtitle={`${reports.length} report${reports.length === 1 ? '' : 's'} stored on your device.`}
          />
        </View>
      </View>

      <View style={styles.filterGroup}>
        <View style={styles.filters}>
          {severityFilters.map((item) => (
            <Pill key={item} title={item} selected={severity === item} onPress={() => setSeverity(item)} />
          ))}
        </View>
        <View style={styles.filters}>
          {dateFilters.map((item) => (
            <Pill key={item} title={item} selected={dateWindow === item} onPress={() => setDateWindow(item)} />
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((item) => (
            <SkeletonReportCard key={item} />
          ))}
        </View>
      ) : filtered.length ? (
        <View style={styles.list}>
          {filtered.map((report, index) => {
            const imageUri = report.image_uri || report.localImageUri || report.imageUrl;
            return (
              <Animated.View
                key={report.id}
                entering={FadeInDown.delay(Math.min(index * 35, 210)).duration(280)}
              >
                <Panel style={styles.recordCard}>
                  <View style={styles.recordHeader}>
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={styles.thumbImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.sourceIcon}>
                        <Ionicons
                          name={report.source === 'ai_live' ? 'videocam-outline' : 'image-outline'}
                          size={18}
                          color={colors.accent}
                        />
                      </View>
                    )}

                    <View style={styles.recordCopy}>
                      <View style={styles.titleLine}>
                        <SeverityBadge severity={report.severity} />
                        <View style={[styles.countPill, { backgroundColor: (report.pothole_count ?? (report.potholes?.length || 1)) > 0 ? '#431407' : '#1C1917' }]}>
                          <AppText size={10} weight="bold" style={{ color: (report.pothole_count ?? (report.potholes?.length || 1)) > 0 ? '#FB923C' : '#A8A29E' }}>
                            {report.pothole_count ?? (report.potholes?.length || 1)} Pothole{(report.pothole_count ?? (report.potholes?.length || 1)) === 1 ? '' : 's'}
                          </AppText>
                        </View>
                        <View style={styles.confidencePill}>
                          <AppText size={10} tone="muted" weight="bold">
                            {report.confidence}%
                          </AppText>
                        </View>
                      </View>

                      {report.description ? (
                        <AppText size={11} tone="muted" numberOfLines={2} style={{ fontStyle: 'italic', marginVertical: 2 }}>
                          "{report.description}"
                        </AppText>
                      ) : null}

                      <AppText size={11} tone="foreground" numberOfLines={1}>
                        {report.address || `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`}
                      </AppText>

                      <AppText size={10} tone="muted">
                        {new Date(report.createdAt).toLocaleString()} · On-device
                      </AppText>
                    </View>

                    <View style={styles.cardActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Share scan"
                        onPress={() => void shareScan(report)}
                        style={styles.actionBtn}
                      >
                        <Ionicons name="share-social-outline" size={17} color={colors.accent} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Delete scan"
                        onPress={() => handleDelete(report.id)}
                        style={styles.actionBtn}
                      >
                        <Ionicons name="trash-outline" size={17} color={colors.primary} />
                      </Pressable>
                    </View>
                  </View>

                  {report.note ? (
                    <View style={styles.noteRow}>
                      <Ionicons name="chatbubble-outline" size={12} color={colors.mutedForeground} />
                      <AppText size={11} tone="muted" numberOfLines={2}>
                        {report.note}
                      </AppText>
                    </View>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/report/[id]', params: { id: report.id } })}
                    style={styles.openReport}
                  >
                    <AppText size={11} tone="accent" weight="semibold">View full report details</AppText>
                    <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                  </Pressable>
                </Panel>
              </Animated.View>
            );
          })}
        </View>
      ) : (
        <Panel style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="scan-outline" size={24} color={colors.accent} />
          </View>
          <AppText size={14} weight="semibold">No scans in this filter</AppText>
          <AppText size={11} tone="muted">
            {reports.length === 0
              ? 'You have not scanned any potholes yet.'
              : 'Try changing your filter settings.'}
          </AppText>
          <AppButton
            title="Scan a pothole now"
            icon="scan-outline"
            onPress={() => router.push('/ai-scan')}
            style={{ marginTop: 6 }}
          />
        </Panel>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 35, gap: 15 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterGroup: { gap: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  list: { gap: 10 },
  recordCard: { gap: 10, padding: 14 },
  recordHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbImage: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#2A1A13' },
  sourceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A1A13',
  },
  recordCopy: { flex: 1, gap: 4 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confidencePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#231815',
  },
  countPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7C2D12',
  },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  openReport: {
    minHeight: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#353535',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  empty: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  emptyIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A1A13' },
});
