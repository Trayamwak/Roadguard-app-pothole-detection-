import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppButton, AppScreen, AppText, Field, Panel, PageTitle, SmallIconButton } from '@/components/AppUI';
import { SkeletonReportCard } from '@/components/SkeletonLoader';
import { SafeRouteMap } from '@/components/SafeRouteMap';
import { findSafeRoutes, type SafeRouteOption } from '@/lib/safe-routes';
import { useColors } from '@/hooks/useColors';

type Coordinates = { lat: number; lng: number };

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export default function SafeRouteScreen() {
  const colors = useColors();
  const { destination: destinationParam } = useLocalSearchParams<{ destination?: string }>();
  const [destination, setDestination] = useState(destinationParam ?? '');
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [routes, setRoutes] = useState<SafeRouteOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notice, setNotice] = useState('');
  const [locationError, setLocationError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDestination(destinationParam ?? '');
  }, [destinationParam]);

  const getOrigin = useCallback(async (askPermission: boolean) => {
    setLocationError('');
    try {
      if (Platform.OS === 'web') {
        if (!askPermission || !navigator.geolocation) return null;
        return await new Promise<Coordinates>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
            (failure) => reject(new Error(failure.message || 'Location permission was not granted.')),
            { enableHighAccuracy: true, timeout: 10000 },
          );
        });
      }
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && askPermission) permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return null;
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch (cause) {
      setLocationError(cause instanceof Error ? cause.message : 'Could not read your location.');
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getOrigin(false).then((position) => {
      if (active && position) setOrigin(position);
    });
    return () => { active = false; };
  }, [getOrigin]);

  const attachOrigin = async () => {
    const position = await getOrigin(true);
    if (!position) {
      setLocationError((current) => current || 'Allow location access to set your starting point.');
      return;
    }
    setOrigin(position);
  };

  const search = async () => {
    setError('');
    if (!destination.trim()) {
      setError('Enter a destination to compare routes.');
      return;
    }
    let startingPoint = origin;
    if (!startingPoint) startingPoint = await getOrigin(true);
    if (!startingPoint) {
      setError('Add your current location so the route can start from the right place.');
      return;
    }
    setOrigin(startingPoint);
    setLoading(true);
    try {
      const result = await findSafeRoutes(startingPoint, destination.trim());
      setRoutes(result.routes);
      setSelectedIndex(0);
      setNotice(result.notice);
      if (!result.routes.length) setError('No driving routes were returned for this destination.');
      else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } catch (cause) {
      setRoutes([]);
      setError(cause instanceof Error ? cause.message : 'Could not find a safer route.');
    } finally {
      setLoading(false);
    }
  };

  const openGoogleMaps = async () => {
    if (!origin) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${encodeURIComponent(destination.trim())}&travelmode=driving`;
    try {
      await Linking.openURL(url);
    } catch {
      setError('Could not open Google Maps. Check that a maps app or browser is available.');
    }
  };

  const selectedRoute = routes[selectedIndex] ?? null;

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <View style={styles.top}>
        <SmallIconButton icon="chevron-back" accessibilityLabel="Go back" onPress={() => router.back()} />
        <PageTitle eyebrow="Road-aware navigation" title="Safer route" subtitle="Compare Google driving routes against known road hazards." />
      </View>
      <Panel style={styles.searchPanel}>
        <Field
          label="Destination"
          value={destination}
          onChangeText={(value) => { setDestination(value); setRoutes([]); setError(''); }}
          placeholder="Address, landmark, or place"
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <View style={styles.originRow}>
          <Ionicons name={origin ? 'location' : 'location-outline'} size={17} color={origin ? colors.success : colors.mutedForeground} />
          <AppText size={11} tone="muted" style={styles.originText}>
            {origin ? `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}` : 'Starting point not set'}
          </AppText>
          <Pressable accessibilityRole="button" onPress={attachOrigin} style={styles.originButton}>
            <AppText size={10} tone="accent" weight="semibold">Use my location</AppText>
          </Pressable>
        </View>
        {locationError ? <AppText size={11} tone="warning">{locationError}</AppText> : null}
        <AppButton
          title={loading ? 'Comparing routes…' : 'Find safer routes'}
          icon={loading ? undefined : 'git-compare-outline'}
          loading={loading}
          disabled={destination.trim().length < 2}
          onPress={search}
        />
      </Panel>

      {loading ? (
        <View style={styles.list}>{[0, 1].map((item) => <SkeletonReportCard key={item} />)}</View>
      ) : null}
      {!loading && routes.length ? (
        <>
          <SafeRouteMap route={selectedRoute} />
          <View style={styles.routeHeader}>
            <AppText size={14} weight="semibold">{routes.length} route option{routes.length === 1 ? '' : 's'}</AppText>
            <AppText size={10} tone="muted">Ranked for known hazards</AppText>
          </View>
          <View style={styles.list}>
            {routes.map((route, index) => (
              <Animated.View key={`${route.polyline}-${index}`} entering={FadeInDown.delay(index * 50).duration(260)}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedIndex === index }}
                  onPress={() => setSelectedIndex(index)}
                  style={[
                    styles.routeCard,
                    { borderColor: selectedIndex === index ? colors.accent : colors.border, backgroundColor: colors.card },
                  ]}
                >
                  <View style={styles.routeCardTop}>
                    <View style={styles.routeRank}>
                      <AppText size={11} weight="bold" tone={selectedIndex === index ? 'accent' : 'muted'}>{index + 1}</AppText>
                    </View>
                    <View style={styles.routeDetails}>
                      <AppText size={14} weight="bold">{formatDuration(route.duration_seconds)}</AppText>
                      <AppText size={10} tone="muted">{formatDistance(route.distance_meters)} · score {formatDuration(route.score_seconds)}</AppText>
                    </View>
                    <View style={[styles.warningBadge, { backgroundColor: route.warning_count ? '#351512' : '#16291F' }]}>
                      <Ionicons name={route.warning_count ? 'warning-outline' : 'checkmark-circle-outline'} size={14} color={route.warning_count ? colors.primary : colors.success} />
                      <AppText size={10} tone={route.warning_count ? 'warning' : 'success'} weight="semibold">{route.warning_count} hazard{route.warning_count === 1 ? '' : 's'}</AppText>
                    </View>
                  </View>
                  {route.warnings.length ? (
                    <AppText size={10} tone="muted" style={styles.warningText}>
                      {route.warnings.map((warning) => warning.severity).join(' · ')} pothole reports within 75 m of this route.
                    </AppText>
                  ) : (
                    <AppText size={10} tone="success">No known High/Critical potholes near this route.</AppText>
                  )}
                </Pressable>
              </Animated.View>
            ))}
          </View>
          {notice ? <AppText size={10} tone="muted" style={styles.notice}>{notice}</AppText> : null}
          <AppButton title="Navigate in Google Maps" icon="navigate-outline" onPress={openGoogleMaps} />
        </>
      ) : null}
      {error ? <AppText size={11} tone="warning" style={styles.error}>{error}</AppText> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 35, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchPanel: { gap: 11 },
  originRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 7 },
  originText: { flex: 1 },
  originButton: { minHeight: 30, justifyContent: 'center', paddingHorizontal: 5 },
  list: { gap: 9 },
  routeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeCard: { borderWidth: 1, borderRadius: 17, padding: 12, gap: 8 },
  routeCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeRank: { width: 31, height: 31, borderRadius: 11, backgroundColor: '#2A1A13', alignItems: 'center', justifyContent: 'center' },
  routeDetails: { flex: 1, gap: 3 },
  warningBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 100, flexDirection: 'row', alignItems: 'center', gap: 4 },
  warningText: { lineHeight: 15 },
  notice: { lineHeight: 16 },
  error: { lineHeight: 16 },
});
