import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { AppText, Panel } from '@/components/AppUI';
import { useColors } from '@/hooks/useColors';
import type { SafeRouteOption } from '@/lib/safe-routes';

export function SafeRouteMap({ route }: { route: SafeRouteOption | null }) {
  const colors = useColors();
  if (!route?.points.length) {
    return (
      <Panel style={styles.empty}>
        <AppText size={13} weight="semibold">Route map preview</AppText>
        <AppText size={11} tone="muted">Search a destination to compare routes.</AppText>
      </Panel>
    );
  }
  const latitudes = route.points.map((point) => point.latitude);
  const longitudes = route.points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const region = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.012, (maxLat - minLat) * 1.35),
    longitudeDelta: Math.max(0.012, (maxLng - minLng) * 1.35),
  };
  return (
    <View style={[styles.frame, { borderColor: colors.border }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS !== 'ios' || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        customMapStyle={[{ elementType: 'geometry', stylers: [{ color: '#171717' }] }, { elementType: 'labels.text.fill', stylers: [{ color: '#A3A3A3' }] }, { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#292929' }] }]}
      >
        <Polyline coordinates={route.points} strokeColor="#E10600" strokeWidth={5} />
        {route.warnings.map((warning) => (
          <Marker
            key={warning.report_id}
            coordinate={{ latitude: warning.lat, longitude: warning.lng }}
            pinColor={warning.severity === 'Critical' ? '#111111' : '#E10600'}
            title={`${warning.severity} pothole`}
            description="Known open report near this route"
          />
        ))}
      </MapView>
      <View style={styles.warningLegend}>
        <View style={styles.warningDot} />
        <AppText size={10} weight="semibold">Known pothole warnings</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 260, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  warningLegend: { position: 'absolute', top: 10, left: 10, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: 'rgba(10,10,10,0.86)', flexDirection: 'row', alignItems: 'center', gap: 7 },
  warningDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E10600' },
  empty: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
