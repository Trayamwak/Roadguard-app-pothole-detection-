import { useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface PotholeImpactEvent {
  magnitude: number;
  severity: 'Low' | 'Medium' | 'High';
  speedKmh: number;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export const SPEED_HARD_ZERO_KMH = 8.0; // Under 8.0 km/h is explicitly set to 0 km/h
export const SPEED_LOCKOUT_KMH = 12.0; // Only trigger pothole detection when speed >= 12 km/h
export const DEBOUNCE_COOLDOWN_MS = 2000; // 2.0-second debounce cooldown
export const DEFAULT_THRESHOLD_G = 1.8; // Strict threshold between 1.6g and 2.0g

export function usePotholeDetection(
  enabled: boolean,
  threshold: number = DEFAULT_THRESHOLD_G,
  onPossiblePothole?: (event: PotholeImpactEvent) => void,
) {
  const callbackRef = useRef(onPossiblePothole);
  const lastSpikeAt = useRef(0);
  const speedRef = useRef(0);
  const locationRef = useRef<{ lat: number; lng: number }>({ lat: 0, lng: 0 });

  // Low-pass filter state for isolating device gravity vector
  const lowPassX = useRef(0);
  const lowPassY = useRef(0);
  const lowPassZ = useRef(0);
  const initializedGravity = useRef(false);

  const [speedKmh, setSpeedKmh] = useState(0);
  const [sensorAvailable, setSensorAvailable] = useState(false);
  const [liveG, setLiveG] = useState(0);
  const [drivePotholeCount, setDrivePotholeCount] = useState(0);

  useEffect(() => {
    callbackRef.current = onPossiblePothole;
  }, [onPossiblePothole]);

  // Reset drive counter and calibration when drive mode toggled
  useEffect(() => {
    if (enabled) {
      setDrivePotholeCount(0);
      initializedGravity.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') {
      setSensorAvailable(false);
      setSpeedKmh(0);
      speedRef.current = 0;
      setLiveG(0);
      return;
    }

    let isMounted = true;
    let locationSubscription: Location.LocationSubscription | null = null;
    let sensorSubscription: ReturnType<typeof Accelerometer.addListener> | null = null;

    const startDriveRadar = async () => {
      try {
        // 1. Request High-Accuracy GPS permissions
        const locationPermission = await Location.requestForegroundPermissionsAsync();
        if (!locationPermission.granted || !isMounted) return;

        // Get initial location
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }).catch(() => null);

        if (initialLoc) {
          locationRef.current = {
            lat: initialLoc.coords.latitude,
            lng: initialLoc.coords.longitude,
          };
          const rawSpeed = initialLoc.coords.speed;
          if (rawSpeed == null || rawSpeed < 0 || isNaN(rawSpeed)) {
            speedRef.current = 0;
            if (isMounted) setSpeedKmh(0);
          } else {
            const kmh = rawSpeed * 3.6;
            const finalKmh = kmh < SPEED_HARD_ZERO_KMH ? 0 : Math.round(kmh);
            speedRef.current = finalKmh;
            if (isMounted) setSpeedKmh(finalKmh);
          }
        }

        // 2. Continuous Speed Tracking: distanceInterval: 2m, timeInterval: 1000ms
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 2,
          },
          (location) => {
            if (!isMounted) return;
            locationRef.current = {
              lat: location.coords.latitude,
              lng: location.coords.longitude,
            };

            const rawSpeed = location.coords.speed;
            // HARD ZERO THRESHOLD: If calculated speed is under 8.0 km/h (or if coords.speed is null/negative), explicitly set displayed speed to exactly 0 km/h
            if (rawSpeed == null || rawSpeed < 0 || isNaN(rawSpeed)) {
              speedRef.current = 0;
              setSpeedKmh(0);
            } else {
              const kmh = rawSpeed * 3.6;
              const normalizedKmh = kmh < SPEED_HARD_ZERO_KMH ? 0 : Math.round(kmh);
              speedRef.current = normalizedKmh;
              setSpeedKmh(normalizedKmh);
            }
          },
        );

        // 3. Accelerometer Setup & Delta G Gravity Isolation
        const isSensorAvailable = await Accelerometer.isAvailableAsync();
        if (!isSensorAvailable || !isMounted) {
          setSensorAvailable(false);
          return;
        }

        setSensorAvailable(true);
        Accelerometer.setUpdateInterval(25); // 40 Hz sampling rate

        // Strict threshold between 1.6g and 2.0g
        const effectiveThreshold = Math.max(1.6, Math.min(2.0, threshold || DEFAULT_THRESHOLD_G));

        sensorSubscription = Accelerometer.addListener(({ x: ax, y: ay, z: az }) => {
          if (!isMounted) return;
          const now = Date.now();

          // Initialize gravity vector on first measurement
          if (!initializedGravity.current) {
            lowPassX.current = ax;
            lowPassY.current = ay;
            lowPassZ.current = az;
            initializedGravity.current = true;
            return;
          }

          // Low-pass filter to capture device gravity orientation
          const gravity = 0.98;
          lowPassX.current = gravity * lowPassX.current + (1 - gravity) * ax;
          lowPassY.current = gravity * lowPassY.current + (1 - gravity) * ay;
          lowPassZ.current = gravity * lowPassZ.current + (1 - gravity) * az;

          // High-pass filter to extract dynamic impact force
          const dynamicX = ax - lowPassX.current;
          const dynamicY = ay - lowPassY.current;
          const dynamicZ = az - lowPassZ.current;

          // Dynamic Delta G Magnitude (removes static gravity)
          const deltaG = Math.sqrt(dynamicX * dynamicX + dynamicY * dynamicY + dynamicZ * dynamicZ);

          // Display deltaG rounded to 2 decimal places. When stationary, reads near 0.00g.
          const roundedG = Number(deltaG.toFixed(2));
          setLiveG(roundedG);

          // SPEED LOCKOUT: Only allow pothole detection triggers IF current vehicle speed >= 12 km/h
          const currentSpeed = speedRef.current;
          if (currentSpeed < SPEED_LOCKOUT_KMH) {
            // Speed < 12 km/h: stationary/slow motion lockout, ignore all accelerometer spikes
            return;
          }

          // IMPACT THRESHOLD & DEBOUNCE:
          // Trigger a detected pothole only when dynamic deltaG exceeds strict threshold (1.6g - 2.0g)
          // Lock sensor detection for 2.0 seconds cooldown to prevent double-counting suspension recoil
          const isSpike = deltaG >= effectiveThreshold;
          const cooldownElapsed = now - lastSpikeAt.current >= DEBOUNCE_COOLDOWN_MS;

          if (isSpike && cooldownElapsed) {
            lastSpikeAt.current = now;

            // Increment live Drive Mode dashboard UI Pothole Count by +1 only on true threshold impact
            setDrivePotholeCount((prev) => prev + 1);

            // Classify impact severity based on dynamic deltaG
            const impactSeverity: 'Low' | 'Medium' | 'High' =
              deltaG >= 2.5 ? 'High' : deltaG >= 2.0 ? 'Medium' : 'Low';

            const event: PotholeImpactEvent = {
              magnitude: roundedG,
              severity: impactSeverity,
              speedKmh: currentSpeed,
              latitude: locationRef.current.lat,
              longitude: locationRef.current.lng,
              timestamp: now,
            };

            callbackRef.current?.(event);
          }
        });
      } catch (err) {
        console.warn('Could not start drive radar:', err);
        setSensorAvailable(false);
      }
    };

    startDriveRadar();

    return () => {
      isMounted = false;
      sensorSubscription?.remove();
      locationSubscription?.remove();
      Accelerometer.removeAllListeners();
    };
  }, [enabled, threshold]);

  const isStationary = speedKmh < SPEED_LOCKOUT_KMH;
  const statusIndicator = !enabled
    ? 'STANDBY'
    : isStationary
      ? 'STATIONARY (Detection Paused)'
      : 'MONITORING ROAD...';

  return {
    speedKmh,
    sensorAvailable,
    liveG,
    drivePotholeCount,
    isStationary,
    statusIndicator,
    isMonitoring: enabled && !isStationary,
  };
}
