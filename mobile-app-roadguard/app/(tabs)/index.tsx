import React, { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { AppButton, AppScreen, AppText, Panel, PageTitle, ReportRow, StatTile } from '@/components/AppUI';
import { useApp } from '@/providers/AppProvider';
import { usePotholeDetection, type PotholeImpactEvent } from '@/hooks/usePotholeDetection';
import { usePotholeProximity } from '@/hooks/usePotholeProximity';
import { useColors } from '@/hooks/useColors';
import { saveDriveImpactLog } from '@/lib/storage';

function RadarButton({ onPress, enabled }: { onPress: () => void; enabled: boolean }) {
  const colors = useColors();
  const pulse = useSharedValue(1);
  React.useEffect(() => {
    pulse.value = withRepeat(withTiming(1.12, { duration: 1000 }), -1, true);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={enabled ? 'Stop Drive Mode' : 'Start Drive Mode'}
      onPress={onPress}
      style={styles.driveButton}
    >
      <Animated.View style={[styles.radarOuter, { borderColor: enabled ? colors.primary : colors.border }, enabled && pulseStyle]}>
        <View style={[styles.radarInner, { backgroundColor: enabled ? '#311412' : colors.secondary }]}>
          <Ionicons name={enabled ? 'pause' : 'radio-outline'} size={29} color={enabled ? colors.primary : colors.accent} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const {
    userName,
    setUserName,
    reports,
    settings,
    updateSettings,
    addReport,
  } = useApp();

  const [pendingSpike, setPendingSpike] = useState<PotholeImpactEvent | null>(null);
  const [driveError, setDriveError] = useState('');
  const [dismissedProximityId, setDismissedProximityId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(userName || '');

  const onPossiblePothole = useCallback((event: PotholeImpactEvent) => {
    setPendingSpike(event);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);

    // Save into on-device drive impact log
    void saveDriveImpactLog({
      id: `impact-${event.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: event.timestamp,
      date: new Date(event.timestamp).toISOString(),
      speedKmh: event.speedKmh,
      magnitudeG: event.magnitude,
      severity: event.severity,
      latitude: event.latitude,
      longitude: event.longitude,
    });
  }, []);

  const { speedKmh, sensorAvailable, liveG, drivePotholeCount, isStationary, isMonitoring } = usePotholeDetection(
    settings.driveMode,
    settings.sensitivity,
    onPossiblePothole,
  );

  const proximityAlert = usePotholeProximity(reports, settings.driveMode);

  const startDriveMode = async () => {
    if (settings.driveMode) {
      await updateSettings({ ...settings, driveMode: false });
      return;
    }
    if (Platform.OS === 'web') {
      setDriveError('Drive Mode motion detection is available in the Android and iOS app.');
      return;
    }

    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Location while driving',
        'Roadguard checks your speed and saves a location only when you confirm a report. All data is kept locally on this device.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Allow location',
            onPress: async () => {
              const result = await Location.requestForegroundPermissionsAsync();
              if (result.granted) {
                await updateSettings({ ...settings, driveMode: true });
              } else {
                setDriveError('Location is needed to confirm speed and place a report on the map.');
              }
            },
          },
        ],
      );
      return;
    }
    await updateSettings({ ...settings, driveMode: true });
    setDriveError('');
  };

  const confirmSpike = async () => {
    if (pendingSpike == null) return;
    const spike = pendingSpike;
    setPendingSpike(null);

    // Directly save to local reports
    const newReport = {
      id: `sensor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: 'local_device_user',
      authorLabel: userName || 'Local Reporter',
      lat: spike.latitude,
      lng: spike.longitude,
      latitude: spike.latitude,
      longitude: spike.longitude,
      severity: spike.severity,
      confidence: Math.min(95, Math.round(spike.magnitude * 38)),
      reason: `Vertical accelerometer spike of ${spike.magnitude}g detected at ${spike.speedKmh} km/h`,
      description: `Pothole shock impact detected by device accelerometer sensor. Magnitude: ${spike.magnitude}g. Speed: ${spike.speedKmh} km/h.`,
      is_road_surface: true,
      has_pothole: true,
      pothole_count: 1,
      source: 'sensor' as const,
      status: 'open' as const,
      upvotes: 0,
      createdAt: Date.now(),
      date: new Date().toISOString(),
      note: `Recorded in Drive Mode at ${spike.speedKmh} km/h`,
      spikeMagnitude: spike.magnitude,
    };

    await addReport(newReport);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };

  const handleSaveName = async () => {
    if (tempName.trim()) {
      await setUserName(tempName.trim());
      setIsEditingName(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
  };

  const ownReports = reports;
  const openReports = reports.filter((report) => report.status === 'open');
  const myPoints = ownReports.length * 25;
  const latest = reports.slice(0, 3);
  const displaySpeed = settings.useMiles ? speedKmh * 0.621371 : speedKmh;
  const speedUnit = settings.useMiles ? 'mph' : 'km/h';
  const visibleProximityAlert = proximityAlert?.report.id === dismissedProximityId ? null : proximityAlert;
  const proximityDistance = visibleProximityAlert
    ? settings.useMiles
      ? `${(visibleProximityAlert.distance / 1609.34).toFixed(2)} mi`
      : `${Math.round(visibleProximityAlert.distance)} m`
    : '';

  return (
    <AppScreen scroll contentStyle={styles.content}>
      {/* Header with Custom Greeting: "Hi [username]" + Edit Name Button */}
      <View style={styles.headerRow}>
        <View style={styles.greetingContainer}>
          <AppText size={11} tone="muted" weight="bold" style={styles.eyebrow}>
            ROADGUARD RADAR
          </AppText>
          <View style={styles.nameRow}>
            <AppText size={24} weight="bold">
              Hi {userName || 'Rider'}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit display name"
              onPress={() => {
                setTempName(userName || '');
                setIsEditingName(true);
              }}
              style={styles.editNameBtn}
            >
              <Ionicons name="pencil" size={15} color={colors.accent} />
            </Pressable>
          </View>
          <AppText size={12} tone="muted">
            Ready to spot some road hazards?
          </AppText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => router.push('/settings')}
          style={styles.profileAvatar}
        >
          <AppText size={15} weight="bold" tone="accent">
            {(userName || 'R').slice(0, 1).toUpperCase()}
          </AppText>
        </Pressable>
      </View>

      {/* Edit Name Modal */}
      <Modal
        visible={isEditingName}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditingName(false)}
      >
        <View style={styles.modalOverlay}>
          <Panel style={styles.editModal}>
            <View style={styles.modalHeader}>
              <AppText size={16} weight="bold">Edit Your Name</AppText>
              <Pressable onPress={() => setIsEditingName(false)}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <AppText size={12} tone="muted">
              Choose how you want Roadguard to greet you.
            </AppText>
            <TextInput
              value={tempName}
              onChangeText={setTempName}
              placeholder="Your name"
              placeholderTextColor="#78716C"
              style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border }]}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setIsEditingName(false)}
                style={[styles.modalCancel, { borderColor: colors.border }]}
              >
                <AppText size={13} weight="semibold" tone="muted">Cancel</AppText>
              </Pressable>
              <Pressable
                onPress={handleSaveName}
                style={[styles.modalSave, { backgroundColor: colors.primary }]}
              >
                <AppText size={13} weight="semibold" style={{ color: colors.primaryForeground }}>Save</AppText>
              </Pressable>
            </View>
          </Panel>
        </View>
      </Modal>

      {/* Drive Mode Radar Panel */}
      <Panel style={styles.drivePanel}>
        <View style={styles.driveTop}>
          <View style={styles.driveCopy}>
            <AppText size={16} weight="bold">
              {settings.driveMode ? 'Drive Mode active' : 'Drive Mode radar'}
            </AppText>
            <AppText size={12} tone="muted" style={styles.driveText}>
              {settings.driveMode
                ? 'Road accelerometer and proximity radar are monitoring your lane.'
                : 'Tap the radar to start motion sensor pothole detection while driving.'}
            </AppText>
          </View>
          <RadarButton onPress={startDriveMode} enabled={settings.driveMode} />
        </View>

        {settings.driveMode && (
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor: isStationary ? '#29180A' : '#052E16',
                borderColor: isStationary ? '#854D0E' : '#166534',
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isStationary ? '#F59E0B' : '#4ADE80' },
              ]}
            />
            <AppText
              size={11}
              weight="bold"
              style={{ color: isStationary ? '#FBBF24' : '#4ADE80' }}
            >
              {isStationary ? 'STATIONARY (Detection Paused)' : 'MONITORING ROAD...'}
            </AppText>
          </View>
        )}

        <View style={[styles.driveDivider, { backgroundColor: colors.border }]} />

        <View style={styles.driveMetrics}>
          <View style={styles.metricBlock}>
            <AppText size={10} tone="muted" weight="bold">SPEED</AppText>
            <AppText size={18} weight="bold">
              {displaySpeed.toFixed(0)} <AppText size={11} tone="muted">{speedUnit}</AppText>
            </AppText>
          </View>
          <View style={styles.metricBlock}>
            <AppText size={10} tone="muted" weight="bold">POTHOLES DETECTED</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="disc" size={13} color={drivePotholeCount > 0 ? '#FB923C' : colors.mutedForeground} />
              <AppText size={18} weight="bold" style={{ color: drivePotholeCount > 0 ? '#FB923C' : colors.foreground }}>
                {drivePotholeCount}
              </AppText>
            </View>
          </View>
          <View style={styles.metricBlock}>
            <AppText size={10} tone="muted" weight="bold">RADAR DELTA G</AppText>
            <AppText size={18} weight="bold">
              {liveG.toFixed(2)} <AppText size={10} tone="muted">Δg</AppText>
            </AppText>
          </View>
          <View style={[styles.monitorBadge, { borderColor: colors.border }]}>
            <View
              style={[
                styles.liveDot,
                {
                  backgroundColor: settings.driveMode
                    ? isMonitoring
                      ? colors.success
                      : '#F59E0B'
                    : colors.mutedForeground,
                },
              ]}
            />
            <AppText size={10} tone="muted" weight="bold">
              {settings.driveMode ? (isMonitoring ? 'RADAR ACTIVE' : 'PAUSED') : 'STANDBY'}
            </AppText>
          </View>
        </View>
      </Panel>

      {pendingSpike != null ? (
        <Panel style={[styles.alertPanel, { borderColor: colors.primary }]}>
          <View style={styles.alertHead}>
            <View style={styles.alertIcon}><Ionicons name="flash" size={21} color={colors.primary} /></View>
            <View style={styles.noticeCopy}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppText size={14} weight="bold">Pothole shock impact detected</AppText>
                <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: pendingSpike.severity === 'High' ? '#7F1D1D' : pendingSpike.severity === 'Medium' ? '#7C2D12' : '#064E3B' }}>
                  <AppText size={9} weight="bold" style={{ color: '#FFFFFF' }}>{pendingSpike.severity}</AppText>
                </View>
              </View>
              <AppText size={12} tone="muted">
                Magnitude {pendingSpike.magnitude.toFixed(1)}g at {pendingSpike.speedKmh} km/h. Saved to local impact log.
              </AppText>
            </View>
          </View>
          <View style={styles.alertActions}>
            <AppButton title="Dismiss" variant="secondary" onPress={() => setPendingSpike(null)} style={styles.halfButton} />
            <AppButton title="Save as Report" icon="checkmark-circle-outline" onPress={confirmSpike} style={styles.halfButton} />
          </View>
        </Panel>
      ) : null}

      {visibleProximityAlert ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/report/[id]', params: { id: visibleProximityAlert.report.id } })}
          style={[styles.proximityAlert, { borderColor: colors.primary }]}
        >
          <View style={styles.proximityIcon}><Ionicons name="warning" size={20} color={colors.primary} /></View>
          <View style={styles.noticeCopy}>
            <AppText size={14} weight="bold" tone="warning">Pothole ahead</AppText>
            <AppText size={11} tone="muted">{visibleProximityAlert.report.severity} · {proximityDistance} away. Drive carefully.</AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss pothole proximity alert"
            onPress={() => setDismissedProximityId(visibleProximityAlert.report.id)}
            style={styles.dismissAlert}
          >
            <Ionicons name="close" size={17} color={colors.mutedForeground} />
          </Pressable>
        </Pressable>
      ) : null}

      {driveError ? <AppText size={12} tone="warning">{driveError}</AppText> : null}

      {/* Stats Bar */}
      <View style={styles.statRow}>
        <StatTile label="Open nearby" value={openReports.length} icon="alert-circle-outline" accent />
        <StatTile label="On-device" value={ownReports.length} icon="hardware-chip-outline" />
        <StatTile label="Radar points" value={myPoints} icon="trophy-outline" />
      </View>

      {/* Quick Actions */}
      <View style={styles.sectionHeading}>
        <View>
          <AppText size={18} weight="bold">Quick actions</AppText>
          <AppText size={12} tone="muted" style={styles.sectionSub}>Spot and save road hazards locally.</AppText>
        </View>
      </View>

      <View style={styles.quickActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/ai-scan')}
          style={({ pressed }) => [styles.actionTile, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
        >
          <LinearGradient colors={[colors.primary, colors.accent]} style={styles.actionIcon}>
            <Ionicons name="scan" size={21} color={colors.primaryForeground} />
          </LinearGradient>
          <AppText size={13} weight="semibold">AI Scanner</AppText>
          <AppText size={11} tone="muted">FastAPI model check</AppText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/report/new', params: { source: 'camera' } })}
          style={({ pressed }) => [styles.actionTile, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#2C2011' }]}>
            <Ionicons name="camera" size={21} color={colors.accent} />
          </View>
          <AppText size={13} weight="semibold">New report</AppText>
          <AppText size={11} tone="muted">Manual entry</AppText>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/scan-history')} style={styles.historyLink}>
        <Ionicons name="time-outline" size={16} color={colors.accent} />
        <AppText size={12} tone="accent" weight="semibold">View saved scan history ({reports.length})</AppText>
      </Pressable>

      {/* Latest Sightings */}
      <View style={styles.sectionHeading}>
        <View style={styles.flex}>
          <AppText size={18} weight="bold">Saved Reports</AppText>
          <AppText size={12} tone="muted" style={styles.sectionSub}>Stored directly on this device</AppText>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/scan-history')}>
          <AppText size={12} tone="accent" weight="semibold">View all</AppText>
        </Pressable>
      </View>

      {latest.length ? (
        <View style={styles.latestList}>
          {latest.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              onPress={() => router.push({ pathname: '/report/[id]', params: { id: report.id } })}
            />
          ))}
        </View>
      ) : (
        <Panel style={styles.firstReport}>
          <View style={styles.firstIcon}><Ionicons name="radio-outline" size={22} color={colors.accent} /></View>
          <View style={styles.noticeCopy}>
            <AppText size={14} weight="semibold">Your radar starts here</AppText>
            <AppText size={12} tone="muted" style={styles.sectionSub}>No saved scans yet. Launch the AI scan to capture your first pothole!</AppText>
          </View>
        </Panel>
      )}

      <Panel style={styles.safety}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
        <AppText size={11} tone="muted" style={styles.safetyText}>
          All scans, photos, and coordinates remain on-device for total privacy.
        </AppText>
      </Panel>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 14, paddingBottom: 26, gap: 17 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greetingContainer: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editNameBtn: { padding: 4, borderRadius: 8, backgroundColor: '#2C1D18' },
  eyebrow: { letterSpacing: 1.7 },
  profileAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A1A13',
    borderWidth: 1.5,
    borderColor: '#4B211C',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  editModal: {
    width: '100%',
    maxWidth: 340,
    padding: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1E1615',
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  modalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalSave: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  drivePanel: { padding: 17, gap: 15 },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  driveTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  driveCopy: { flex: 1, gap: 5 },
  driveText: { lineHeight: 17, maxWidth: 220 },
  driveButton: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  radarOuter: { width: 78, height: 78, borderWidth: 1, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
  radarInner: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  driveDivider: { height: StyleSheet.hairlineWidth },
  driveMetrics: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  metricBlock: { gap: 2 },
  monitorBadge: { marginLeft: 'auto', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 100, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  alertPanel: { borderWidth: 1, gap: 13 },
  proximityAlert: { borderWidth: 1, borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#291311' },
  proximityIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3A1713' },
  dismissAlert: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  alertHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  alertIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#31200F' },
  alertActions: { flexDirection: 'row', gap: 9 },
  halfButton: { flex: 1 },
  statRow: { flexDirection: 'row', gap: 9 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionSub: { marginTop: 4, lineHeight: 17 },
  quickActions: { flexDirection: 'row', gap: 12 },
  historyLink: { alignSelf: 'center', minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionTile: { flex: 1, minHeight: 125, borderRadius: 19, borderWidth: 1, padding: 14, gap: 6 },
  actionIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  latestList: { gap: 9 },
  firstReport: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  firstIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#2C2011', alignItems: 'center', justifyContent: 'center' },
  safety: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12 },
  safetyText: { flex: 1, lineHeight: 17 },
  flex: { flex: 1 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
