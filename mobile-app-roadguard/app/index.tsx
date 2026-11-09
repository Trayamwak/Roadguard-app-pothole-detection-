import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppButton, AppScreen, AppText, Panel } from '@/components/AppUI';
import { useApp } from '@/providers/AppProvider';
import { useColors } from '@/hooks/useColors';
import { getUserName } from '@/lib/storage';

function RadarRing({ delay = 0 }: { delay?: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2600 }), -1, false),
    );
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.34 * (1 - progress.value),
    transform: [{ scale: 0.48 + progress.value * 1.15 }],
  }));

  const colors = useColors();
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.radarRing, { borderColor: colors.primary }, animatedStyle]}
    />
  );
}

export default function OnboardingScreen() {
  const colors = useColors();
  const { userName, setUserName } = useApp();
  const [checkingStorage, setCheckingStorage] = useState(true);
  const [inputName, setInputName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getUserName().then((storedName) => {
      if (!active) return;
      if (storedName && storedName.trim().length > 0) {
        router.replace('/(tabs)');
      } else {
        setCheckingStorage(false);
      }
    }).catch(() => {
      if (active) setCheckingStorage(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async () => {
    const trimmed = inputName.trim();
    if (!trimmed) {
      setError('Please enter your name to continue.');
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    await setUserName(trimmed);
    router.replace('/(tabs)');
  };

  if (checkingStorage) {
    return (
      <AppScreen contentStyle={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <AppText size={13} tone="muted" style={{ marginTop: 12 }}>
          Loading Roadguard...
        </AppText>
      </AppScreen>
    );
  }

  return (
    <AppScreen contentStyle={styles.content}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <View style={styles.topRow}>
          <View style={[styles.brandMark, { backgroundColor: '#291311', borderColor: '#4B211C' }]}>
            <Ionicons name="radio-outline" size={21} color={colors.accent} />
          </View>
          <AppText size={14} weight="bold" style={styles.brandText}>ROADGUARD</AppText>
          <View style={styles.topSpacer} />
          <View style={[styles.livePill, { borderColor: colors.border }]}>
            <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
            <AppText size={10} tone="muted" weight="bold">LOCAL MODE</AppText>
          </View>
        </View>

        <View style={styles.radarHero}>
          <RadarRing delay={0} />
          <RadarRing delay={600} />
          <RadarRing delay={1200} />
          <View style={[styles.radarDisc, { backgroundColor: '#261311', borderColor: colors.primary }]}>
            <Ionicons name="shield-checkmark" size={44} color={colors.primary} />
          </View>
        </View>

        <View style={styles.copyBlock}>
          <AppText size={26} weight="bold" style={styles.headline}>
            What's your name?
          </AppText>
          <AppText size={13} tone="muted" style={styles.subtitle}>
            Enter your name to personalize your Roadguard road safety experience. All your scans and reports stay stored locally on this device.
          </AppText>
        </View>

        <Panel style={styles.formPanel}>
          <AppText size={12} weight="semibold" tone="muted">
            YOUR NAME
          </AppText>
          <View style={[styles.inputWrapper, { borderColor: error ? colors.primary : colors.border }]}>
            <Ionicons name="person-outline" size={19} color={colors.accent} style={styles.inputIcon} />
            <TextInput
              value={inputName}
              onChangeText={(val) => {
                setInputName(val);
                if (error) setError('');
              }}
              placeholder="e.g. Alex"
              placeholderTextColor="#78716C"
              style={[styles.input, { color: colors.foreground }]}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>
          {error ? (
            <AppText size={11} tone="warning" style={{ marginTop: 2 }}>
              {error}
            </AppText>
          ) : null}

          <View style={styles.privacyBadge}>
            <Ionicons name="lock-closed" size={13} color={colors.success} />
            <AppText size={11} tone="muted">
              100% On-Device · No account or cloud sync needed
            </AppText>
          </View>

          <AppButton
            title="Continue"
            icon="arrow-forward"
            onPress={handleSubmit}
            disabled={!inputName.trim()}
            style={{ marginTop: 6 }}
          />
        </Panel>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 18,
    paddingBottom: 28,
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    letterSpacing: 2.2,
  },
  topSpacer: {
    flex: 1,
  },
  livePill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  radarHero: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  radarRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
  },
  radarDisc: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBlock: {
    gap: 8,
  },
  headline: {
    lineHeight: 32,
  },
  subtitle: {
    lineHeight: 19,
  },
  formPanel: {
    gap: 12,
    padding: 18,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#1E1615',
    minHeight: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
});
