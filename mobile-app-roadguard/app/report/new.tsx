import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { AppButton, AppText, Field, Panel, Pill, SeverityBadge, SmallIconButton } from '@/components/AppUI';
import { assessPhoto, blurSensitivePhoto, combineSeverity } from '@/lib/severity';
import { useApp } from '@/providers/AppProvider';
import { useColors } from '@/hooks/useColors';
import type { PhotoAssessment, PotholeReport, Severity } from '@/types';

const severityOptions: Severity[] = ['Low', 'Medium', 'High', 'Critical'];
type Coordinates = { lat: number; lng: number };

export default function NewReportScreen() {
  const colors = useColors();
  const { source: sourceParam, spikeMagnitude: spikeParam } =
    useLocalSearchParams<{ source?: string; spikeMagnitude?: string }>();
  const source = sourceParam === 'sensor' ? 'sensor' : 'camera';
  const spikeMagnitude = Number.isFinite(Number(spikeParam)) ? Number(spikeParam) : null;
  const { userName, settings, addReport } = useApp();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [privacyState, setPrivacyState] = useState<'idle' | 'processing' | 'ready' | 'unavailable'>('idle');
  const [privacyReviewed, setPrivacyReviewed] = useState(false);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [note, setNote] = useState('');
  const [assessment, setAssessment] = useState<PhotoAssessment | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | null>(null);
  const [assessmentState, setAssessmentState] = useState<'idle' | 'loading' | 'ready' | 'unavailable' | 'error'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!photoUri) {
      setAssessment(null);
      setAssessmentState('idle');
      return;
    }
    if (privacyState === 'processing') return;
    let active = true;
    setAssessmentState('loading');
    assessPhoto(photoUri)
      .then((result) => {
        if (!active) return;
        setAssessment(result);
        setAssessmentState(result ? 'ready' : 'unavailable');
        if (result) setSelectedSeverity(result.severity);
      })
      .catch(() => {
        if (!active) return;
        setAssessmentState('error');
        setAssessment(null);
      });
    return () => {
      active = false;
    };
  }, [photoUri, privacyState]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    Location.getForegroundPermissionsAsync()
      .then(async (permission) => {
        if (!permission.granted) return;
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (active) setCoordinates({ lat: current.coords.latitude, lng: current.coords.longitude });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const preparePhoto = async (uri: string) => {
    setError('');
    setPrivacyReviewed(false);
    setAssessment(null);
    setAssessmentState('idle');
    setPrivacyState('processing');
    setPhotoUri(uri);
    try {
      const blurredUri = await blurSensitivePhoto(uri);
      if (blurredUri) {
        setPhotoUri(blurredUri);
        setPrivacyState('ready');
      } else {
        setPrivacyState('unavailable');
      }
    } catch {
      setPrivacyState('unavailable');
    }
  };

  const attachLocation = async () => {
    setLocationBusy(true);
    setError('');
    try {
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) {
          setError('Location is not available in this browser.');
          return;
        }
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
              resolve();
            },
            (cause) => reject(new Error(cause.message || 'Location permission was not granted.')),
            { enableHighAccuracy: true, timeout: 10000 },
          );
        });
        return;
      }
      const existing = await Location.getForegroundPermissionsAsync();
      let granted = existing.granted;
      if (!granted) {
        const access = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Attach your location',
            'Your coordinates place this report on the community map. We only save them when you submit this report.',
            [
              { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Allow location', onPress: async () => resolve((await Location.requestForegroundPermissionsAsync()).granted) },
            ],
          );
        });
        granted = access;
      }
      if (!granted) {
        setError('Location access is needed to place a report on the map.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoordinates({ lat: current.coords.latitude, lng: current.coords.longitude });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read your location.');
    } finally {
      setLocationBusy(false);
    }
  };

  const enableCamera = async () => {
    if (Platform.OS === 'web') {
      setError('Use the PotHoleRadar app on your Android or iOS device to capture a photo.');
      return;
    }
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        setError(result.canAskAgain ? 'Camera permission was not granted.' : 'Enable camera access in your device settings.');
        return;
      }
    }
    setCameraOpen(true);
    setCameraReady(false);
  };

  const takePhoto = async () => {
    if (!cameraReady || !cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.78 });
      if (photo?.uri) {
        await preparePhoto(photo.uri);
        setCameraOpen(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not capture the photo.');
    }
  };

  const chooseFromGallery = async () => {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(permission.canAskAgain ? 'Photo library access was not granted.' : 'Enable photo access in your device settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.78,
    });
    if (!result.canceled && result.assets[0]?.uri) await preparePhoto(result.assets[0].uri);
  };

  const submit = async () => {
    Keyboard.dismiss();
    setError('');
    if (!coordinates) {
      setError('Attach your location before submitting this report.');
      return;
    }
    if (source === 'camera' && !photoUri) {
      setError('Add a photo to submit a camera report.');
      return;
    }
    if (photoUri && privacyState === 'processing') {
      setError('Wait for the privacy check to finish before submitting.');
      return;
    }
    if (photoUri && !privacyReviewed) {
      setError('Review the photo and confirm it is safe to share.');
      return;
    }
    if (!assessment && !selectedSeverity) {
      setError('Choose a severity. The AI assessment is not connected yet.');
      return;
    }
    setBusy(true);
    const photoResult = assessment ?? (selectedSeverity
      ? { severity: selectedSeverity, confidence: 35, reason: 'Severity selected by the reporter.' }
      : null);
    const finalResult = combineSeverity(photoResult, spikeMagnitude);
    const reportId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const report: PotholeReport = {
      id: reportId,
      userId: 'local_user',
      authorLabel: userName || 'Local reporter',
      lat: coordinates.lat,
      lng: coordinates.lng,
      severity: finalResult.severity,
      confidence: finalResult.confidence,
      reason: finalResult.reason,
      imageUrl: photoUri,
      image_uri: photoUri,
      localImageUri: photoUri,
      source,
      status: 'open',
      upvotes: 0,
      createdAt: Date.now(),
      note: note.trim().slice(0, 500),
      pendingSync: true,
      spikeMagnitude,
    };
    try {
      const result = await addReport(report);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.back();
      setTimeout(() => {
        Alert.alert(
          result.merged ? 'Report confirmed' : result.synced ? 'Report shared' : 'Saved on this device',
          result.merged
            ? 'A report was already pinned within 10 metres, so your confirmation was added to it.'
            : result.synced
              ? 'Your pothole report is now on the community map.'
              : guestMode
                ? 'Sign in and connect to sync this report with the community.'
                : 'It will sync to the community feed when your connection and Firebase setup are ready.',
        );
      }, 250);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this report.');
    } finally {
      setBusy(false);
    }
  };

  const finalSeverity = assessment
    ? combineSeverity(assessment, spikeMagnitude).severity
    : selectedSeverity
      ? combineSeverity({ severity: selectedSeverity, confidence: 35, reason: 'Reporter selected' }, spikeMagnitude).severity
      : null;

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      bottomOffset={86}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.top}>
        <SmallIconButton icon="close" accessibilityLabel="Close report" onPress={() => router.back()} />
        <View style={styles.topTitle}>
          <AppText size={11} tone="accent" weight="bold" style={styles.eyebrow}>NEW ROAD REPORT</AppText>
          <AppText size={22} weight="bold">Pin the pothole</AppText>
        </View>
      </View>

      {source === 'sensor' && spikeMagnitude != null ? (
        <Panel style={styles.sensorPanel}>
          <Ionicons name="speedometer-outline" size={20} color={colors.accent} />
          <View style={styles.sensorCopy}>
            <AppText size={13} weight="semibold">Drive Mode signal confirmed</AppText>
            <AppText size={12} tone="muted">{spikeMagnitude.toFixed(1)} g motion spike. Add a photo if it is safe to stop.</AppText>
          </View>
        </Panel>
      ) : null}

      {cameraOpen ? (
        <View style={[styles.cameraFrame, { borderColor: colors.border }]}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            onCameraReady={() => setCameraReady(true)}
          />
          <View style={styles.cameraTop}>
            <AppText size={12} weight="semibold">Frame the road damage</AppText>
            <Pressable accessibilityRole="button" onPress={() => setCameraOpen(false)} style={styles.cameraClose}>
              <Ionicons name="close" size={20} color={colors.foreground} />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Capture pothole photo"
            onPress={takePhoto}
            disabled={!cameraReady}
            style={[styles.captureOuter, !cameraReady && styles.captureDisabled]}
          >
            <View style={[styles.captureInner, { backgroundColor: colors.foreground }]} />
          </Pressable>
          {!cameraReady ? <ActivityIndicator color={colors.foreground} style={styles.cameraSpinner} /> : null}
        </View>
      ) : (
        <View style={[styles.photoFrame, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {photoUri ? (
            <>
              <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <View style={styles.photoOverlay}>
                <View style={styles.photoLabel}>
                  <Ionicons name="checkmark-circle" size={17} color={colors.success} />
                  <AppText size={12} weight="semibold">Photo ready</AppText>
                </View>
                <Pressable accessibilityRole="button" onPress={() => { setPhotoUri(null); setPrivacyState('idle'); setPrivacyReviewed(false); }} style={styles.cameraClose}>
                  <Ionicons name="close" size={20} color={colors.foreground} />
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.photoEmpty}>
              <View style={styles.photoIcon}><Ionicons name="camera-outline" size={27} color={colors.accent} /></View>
              <AppText size={15} weight="semibold">{source === 'sensor' ? 'Add a photo if safe' : 'Capture road damage'}</AppText>
              <AppText size={12} tone="muted" style={styles.photoHint}>Keep faces and license plates out of frame.</AppText>
              <View style={styles.photoActions}>
                <AppButton title="Open camera" icon="camera" onPress={enableCamera} style={styles.photoAction} />
                <AppButton title="Gallery" icon="images-outline" variant="secondary" onPress={chooseFromGallery} style={styles.photoAction} />
              </View>
            </View>
          )}
        </View>
      )}

      {photoUri ? (
        <View style={styles.photoActions}>
          <AppButton title="Retake" icon="camera-outline" variant="secondary" onPress={() => { setPhotoUri(null); setPrivacyState('idle'); setPrivacyReviewed(false); enableCamera(); }} style={styles.photoAction} />
          <AppButton title="Choose another" icon="images-outline" variant="secondary" onPress={chooseFromGallery} style={styles.photoAction} />
        </View>
      ) : null}

      <Panel style={styles.locationPanel}>
        <View style={styles.locationHead}>
          <View style={styles.locationIcon}><Ionicons name="navigate-outline" size={19} color={colors.accent} /></View>
          <View style={styles.sensorCopy}>
            <AppText size={14} weight="semibold">Report location</AppText>
            <AppText size={12} tone="muted">
              {coordinates ? `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}` : 'Needed to place this report on the map.'}
            </AppText>
          </View>
          {coordinates ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : null}
        </View>
        {!coordinates ? (
          <AppButton title={locationBusy ? 'Getting location…' : 'Attach current location'} icon="locate-outline" variant="secondary" loading={locationBusy} onPress={attachLocation} />
        ) : (
          <Pressable accessibilityRole="button" onPress={attachLocation} style={styles.changeLocation}>
            <AppText size={12} tone="accent" weight="semibold">Refresh location</AppText>
          </Pressable>
        )}
      </Panel>

      <Panel style={styles.assessmentPanel}>
        <View style={styles.assessmentHead}>
          <View style={styles.aiIcon}><Ionicons name="scan-outline" size={18} color={colors.accent} /></View>
          <View style={styles.sensorCopy}>
            <AppText size={14} weight="semibold">Severity assessment</AppText>
            <AppText size={11} tone="muted">
              {assessmentState === 'loading'
                ? 'Checking the photo…'
                : assessmentState === 'ready'
                  ? `AI estimate · ${assessment?.confidence}% confidence`
                  : assessmentState === 'error'
                    ? 'Photo analysis failed. Select the severity below.'
                    : 'Review the photo result or choose a severity.'}
            </AppText>
          </View>
          {assessmentState === 'loading' ? <ActivityIndicator size="small" color={colors.accent} /> : null}
          {finalSeverity ? <SeverityBadge severity={finalSeverity} /> : null}
        </View>
        {assessment?.reason ? <AppText size={12} tone="muted" style={styles.reason}>{assessment.reason}</AppText> : null}
        {!assessment ? (
          <View style={styles.severityChoices}>
            {severityOptions.map((item) => (
              <Pill key={item} title={item} selected={selectedSeverity === item} onPress={() => setSelectedSeverity(item)} />
            ))}
          </View>
        ) : null}
        {assessmentState === 'unavailable' ? (
          <AppText size={11} tone="muted" style={styles.reason}>Connect the optional FastAPI service for an AI photo estimate; reporter-selected severity still works.</AppText>
        ) : null}
      </Panel>

      <Field
        label="Optional note"
        value={note}
        onChangeText={setNote}
        placeholder="Add a landmark or a short road condition note"
        multiline
        maxLength={500}
        textAlignVertical="top"
        style={styles.noteField}
      />
      {error ? <AppText size={12} tone="warning" style={styles.error}>{error}</AppText> : null}

      <Panel style={styles.privacyPanel}>
        {privacyState === 'processing' ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Ionicons
            name={privacyState === 'ready' ? 'shield-checkmark-outline' : 'eye-off-outline'}
            size={18}
            color={privacyState === 'ready' ? colors.success : colors.mutedForeground}
          />
        )}
        <View style={styles.privacyCopy}>
          <AppText size={11} weight="semibold">
            {privacyState === 'processing'
              ? 'Checking for faces and number plates…'
              : privacyState === 'ready'
                ? 'Automatic privacy blur applied'
                : 'Review your photo before upload'}
          </AppText>
          <AppText size={10} tone="muted" style={styles.privacyText}>
            {privacyState === 'ready'
              ? 'Detected faces and plates are blurred. Automated detection can miss details, so please check the image.'
              : 'If the blur service is not connected, keep faces and plates out of frame or retake the photo.'}
          </AppText>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: privacyReviewed }}
            onPress={() => setPrivacyReviewed((value) => !value)}
            style={styles.reviewRow}
          >
            <Ionicons name={privacyReviewed ? 'checkbox' : 'square-outline'} size={19} color={privacyReviewed ? colors.accent : colors.mutedForeground} />
            <AppText size={11} tone="muted" style={styles.reviewText}>I reviewed this image and it is safe to share.</AppText>
          </Pressable>
        </View>
      </Panel>
      <AppButton
        title={busy ? 'Saving report…' : 'Submit report'}
        icon="arrow-up-circle-outline"
        loading={busy}
        onPress={submit}
        testID="submit-report"
      />
      <AppText size={10} tone="muted" style={styles.safeNote}>
        Only take a photo or use your phone when safely stopped.
      </AppText>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 19, paddingTop: 14, paddingBottom: 44, gap: 14, maxWidth: 620, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 1 },
  topTitle: { gap: 3 },
  eyebrow: { letterSpacing: 1.5 },
  sensorPanel: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sensorCopy: { flex: 1, gap: 4 },
  cameraFrame: { height: 335, borderWidth: 1, borderRadius: 22, overflow: 'hidden', backgroundColor: '#151515' },
  cameraTop: { position: 'absolute', top: 12, left: 12, right: 12, padding: 10, borderRadius: 14, backgroundColor: 'rgba(10,10,10,0.72)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cameraClose: { width: 34, height: 34, backgroundColor: 'rgba(10,10,10,0.72)', borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  captureOuter: { position: 'absolute', bottom: 19, alignSelf: 'center', width: 66, height: 66, borderRadius: 33, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  captureInner: { width: 50, height: 50, borderRadius: 25 },
  captureDisabled: { opacity: 0.5 },
  cameraSpinner: { position: 'absolute', top: '50%', alignSelf: 'center' },
  photoFrame: { minHeight: 242, borderWidth: 1, borderRadius: 22, overflow: 'hidden', justifyContent: 'center' },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', padding: 19, gap: 9 },
  photoIcon: { width: 52, height: 52, backgroundColor: '#2A1A13', borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  photoHint: { textAlign: 'center', lineHeight: 17 },
  photoActions: { flexDirection: 'row', gap: 8, width: '100%' },
  photoAction: { flex: 1 },
  photoOverlay: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  photoLabel: { backgroundColor: 'rgba(10,10,10,0.8)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationPanel: { gap: 12 },
  locationHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  locationIcon: { width: 38, height: 38, backgroundColor: '#2A1A13', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  changeLocation: { paddingVertical: 3 },
  assessmentPanel: { gap: 12 },
  assessmentHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#2A1A13', alignItems: 'center', justifyContent: 'center' },
  reason: { lineHeight: 18 },
  severityChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  noteField: { minHeight: 92, paddingTop: 13, textAlignVertical: 'top' },
  error: { lineHeight: 18 },
  privacyPanel: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12 },
  privacyText: { flex: 1, lineHeight: 17 },
  privacyCopy: { flex: 1, gap: 6 },
  reviewRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  reviewText: { flex: 1 },
  safeNote: { textAlign: 'center', marginTop: -6 },
});
