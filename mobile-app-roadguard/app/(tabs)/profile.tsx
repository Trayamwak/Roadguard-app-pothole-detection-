import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppButton, AppScreen, AppText, Panel, PageTitle, StatTile } from '@/components/AppUI';
import { useApp } from '@/providers/AppProvider';
import { useColors } from '@/hooks/useColors';

export default function ProfileScreen() {
  const colors = useColors();
  const { userName, setUserName, reports } = useApp();
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(userName || '');

  const mine = reports;
  const points = mine.length * 25;

  const badges = useMemo(() => {
    const result: string[] = [];
    if (mine.length > 0) result.push('First scan logged');
    if (mine.length >= 3) result.push('Road scout');
    if (mine.length >= 10) result.push('Pothole hunter');
    if (mine.length >= 25) result.push('Road guardian');
    return result;
  }, [mine.length]);

  const displayName = userName || 'Rider';
  const initials = displayName.slice(0, 1).toUpperCase();

  const handleSaveName = async () => {
    if (tempName.trim()) {
      await setUserName(tempName.trim());
      setIsEditingName(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
  };

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <PageTitle
        eyebrow="Your impact"
        title="Local Profile"
        subtitle="All scanned potholes and badges are saved locally on this device."
      />

      {/* User Identity Card */}
      <Panel style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: '#321512', borderColor: '#66302A' }]}>
          <AppText size={27} tone="accent" weight="bold">{initials}</AppText>
        </View>
        <View style={styles.identityCopy}>
          <AppText size={18} weight="bold">{displayName}</AppText>
          <View style={styles.localBadge}>
            <Ionicons name="hardware-chip-outline" size={12} color={colors.success} />
            <AppText size={11} tone="muted">Local Device Profile</AppText>
          </View>
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
          <Ionicons name="pencil" size={17} color={colors.accent} />
        </Pressable>
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
              <AppText size={16} weight="bold">Change Your Name</AppText>
              <Pressable onPress={() => setIsEditingName(false)}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <AppText size={12} tone="muted">
              Choose how you want Roadguard to greet you.
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

      {/* Stats */}
      <View style={styles.statRow}>
        <StatTile label="Total scans" value={mine.length} icon="scan-outline" accent />
        <StatTile label="Radar points" value={points} icon="trophy-outline" />
      </View>

      {/* Badges Section */}
      <Panel style={styles.section}>
        <AppText size={14} weight="semibold">Earned Achievements</AppText>
        <View style={styles.badgeRow}>
          {badges.length ? (
            badges.map((badge) => (
              <View key={badge} style={[styles.badge, { borderColor: colors.border }]}>
                <Ionicons name="ribbon-outline" size={15} color={colors.accent} />
                <AppText size={11} weight="semibold">{badge}</AppText>
              </View>
            ))
          ) : (
            <AppText size={11} tone="muted">Complete your first pothole scan to unlock scout achievements.</AppText>
          )}
        </View>
      </Panel>

      {/* Quick Navigation Cards */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/scan-history')}
        style={styles.navRow}
      >
        <Panel style={styles.navPanel}>
          <View style={styles.navIcon}>
            <Ionicons name="time-outline" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText size={14} weight="semibold">View Saved Scans</AppText>
            <AppText size={11} tone="muted">{mine.length} pothole reports on this device</AppText>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
        </Panel>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/settings')}
        style={styles.navRow}
      >
        <Panel style={styles.navPanel}>
          <View style={styles.navIcon}>
            <Ionicons name="settings-outline" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText size={14} weight="semibold">Settings & Preferences</AppText>
            <AppText size={11} tone="muted">Drive sensitivity, units & reset</AppText>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
        </Panel>
      </Pressable>

      <AppButton
        title="Start AI Pothole Scan"
        icon="scan-outline"
        onPress={() => router.push('/ai-scan')}
        style={{ marginTop: 6 }}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 14, paddingBottom: 35, gap: 15 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  identityCopy: { flex: 1, gap: 4 },
  localBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  editBtn: { padding: 8, borderRadius: 10, backgroundColor: '#2C1D18' },
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
  statRow: { flexDirection: 'row', gap: 10 },
  section: { gap: 10, padding: 14 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  navRow: { borderRadius: 18 },
  navPanel: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  navIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#2C1D18', alignItems: 'center', justifyContent: 'center' },
});
