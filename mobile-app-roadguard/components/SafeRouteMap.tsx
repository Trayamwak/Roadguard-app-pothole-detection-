import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Panel } from '@/components/AppUI';
import type { SafeRouteOption } from '@/lib/safe-routes';

export function SafeRouteMap({ route }: { route: SafeRouteOption | null }) {
  return (
    <Panel style={styles.placeholder}>
      <AppText size={14} weight="semibold">Route map preview</AppText>
      <AppText size={11} tone="muted">
        {route ? 'Open this route in Google Maps to navigate.' : 'Search a destination to compare routes.'}
      </AppText>
      {route ? <View style={styles.routeLine} /> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  placeholder: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 10 },
  routeLine: { width: '72%', height: 4, borderRadius: 3, backgroundColor: '#E10600' },
});
