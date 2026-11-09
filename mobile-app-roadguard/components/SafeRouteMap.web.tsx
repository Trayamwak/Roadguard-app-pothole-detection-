import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Panel } from '@/components/AppUI';
import type { SafeRouteOption } from '@/lib/safe-routes';

export function SafeRouteMap({ route }: { route: SafeRouteOption | null }) {
  return (
    <Panel style={styles.placeholder}>
      <AppText size={14} weight="semibold">Route preview is available in the native app</AppText>
      <AppText size={11} tone="muted">
        {route ? `Selected route passes near ${route.warning_count} known High/Critical report(s).` : 'Search a destination to compare routes.'}
      </AppText>
      {route ? <View style={styles.routeLine} /> : null}
      <AppText size={10} tone="muted">Use the Google Maps link for turn-by-turn directions.</AppText>
    </Panel>
  );
}

const styles = StyleSheet.create({
  placeholder: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  routeLine: { width: '72%', height: 4, borderRadius: 3, backgroundColor: '#E10600' },
});
