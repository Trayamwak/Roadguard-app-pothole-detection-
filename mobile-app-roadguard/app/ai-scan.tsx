import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppButton, AppScreen, AppText, Field, Panel, PageTitle, Pill, SeverityBadge, SmallIconButton } from '@/components/AppUI';
import { DetectionOverlay, DetectionPreview } from '@/components/DetectionOverlay';
import { compressDetectionImage, detectPotholes } from '@/lib/ai-detection';
import { useApp } from '@/providers/AppProvider';
import { useColors } from '@/hooks/useColors';
import { saveImageLocally, saveScanRecord, updateScanRecord } from '@/lib/storage';
import type { PotholeBox, PotholeReport, ScanRecord, ScanResponse, Severity } from '@/types';

type ScanMode = 'live' | 'upload';
type Geo = { lat: number; lng: number; address: string };

export default function AiScanScreen() {
  const colors = useColors();
  const { userName, settings, addReport } = useApp();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const inFlight = useRef(false);
  const framesScanned = useRef(0);
  const [mode, setMode] = useState<ScanMode>('upload');
  const [scanSource, setScanSource] = useState<'ai_live' | 'ai_upload'>('ai_upload');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [locationError, setLocationError] = useState('');
  const [note, setNote] = useState('');
  const [scanRecordId, setScanRecordId] = useState<string | null>(null);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    Location.getForegroundPermissionsAsync()
      .then(async (permission) => {
        if (!permission.granted) return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!active) return;
        const places = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }).catch(() => []);
        if (!active) return;
        const place = places[0];
        const address = [place?.name, place?.street, place?.district || place?.city, place?.region]
          .filter((part, index, list) => !!part && list.indexOf(part) === index)
          .join(', ');
        setGeo({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: address || `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
        });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const clearResult = () => {
    setResult(null);
    setPhotoUri(null);
    setScanRecordId(null);
    setSavedReportId(null);
    setNote('');
    setScanError('');
    setShowResultModal(false);
  };

  const getLocation = async (askPermission: boolean): Promise<Geo | null> => {
    setLocationError('');
    try {
      if (Platform.OS === 'web') {
        if (!askPermission || !navigator.geolocation) return null;
        return await new Promise<Geo>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              address: `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
            }),
            (error) => reject(new Error(error.message || 'Location permission was not granted.')),
            { enableHighAccuracy: true, timeout: 10000 },
          );
        });
      }

      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && askPermission) permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return null;
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const places = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }).catch(() => []);
      const place = places[0];
      const address = [place?.name, place?.street, place?.district || place?.city, place?.region]
        .filter((part, index, list) => !!part && list.indexOf(part) === index)
        .join(', ');
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        address: address || `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
      };
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Could not read or reverse-geocode your location.');
      return null;
    }
  };

  const attachLocation = async () => {
    const next = await getLocation(true);
    if (!next) {
      setLocationError('Allow location access to save coordinates with this scan.');
      return;
    }
    setGeo(next);
  };

  /**
   * Automatically commits report and persistent image URI to local device storage.
   */
  const autoCommitToLocalStorage = async (
    source: 'ai_live' | 'ai_upload',
    compressedUri: string,
    scanResponse: ScanResponse,
    position: Geo | null,
  ) => {
    const recordId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Persist photo in local documentDirectory using expo-file-system
    const persistentUri = await saveImageLocally(compressedUri, recordId);
    setPhotoUri(persistentUri);

    const isRoad = scanResponse.is_road_surface !== false;
    const confidencePercent = Math.round(scanResponse.confidence * 100);

    // Save full JSON response to report record
    const report: PotholeReport = {
      id: recordId,
      userId: 'local_device_user',
      authorLabel: userName || 'Local Reporter',
      lat: position?.lat ?? 0,
      lng: position?.lng ?? 0,
      latitude: position?.lat ?? 0,
      longitude: position?.lng ?? 0,
      address: position?.address ?? (position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : null),
      severity: isRoad ? scanResponse.severity : 'None',
      confidence: confidencePercent,
      reason: scanResponse.description,
      description: scanResponse.description,
      is_road_surface: scanResponse.is_road_surface,
      has_pothole: scanResponse.has_pothole,
      pothole_count: scanResponse.pothole_count,
      potholes: scanResponse.potholes,
      imageUrl: persistentUri,
      image_uri: persistentUri,
      localImageUri: persistentUri,
      source,
      status: 'open',
      upvotes: 0,
      createdAt: Date.now(),
      date: new Date().toISOString(),
      note: note.trim().slice(0, 500),
    };

    const saved = await addReport(report);

    // Also persist in scan records
    const record: ScanRecord = {
      id: recordId,
      source,
      createdAt: Date.now(),
      date: new Date().toISOString(),
      photoUri: persistentUri,
      image_uri: persistentUri,
      is_road_surface: scanResponse.is_road_surface,
      has_pothole: scanResponse.has_pothole,
      pothole_count: scanResponse.pothole_count,
      severity: scanResponse.severity,
      overallSeverity: scanResponse.severity,
      confidence: confidencePercent,
      description: scanResponse.description,
      potholes: scanResponse.potholes,
      address: report.address ?? null,
      lat: report.lat,
      lng: report.lng,
      reportId: saved.reportId,
      status: 'saved',
      note: '',
    };

    await saveScanRecord(record);
    setScanRecordId(recordId);
    setSavedReportId(saved.reportId);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };

  const handleDetection = async (
    compressedUri: string,
    scanResponse: ScanResponse,
    source: 'ai_live' | 'ai_upload',
  ) => {
    setScanSource(source);
    setResult(scanResponse);
    setScanError('');
    setShowResultModal(true);

    const position = geo ?? await getLocation(false);

    // If it's a valid road surface, commit report and image to on-device storage
    if (scanResponse.is_road_surface) {
      await autoCommitToLocalStorage(source, compressedUri, scanResponse, position);
    }
  };

  const beginLiveScan = async () => {
    if (Platform.OS === 'web') {
      setScanError('Live camera scanning is available in the Android and iOS app. Use Upload Image in this preview.');
      return;
    }
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        setScanError(permission.canAskAgain ? 'Camera access was not granted. Allow it to use Live Camera.' : 'Enable camera access in your device settings.');
        return;
      }
    }
    clearResult();
    framesScanned.current = 0;
    setFrameCount(0);
    setCameraOpen(true);
    setIsScanning(true);
  };

  useEffect(() => {
    if (!isScanning || !cameraReady) return;
    const interval = setInterval(() => {
      if (inFlight.current || !cameraRef.current) return;
      inFlight.current = true;
      void (async () => {
        try {
          // Camera capture with 0.6 quality to drop upload size
          const captured = await cameraRef.current?.takePictureAsync({ quality: 0.6, exif: false });
          if (!captured?.uri) return;
          const compressedUri = await compressDetectionImage(captured.uri);
          const detection = await detectPotholes(compressedUri);
          framesScanned.current += 1;
          setFrameCount(framesScanned.current);

          if (detection.has_pothole || framesScanned.current >= 5) {
            setIsScanning(false);
            setCameraOpen(false);
            await handleDetection(compressedUri, detection, 'ai_live');
          }
        } catch {
          // Continue scanning next frame
        } finally {
          inFlight.current = false;
        }
      })();
    }, 1800);
    return () => clearInterval(interval);
  }, [cameraReady, isScanning]);

  const chooseImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setScanError('Allow photo library access to upload a road image.');
      return;
    }
    // Pre-compress via ImagePicker (quality: 0.6)
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.6,
    });
    if (picked.canceled || !picked.assets[0]?.uri) return;
    clearResult();
    setScanBusy(true);
    try {
      // Further resize to maxWidth 1024 and compress to ensure payload < 500KB
      const compressedUri = await compressDetectionImage(picked.assets[0].uri);
      setPhotoUri(compressedUri);
      const detection = await detectPotholes(compressedUri);
      await handleDetection(compressedUri, detection, 'ai_upload');
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Image scanning failed. Try another photo.');
      setResult(null);
    } finally {
      setScanBusy(false);
    }
  };

  const retry = () => {
    clearResult();
    if (mode === 'live') void beginLiveScan();
    else void chooseImage();
  };

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <SmallIconButton icon="chevron-back" accessibilityLabel="Go back" onPress={() => router.back()} />
        <View style={styles.headerTitle}>
          <PageTitle eyebrow="AI Road Inspection" title="Pothole scanner" subtitle="Live camera or upload road imagery." />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open scan history" onPress={() => router.push('/scan-history')} style={styles.historyIcon}>
          <Ionicons name="time-outline" size={20} color={colors.accent} />
        </Pressable>
      </View>

      <View style={styles.modeRow}>
        <Pill title="Upload Image" selected={mode === 'upload'} onPress={() => { setIsScanning(false); setCameraOpen(false); setMode('upload'); setScanError(''); }} />
        <Pill title="Live Camera" selected={mode === 'live'} onPress={() => { setIsScanning(false); setCameraOpen(false); setMode('live'); setScanError(''); }} />
      </View>

      {geo ? (
        <Panel style={styles.locationCard}>
          <Ionicons name="location" size={17} color={colors.success} />
          <View style={styles.locationCopy}>
            <AppText size={11} weight="semibold" numberOfLines={1}>{geo.address}</AppText>
            <AppText size={10} tone="muted">GPS attached · saved locally with report</AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={attachLocation} style={styles.refreshLocation}>
            <Ionicons name="refresh-outline" size={17} color={colors.accent} />
          </Pressable>
        </Panel>
      ) : (
        <Panel style={styles.locationCard}>
          <Ionicons name="location-outline" size={18} color={colors.accent} />
          <View style={styles.locationCopy}>
            <AppText size={11} weight="semibold">Location coordinates</AppText>
            <AppText size={10} tone="muted">Attach GPS to include latitude/longitude in the report.</AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={attachLocation} style={styles.attachLocation}>
            <AppText size={10} tone="accent" weight="semibold">Attach GPS</AppText>
          </Pressable>
        </Panel>
      )}

      {locationError ? <AppText size={11} tone="warning">{locationError}</AppText> : null}

      {!result ? (
        mode === 'live' ? (
          <View style={styles.cameraFrame}>
            {cameraOpen ? (
              <>
                <CameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  onCameraReady={() => setCameraReady(true)}
                />
                <View style={styles.cameraStatus}>
                  <View style={[styles.liveDot, { backgroundColor: isScanning ? colors.success : colors.mutedForeground }]} />
                  <AppText size={10} weight="semibold">{isScanning ? `Analyzing road · frame ${frameCount + 1}/5` : 'Camera ready'}</AppText>
                </View>
                <Pressable accessibilityRole="button" onPress={() => { setIsScanning(false); setCameraOpen(false); setCameraReady(false); }} style={styles.stopButton}>
                  <Ionicons name="stop" size={16} color="#FFFFFF" />
                  <AppText size={11} weight="semibold" style={styles.whiteText}>Stop scan</AppText>
                </Pressable>
              </>
            ) : (
              <View style={styles.emptyCamera}>
                <View style={styles.cameraIcon}><Ionicons name="scan-outline" size={25} color={colors.accent} /></View>
                <AppText size={14} weight="semibold">Live camera scan</AppText>
                <AppText size={11} tone="muted" style={styles.centerText}>
                  Point the camera at road pavement to detect surface cracks and potholes.
                </AppText>
                <AppButton
                  title="Start live scan"
                  icon="camera-outline"
                  onPress={beginLiveScan}
                  style={styles.startScanButton}
                />
              </View>
            )}
          </View>
        ) : (
          <Panel style={styles.uploadPanel}>
            <View style={styles.cameraIcon}><Ionicons name="image-outline" size={25} color={colors.accent} /></View>
            <AppText size={14} weight="semibold">Choose road photo to inspect</AppText>
            <AppText size={11} tone="muted" style={styles.centerText}>
              Upload a clear photo of asphalt or concrete pavement to run multi-pothole AI verification and sizing.
            </AppText>
            <AppButton
              title={scanBusy ? 'Analyzing road with Gemini…' : 'Choose image'}
              icon={scanBusy ? undefined : 'images-outline'}
              loading={scanBusy}
              onPress={chooseImage}
              style={styles.startScanButton}
            />
          </Panel>
        )
      ) : (
        <Animated.View entering={FadeInDown.duration(260)} style={styles.resultGroup}>
          {photoUri ? (
            <DetectionPreview uri={photoUri} potholes={result.potholes} />
          ) : null}

          {/* CRITICAL VERIFICATION: If is_road_surface is false, display clear warning alert */}
          {!result.is_road_surface ? (
            <Panel style={[styles.nonRoadAlert, { borderColor: '#DC2626', backgroundColor: '#3A1412' }]}>
              <View style={styles.nonRoadIcon}>
                <Ionicons name="warning" size={24} color="#EF4444" />
              </View>
              <View style={styles.locationCopy}>
                <AppText size={14} weight="bold" style={{ color: '#F87171' }}>
                  No valid road surface detected in image
                </AppText>
                <AppText size={11} tone="muted" style={{ marginTop: 2, lineHeight: 16 }}>
                  {result.description || 'The image does not show asphalt, street, or concrete road pavement. Non-road textures are strictly ignored to prevent false detections.'}
                </AppText>
              </View>
            </Panel>
          ) : (
            <>
              {/* Auto-saved confirmation banner */}
              <Panel style={[styles.savedSuccessBanner, { borderColor: colors.success }]}>
                <Ionicons name="checkmark-circle" size={19} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <AppText size={13} weight="bold" tone="success">
                    Saved to local device storage
                  </AppText>
                  <AppText size={10} tone="muted">
                    Full JSON assessment and image URI saved to on-device storage.
                  </AppText>
                </View>
              </Panel>

              {/* Multi-Pothole Summary Card */}
              <Panel style={styles.resultCard}>
                <View style={styles.resultHead}>
                  <View style={styles.countBadgeWrapper}>
                    {/* Requirement 2: Pothole Count badge */}
                    <View style={[styles.countBadge, { backgroundColor: result.pothole_count > 0 ? '#431407' : '#1C1917', borderColor: result.pothole_count > 0 ? '#EA580C' : '#44403C' }]}>
                      <Ionicons name="disc" size={12} color={result.pothole_count > 0 ? '#F97316' : '#A8A29E'} />
                      <AppText size={11} weight="bold" style={{ color: result.pothole_count > 0 ? '#FB923C' : '#A8A29E' }}>
                        {result.pothole_count} Pothole{result.pothole_count === 1 ? '' : 's'} Detected
                      </AppText>
                    </View>
                  </View>

                  {/* Requirement 2: Overall Severity badge with dynamic styling */}
                  <SeverityBadge severity={result.severity} />
                </View>

                {/* Requirement 2: Detailed condition description */}
                <View style={styles.descriptionBox}>
                  <AppText size={11} weight="bold" tone="muted" style={{ letterSpacing: 0.5, marginBottom: 2 }}>
                    ROAD CONDITION ASSESSMENT
                  </AppText>
                  <AppText size={12} style={{ color: '#E7E5E4', lineHeight: 18 }}>
                    {result.description}
                  </AppText>
                </View>

                <View style={styles.metaRow}>
                  <AppText size={11} tone="muted">
                    Confidence: {Math.round(result.confidence * 100)}% · {new Date().toLocaleTimeString()}
                  </AppText>
                  <View style={styles.roadSurfaceTag}>
                    <Ionicons name="checkmark-done" size={13} color={colors.success} />
                    <AppText size={10} weight="bold" tone="success">Road Verified</AppText>
                  </View>
                </View>

                {/* Individual Pothole Breakdown */}
                {result.potholes && result.potholes.length > 0 ? (
                  <View style={styles.breakdownList}>
                    <AppText size={10} weight="bold" tone="muted" style={{ letterSpacing: 0.5 }}>
                      DETECTED HAZARD COORDINATES (2D BOUNDING BOXES)
                    </AppText>
                    {result.potholes.map((p, idx) => (
                      <View key={p.id ?? idx} style={styles.potholeItem}>
                        <View style={styles.potholeIdPill}>
                          <AppText size={10} weight="bold" tone="accent">#{p.id ?? idx + 1}</AppText>
                        </View>
                        <AppText size={11} weight="semibold">Size: {p.size}</AppText>
                        <AppText size={10} tone="muted" style={{ marginLeft: 'auto', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                          [{p.box_2d.join(', ')}]
                        </AppText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Panel>
            </>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {result.is_road_surface ? (
              <AppButton
                title="View in History"
                icon="time-outline"
                onPress={() => router.push('/scan-history')}
                style={{ flex: 1 }}
              />
            ) : null}
            <AppButton
              title="Scan Another Photo"
              icon="camera-outline"
              variant={result.is_road_surface ? 'secondary' : 'primary'}
              onPress={retry}
              style={{ flex: 1 }}
            />
          </View>
        </Animated.View>
      )}

      {scanError ? <AppText size={12} tone="warning" style={styles.errorText}>{scanError}</AppText> : null}

      {/* Result Modal: Pothole count, overall severity badge, confidence score, detailed assessment text */}
      <Modal
        visible={showResultModal && !!result}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResultModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="scan-outline" size={20} color={colors.accent} />
                <AppText size={16} weight="bold">Scan Assessment</AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close scan result modal"
                onPress={() => setShowResultModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              {!result?.is_road_surface ? (
                <Panel style={[styles.nonRoadAlert, { borderColor: '#DC2626', backgroundColor: '#3A1412' }]}>
                  <Ionicons name="warning" size={24} color="#EF4444" style={styles.nonRoadIcon} />
                  <View style={styles.locationCopy}>
                    <AppText size={14} weight="bold" style={{ color: '#F87171' }}>
                      No valid road surface detected in image
                    </AppText>
                    <AppText size={11} tone="muted" style={{ marginTop: 2, lineHeight: 16 }}>
                      {result?.description || 'The image does not show an outdoor asphalt or concrete road surface. Non-road environments are strictly rejected to avoid false detections.'}
                    </AppText>
                  </View>
                </Panel>
              ) : (
                <>
                  <View style={styles.resultBadgesRow}>
                    {/* 1. Pothole Count Badge */}
                    <View style={[styles.countBadge, { backgroundColor: (result?.pothole_count ?? 0) > 0 ? '#431407' : '#1C1917', borderColor: (result?.pothole_count ?? 0) > 0 ? '#EA580C' : '#44403C' }]}>
                      <Ionicons name="disc" size={13} color={(result?.pothole_count ?? 0) > 0 ? '#F97316' : '#A8A29E'} />
                      <AppText size={12} weight="bold" style={{ color: (result?.pothole_count ?? 0) > 0 ? '#FB923C' : '#A8A29E' }}>
                        {result?.pothole_count} Pothole{result?.pothole_count === 1 ? '' : 's'} Detected
                      </AppText>
                    </View>

                    {/* 2. Overall Severity Badge (Green/Orange/Red) */}
                    <SeverityBadge severity={result?.severity || 'None'} />

                    {/* 3. Confidence Score */}
                    <View style={[styles.confidenceBadge, { borderColor: colors.border }]}>
                      <Ionicons name="shield-checkmark-outline" size={13} color={colors.accent} />
                      <AppText size={11} weight="semibold" tone="accent">
                        {Math.round((result?.confidence ?? 0) * 100)}% Confidence
                      </AppText>
                    </View>
                  </View>

                  {/* 4. Detailed Assessment Text */}
                  <View style={styles.modalAssessmentBox}>
                    <AppText size={10} weight="bold" tone="muted" style={{ letterSpacing: 0.5, marginBottom: 4 }}>
                      DETAILED ROAD CONDITION ASSESSMENT
                    </AppText>
                    <AppText size={13} style={{ color: '#F5F5F4', lineHeight: 19 }}>
                      {result?.description}
                    </AppText>
                  </View>

                  {/* Auto-saved confirmation */}
                  <View style={styles.modalAutoSaveRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <AppText size={11} tone="muted">
                      Full JSON assessment and image saved to local device storage.
                    </AppText>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooterActions}>
              {result?.is_road_surface ? (
                <AppButton
                  title="View in History"
                  icon="time-outline"
                  onPress={() => {
                    setShowResultModal(false);
                    router.push('/scan-history');
                  }}
                  style={{ flex: 1 }}
                />
              ) : null}
              <AppButton
                title={result?.is_road_surface ? 'Done' : 'Scan Another Photo'}
                variant={result?.is_road_surface ? 'secondary' : 'primary'}
                onPress={() => {
                  setShowResultModal(false);
                  if (!result?.is_road_surface) retry();
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 35, gap: 15 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { flex: 1 },
  historyIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modeRow: { flexDirection: 'row', gap: 8 },
  locationCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  locationCopy: { flex: 1, gap: 2 },
  refreshLocation: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  attachLocation: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#4B211C' },
  cameraFrame: { height: 350, borderRadius: 20, overflow: 'hidden', backgroundColor: '#1E1615', position: 'relative' },
  cameraStatus: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5 },
  stopButton: { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC2626', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 100 },
  whiteText: { color: '#FFFFFF' },
  emptyCamera: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  cameraIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A1A13' },
  uploadPanel: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  centerText: { textAlign: 'center', maxWidth: 280, lineHeight: 16 },
  startScanButton: { minWidth: 200, marginTop: 6 },
  resultGroup: { gap: 14 },
  nonRoadAlert: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 15, borderRadius: 18, borderWidth: 1.5 },
  nonRoadIcon: { marginTop: 2 },
  savedSuccessBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, backgroundColor: '#052E16' },
  resultCard: { gap: 13, padding: 16 },
  resultHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countBadgeWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  descriptionBox: { padding: 11, backgroundColor: '#140D0C', borderRadius: 12, borderWidth: 1, borderColor: '#2E1D1A' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roadSurfaceTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: '#052E16' },
  breakdownList: { gap: 7, paddingTop: 4 },
  potholeItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#1A1110', borderRadius: 8, borderWidth: 1, borderColor: '#291816' },
  potholeIdPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#2D1612' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  errorText: { textAlign: 'center', marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 440, maxHeight: '88%', borderRadius: 24, borderWidth: 1, overflow: 'hidden', padding: 18, gap: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalScrollContent: { gap: 14, paddingBottom: 10 },
  resultBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  confidenceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1, backgroundColor: '#1C1514' },
  modalAssessmentBox: { padding: 12, backgroundColor: '#140D0C', borderRadius: 14, borderWidth: 1, borderColor: '#2E1D1A' },
  modalAutoSaveRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4 },
  modalFooterActions: { flexDirection: 'row', gap: 10, paddingTop: 4 },
});
