import React, { useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton, AppScreen, AppText, EmptyState, Panel, PageTitle, SeverityBadge, SmallIconButton } from '@/components/AppUI';
import { DetectionOverlay } from '@/components/DetectionOverlay';
import { updateReportStatus } from '@/lib/reports';
import { useApp } from '@/providers/AppProvider';
import { useColors } from '@/hooks/useColors';

export default function ReportDetailsScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { reports, user, confirmPothole } = useApp();
  const report = useMemo(() => reports.find((item) => item.id === id), [id, reports]);
  const [working, setWorking] = useState(false);
  const isOwner = !!user && report?.userId === user.uid;

  const confirm = async () => {
    if (!report) return;
    setWorking(true);
    try {
      await confirmPothole(report.id);
    } catch (error) {
      Alert.alert('Could not confirm', error instanceof Error ? error.message : 'Sign in and try again.');
    } finally {
      setWorking(false);
    }
  };

  const markFixed = async () => {
    if (!report) return;
    setWorking(true);
    try {
      await updateReportStatus(report.id, 'fixed');
      Alert.alert('Status updated', 'This report is now marked as fixed.');
    } catch (error) {
      Alert.alert('Could not update status', error instanceof Error ? error.message : 'Try again later.');
    } finally {
      setWorking(false);
    }
  };

  const navigateToReport = async () => {
    if (!report) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${report.lat},${report.lng}&travelmode=driving`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open maps', 'Install Google Maps or choose another navigation app.');
    }
  };

  const shareReport = async () => {
    if (!report) return;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${report.lat},${report.lng}`;
    await Share.share({
      title: `${report.severity} pothole · PotHoleRadar`,
      message: `${report.severity} pothole reported near ${report.address || `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`}.\n${mapsUrl}`,
    }).catch((error) => Alert.alert('Could not share report', error instanceof Error ? error.message : 'Try again.'));
  };

  if (!report) {
    return (
      <AppScreen scroll contentStyle={styles.content}>
        <SmallIconButton icon="close" accessibilityLabel="Close report details" onPress={() => router.back()} />
        <EmptyState icon="alert-circle-outline" title="Report not found" description="It may have been removed or is still waiting to sync from another device." />
      </AppScreen>
    );
  }

  const photo = report.imageUrl || report.localImageUri;
  return (
    <AppScreen scroll contentStyle={styles.content}>
      <View style={styles.topRow}>
        <SmallIconButton icon="close" accessibilityLabel="Close report details" onPress={() => router.back()} />
        <AppText size={12} tone="muted" weight="semibold">REPORT DETAILS</AppText>
        <View style={styles.flex} />
        <SmallIconButton icon="share-social-outline" accessibilityLabel="Share this report" onPress={shareReport} />
        {report.pendingSync ? (
          <View style={[styles.pending, { borderColor: colors.border }]}>
            <Ionicons name="cloud-upload-outline" size={14} color={colors.warning} />
            <AppText size={10} tone="warning" weight="semibold">ON DEVICE</AppText>
          </View>
        ) : null}
      </View>
      {photo ? (
        <View style={[styles.imageFrame, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {report.potholes ? <DetectionOverlay potholes={report.potholes} /> : null}
          <View style={styles.imageBadge}><SeverityBadge severity={report.severity} /></View>
        </View>
      ) : (
        <View style={[styles.noImage, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons
            name={report.source === 'sensor' ? 'car-sport-outline' : report.source.startsWith('ai_') ? 'scan-outline' : 'camera-outline'}
            size={32}
            color={colors.accent}
          />
          <AppText size={12} tone="muted">No photo attached</AppText>
        </View>
      )}
      <PageTitle
        eyebrow={report.status === 'fixed' ? 'Repair status · fixed' : 'Repair status · open'}
        title={`${report.pothole_count ?? (report.potholes?.length || 1)} Pothole${(report.pothole_count ?? (report.potholes?.length || 1)) === 1 ? '' : 's'} (${report.severity})`}
        subtitle={report.description || report.note || report.reason || 'Road damage reported at this location.'}
      />

      <Panel style={styles.assessment}>
        <View style={styles.assessmentHeader}>
          <AppText size={13} weight="semibold">Severity confidence</AppText>
          <AppText size={14} tone="accent" weight="bold">{report.confidence}%</AppText>
        </View>
        <View style={[styles.confidenceTrack, { backgroundColor: colors.secondary }]}>
          <View style={[styles.confidenceFill, { backgroundColor: colors.primary, width: `${Math.max(0, Math.min(100, report.confidence))}%` }]} />
        </View>
        <AppText size={12} tone="muted" style={styles.reason}>{report.description || report.reason}</AppText>
      </Panel>

      <Panel style={styles.details}>
        <Detail icon="navigate-outline" label="Coordinates" value={`${report.lat.toFixed(6)}, ${report.lng.toFixed(6)}`} />
        <Detail icon="time-outline" label="Reported" value={new Date(report.createdAt).toLocaleString()} />
        <Detail icon="person-outline" label="Submitted by" value={report.authorLabel} />
        <Detail
          icon={report.source === 'sensor' ? 'speedometer-outline' : report.source.startsWith('ai_') ? 'scan-outline' : 'camera-outline'}
          label="Report source"
          value={report.source === 'sensor' ? 'Drive Mode sensor' : report.source === 'ai_live' ? 'AI live scan' : report.source === 'ai_upload' ? 'AI image scan' : 'Camera report'}
        />
        {report.address ? <Detail icon="location-outline" label="Address" value={report.address} /> : null}
        <Detail icon="checkmark-done-outline" label="Community confirmations" value={String(report.upvotes)} last />
      </Panel>

      <AppButton title="Navigate in Google Maps" icon="navigate-outline" variant="secondary" onPress={navigateToReport} />

      {report.status === 'fixed' ? (
        <Panel style={styles.fixedState}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <View style={styles.flex}>
            <AppText size={14} weight="semibold" tone="success">Marked as fixed</AppText>
            <AppText size={11} tone="muted">Thanks for helping track the repair.</AppText>
          </View>
        </Panel>
      ) : (
        <>
          {!isOwner ? (
            <AppButton title={working ? 'Confirming…' : 'Confirm this pothole'} icon="checkmark-circle-outline" loading={working} onPress={confirm} />
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => router.push('/admin')} style={styles.adminLink}>
            <AppText size={12} tone="muted">City authority? </AppText>
            <AppText size={12} tone="accent" weight="semibold">Update repair status</AppText>
          </Pressable>
        </>
      )}
    </AppScreen>
  );
}

function Detail({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.detailRow, !last && { borderBottomColor: colors.border }]}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <View style={styles.flex}>
        <AppText size={11} tone="muted">{label}</AppText>
        <AppText size={12} weight="medium" style={styles.detailValue}>{value}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 14, paddingBottom: 35, gap: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  flex: { flex: 1 },
  pending: { borderWidth: 1, borderRadius: 100, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  imageFrame: { height: 230, borderWidth: 1, borderRadius: 21, overflow: 'hidden' },
  imageBadge: { position: 'absolute', bottom: 11, left: 11 },
  noImage: { height: 130, borderWidth: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center', gap: 8 },
  assessment: { gap: 10 },
  assessmentHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  confidenceTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  confidenceFill: { height: 7, borderRadius: 4 },
  reason: { lineHeight: 18 },
  details: { paddingVertical: 3, gap: 0 },
  detailRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  detailValue: { marginTop: 3, lineHeight: 17 },
  fixedState: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adminLink: { flexDirection: 'row', justifyContent: 'center', padding: 8 },
});
