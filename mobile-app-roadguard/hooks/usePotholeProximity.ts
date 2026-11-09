import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { distanceMeters } from '@/lib/geo';
import type { PotholeReport } from '@/types';

export function usePotholeProximity(reports: PotholeReport[], enabled: boolean) {
  const [alert, setAlert] = useState<{ report: PotholeReport; distance: number } | null>(null);
  const alreadyAlerted = useRef(new Set<string>());
  const lastAlertAt = useRef(0);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') {
      setAlert(null);
      alreadyAlerted.current.clear();
      return;
    }
    let active = true;
    let subscription: { remove: () => void } | null = null;
    const start = async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!active || !permission.granted) return;
      const watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 4000 },
        (position) => {
          if (!active) return;
          const userPosition = { lat: position.coords.latitude, lng: position.coords.longitude };
          const highRisk = reports.filter(
            (report) => report.status === 'open' && (report.severity === 'High' || report.severity === 'Critical'),
          );
          let nearest: { report: PotholeReport; distance: number } | null = null;
          for (const report of highRisk) {
            const distance = distanceMeters(userPosition, report);
            if (distance > 260) alreadyAlerted.current.delete(report.id);
            if (distance <= 200 && (!nearest || distance < nearest.distance)) nearest = { report, distance };
          }
          setAlert(nearest);
          if (nearest && !alreadyAlerted.current.has(nearest.report.id) && Date.now() - lastAlertAt.current > 10000) {
            alreadyAlerted.current.add(nearest.report.id);
            lastAlertAt.current = Date.now();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
          }
        },
      );
      if (!active) watcher.remove();
      else subscription = watcher;
    };
    start().catch(() => undefined);
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enabled, reports]);

  return alert;
}
