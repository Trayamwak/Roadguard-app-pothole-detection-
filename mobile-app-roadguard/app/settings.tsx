import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppButton, AppScreen, AppText, InfoLine, Panel, PageTitle, SmallIconButton } from '@/components/AppUI';
import { useApp } from '@/providers/AppProvider';
import { useColors } from '@/hooks/useColors';

export default function SettingsScreen() {
  const colors = useColors();
  const { userName, setUserName, reports, settings, updateSettings } = useApp();
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(userName || '');

  const set = (key: keyof typeof settings, value: boolean | number) => {
    updateSettings({ ...settings, [key]: value });
  };

  const handleSaveName = async () => {
    if (tempName.trim()) {
      await setUserName(tempName.trim());
      setIsEditingName(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Reset Profile & Data',
      'This will clear your saved username and reports from this device. You will be taken back to the name onboarding screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            await setUserName('');
            router.replace('/');
          },
        },
      ],
    );
  };

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <View style={styles.top}>
        <SmallIconButton icon="close" accessibilityLabel="Close settings" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <PageTitle eyebrow="Personalize" title="Settings" subtitle="Control Roadguard preferences on this device." />
        </View>
      </View>

      {/* User Display Name Section */}
      <Panel style={styles.profileCard}>
        <View style={styles.profileTop}>
          <View style={[styles.avatar, { backgroundColor: '#321512', borderColor: '#66302A' }]}>
            <AppText size={20} tone="accent" weight="bold">
              {(userName || 'R').slice(0, 1).toUpperCase()}
            </AppText>
          </View>
          <View style={styles.profileCopy}>
            <AppText size={11} tone="muted" weight="bold">DISPLAY NAME</AppText>
            <AppText size={17} weight="bold">{userName || 'Rider'}</AppText>
            <AppText size={11} tone="muted">Stored locally in AsyncStorage</AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit display name"
            onPress={() => {
              setTempName(userName || '');
              setIsEditingName(true);
            }}
            style={styles.editBtn}
          >
            <Ionicons name="pencil" size={16} color={colors.accent} />
            <AppText size={11} tone="accent" weight="semibold">Edit</AppText>
          </Pressable>
        </View>
      </Panel>

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
              <AppText size={16} weight="bold">Change Display Name</AppText>
              <Pressable onPress={() => setIsEditingName(false)}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <AppText size={12} tone="muted">
              Roadguard uses your name on the home greeting ("Hi [name]") and report author tags.
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

      {/* Drive Mode Sensitivity */}
      <Panel style={styles.panel}>
        <AppText size={14} weight="semibold">Drive Mode sensitivity</AppText>
        <AppText size={12} tone="muted">Higher values ignore smaller bumps. Default: 1.6 g.</AppText>
        <View style={styles.sensitivityRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease sensitivity"
            onPress={() => set('sensitivity', Math.max(0.8, Math.round((settings.sensitivity - 0.2) * 10) / 10))}
            style={[styles.adjust, { borderColor: colors.border }]}
          >
            <Ionicons name="remove" size={20} color={colors.foreground} />
          </Pressable>
          <View style={styles.sensitivityValue}>
            <AppText size={23} weight="bold">{settings.sensitivity.toFixed(1)} g</AppText>
            <AppText size={10} tone="muted">TRIGGER LEVEL</AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase sensitivity"
            onPress={() => set('sensitivity', Math.min(3.2, Math.round((settings.sensitivity + 0.2) * 10) / 10))}
            style={[styles.adjust, { borderColor: colors.border }]}
          >
            <Ionicons name="add" size={20} color={colors.foreground} />
          </Pressable>
        </View>
      </Panel>

      {/* Preferences Panel */}
      <Panel style={styles.panel}>
        <AppText size={14} weight="semibold">Measurement & Scan Preferences</AppText>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <AppText size={13} weight="semibold">Distance units</AppText>
            <AppText size={11} tone="muted">{settings.useMiles ? 'Miles and mph' : 'Kilometers and km/h'}</AppText>
          </View>
          <Switch
            value={settings.useMiles}
            onValueChange={(val) => set('useMiles', val)}
            thumbColor={Platform.OS === 'android' ? colors.primary : undefined}
            trackColor={{ true: colors.primary, false: '#3A3A3C' }}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <AppText size={13} weight="semibold">Auto-save AI Scans</AppText>
            <AppText size={11} tone="muted">Automatically commit scanned potholes directly to device storage</AppText>
          </View>
          <Switch
            value={settings.autoSaveScans}
            onValueChange={(val) => set('autoSaveScans', val)}
            thumbColor={Platform.OS === 'android' ? colors.primary : undefined}
            trackColor={{ true: colors.primary, false: '#3A3A3C' }}
          />
        </View>
      </Panel>

      {/* Local Storage Info */}
      <Panel style={styles.panel}>
        <AppText size={14} weight="semibold">On-Device Storage Info</AppText>
        <InfoLine label="Storage engine" value="@react-native-async-storage" />
        <InfoLine label="Media storage" value="expo-file-system (local documents)" />
        <InfoLine label="Saved potholes" value={`${reports.length} report(s)`} />
        <InfoLine label="AI Endpoint" value="EXPO_PUBLIC_SEVERITY_API_URL/scan" />
        <View style={{ marginTop: 8 }}>
          <AppButton
            title="Reset Name & Clear Storage"
            variant="secondary"
            icon="trash-outline"
            onPress={handleClearData}
          />
        </View>
      </Panel>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 35, gap: 15 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileCard: { padding: 15 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  profileCopy: { flex: 1, gap: 2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#2C1D18' },
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
  panel: { gap: 13, padding: 16 },
  sensitivityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  adjust: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sensitivityValue: { alignItems: 'center', gap: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchCopy: { flex: 1, gap: 3 },
  divider: { height: StyleSheet.hairlineWidth },
});
