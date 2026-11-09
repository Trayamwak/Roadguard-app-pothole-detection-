import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { AppButton, AppScreen, AppText, Field, Panel, PageTitle, Pill, ReportRow } from '@/components/AppUI';
import { MapSurface } from '@/components/MapSurface';
import { useApp } from '@/providers/AppProvider';
import { useColors } from '@/hooks/useColors';
import type { PotholeReport, Severity } from '@/types';

const severities: ('All' | Severity)[] = ['All', 'Low', 'Medium', 'High', 'Critical'];
const dateWindows = ['24h', '7 days', '30 days', 'All'] as const;
type MapCoordinates = { latitude: number; longitude: number };

export default function MapScreen() {
  const colors = useColors();
  const { reports, firebaseReady } = useApp();
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [location, setLocation] = useState<MapCoordinates | null>(null);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [severity, setSeverity] = useState<(typeof severities)[number]>('All');
  const [dateWindow, setDateWindow] = useState<(typeof dateWindows)[number]>('7 days');
  const [destination, setDestination] = useState('');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Location.getForegroundPermissionsAsync()
      .then((value) => setPermissionGranted(value.granted))
      .catch(() => undefined);
  }, []);

  const requestLocation = async () => {
    setPermissionBusy(true);
    setPermissionError('');
    try {
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) {
          setPermissionError('Location is not available in this browser.');
          return;
        }
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
              setPermissionGranted(true);
              resolve();
            },
            (error) => reject(new Error(error.message || 'Location permission was not granted.')),
            { enableHighAccuracy: true, timeout: 10000 },
          );
        });
        return;
      }
      const access = await Location.requestForegroundPermissionsAsync();
      setPermissionGranted(access.granted);
      if (!access.granted) {
        setPermissionError(access.canAskAgain ? 'Location permission was not granted.' : 'Enable location access in your device settings to center the map.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    } catch (error) {
      setPermissionError(error instanceof Error ? error.message : 'Could not read your location.');
    } finally {
      setPermissionBusy(false);
    }
  };

  const filteredReports = useMemo(() => {
    const cutoff =
      dateWindow === '24h'
        ? Date.now() - 86400000
        : dateWindow === '7 days'
          ? Date.now() - 7 * 86400000
          : dateWindow === '30 days'
            ? Date.now() - 30 * 86400000
            : 0;
    return reports.filter(
      (report) =>
        (severity === 'All' || report.severity === severity) &&
        report.createdAt >= cutoff,
    );
  }, [dateWindow, reports, severity]);

  const firstReport = filteredReports[0];
  const center = location ?? (firstReport ? { latitude: firstReport.lat, longitude: firstReport.lng } : null);
  const mapRegion = center ? { ...center, latitudeDelta: 0.035, longitudeDelta: 0.035 } : null;

  return (
    <AppScreen contentStyle={styles.content}>
      <PageTitle
        eyebrow="Live map"
        title="Road watch"
        subtitle={firebaseReady ? `${filteredReports.length} reports in the selected view` : 'Connect Firebase to see reports shared by the community.'}
        right={
          <Pressable accessibilityRole="button" accessibilityLabel="Center map on my location" onPress={requestLocation} style={styles.locateButton}>
            {permissionBusy ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="locate-outline" size={20} color={colors.accent} />}
          </Pressable>
        }
      />
      <View style={styles.filterGroup}>
        <View style={styles.filters}>
          {severities.map((option) => (
            <Pill key={option} title={option} selected={severity === option} onPress={() => setSeverity(option)} />
          ))}
        </View>
        <View style={styles.filters}>
          {dateWindows.map((option) => (
            <Pill key={option} title={option} selected={dateWindow === option} onPress={() => setDateWindow(option)} />
          ))}
        </View>
      </View>
      <Panel style={styles.destinationPanel}>
        <Field
          label="Search destination"
          value={destination}
          onChangeText={setDestination}
          placeholder="Address, landmark, or place"
          returnKeyType="search"
          onSubmitEditing={() => destination.trim().length >= 2 && router.push({ pathname: '/safe-route', params: { destination: destination.trim() } })}
        />
        <AppButton
          title="Find a safer route"
          icon="navigate-outline"
          variant="secondary"
          disabled={destination.trim().length < 2}
          onPress={() => router.push({ pathname: '/safe-route', params: { destination: destination.trim() } })}
        />
      </Panel>

      {mapRegion ? (
        <MapSurface reports={filteredReports} region={mapRegion} permissionGranted={permissionGranted} />
      ) : (
        <Panel style={styles.mapPermission}>
          <View style={styles.mapIcon}><Ionicons name="navigate-outline" size={25} color={colors.accent} /></View>
          <AppText size={16} weight="semibold">Center your road map</AppText>
          <AppText size={12} tone="muted" style={styles.permissionText}>
            Your location is used only while the app is open to center the map. It is not published unless you submit a report.
          </AppText>
          {permissionError ? <AppText size={12} tone="warning">{permissionError}</AppText> : null}
          <AppButton title={permissionBusy ? 'Locating…' : permissionGranted ? 'Use my location' : 'Allow location'} icon="locate-outline" loading={permissionBusy} onPress={requestLocation} />
        </Panel>
      )}

      <View style={styles.listHead}>
        <AppText size={16} weight="bold">Reports on this map</AppText>
        <AppText size={11} tone="muted">{filteredReports.length}</AppText>
      </View>
      {filteredReports.length ? (
        <View style={styles.list}>
          {filteredReports.slice(0, 4).map((report: PotholeReport) => (
            <ReportRow
              key={report.id}
              report={report}
              onPress={() => router.push({ pathname: '/report/[id]', params: { id: report.id } })}
            />
          ))}
        </View>
      ) : (
        <AppText size={12} tone="muted" style={styles.emptyMap}>No reports match the selected filters.</AppText>
      )}
      <AppButton title="Report a pothole" icon="camera-outline" onPress={() => router.push({ pathname: '/report/new', params: { source: 'camera' } })} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingTop: 14, paddingBottom: 18, gap: 14 },
  locateButton: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  filterGroup: { gap: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  destinationPanel: { gap: 10 },
  mapPermission: { alignItems: 'center', paddingVertical: 25, gap: 12 },
  mapIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#2A1A13', alignItems: 'center', justifyContent: 'center' },
  permissionText: { maxWidth: 300, lineHeight: 18, textAlign: 'center' },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  list: { gap: 8 },
  emptyMap: { paddingVertical: 6 },
});
