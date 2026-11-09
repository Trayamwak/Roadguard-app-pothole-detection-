import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import type { PotholeReport, Severity } from '@/types';

export function AppScreen({
  children,
  scroll = false,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: object;
}) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const webInsets =
    Platform.OS === 'web'
      ? { paddingTop: Math.max(67, insets.top), paddingBottom: Math.max(34, insets.bottom) }
      : null;
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.pageContent, contentStyle, webInsets]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.pageContent, contentStyle, webInsets]}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      {inner}
    </SafeAreaView>
  );
}

export function AppText({
  children,
  size = 15,
  tone = 'foreground',
  weight = 'regular',
  style,
  numberOfLines,
}: {
  children: ReactNode;
  size?: number;
  tone?: 'foreground' | 'muted' | 'primary' | 'accent' | 'success' | 'warning';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  style?: object;
  numberOfLines?: number;
}) {
  const colors = useColors();
  const toneColor = {
    foreground: colors.foreground,
    muted: colors.mutedForeground,
    primary: colors.primary,
    accent: colors.accent,
    success: colors.success,
    warning: colors.warning,
  }[tone];
  const fontFamily = {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  }[weight];
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color: toneColor, fontSize: size, fontFamily }, style]}
    >
      {children}
    </Text>
  );
}

export function AppButton({
  title,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  style,
  testID,
}: {
  title: string;
  onPress: PressableProps['onPress'];
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: object;
  testID?: string;
}) {
  const colors = useColors();
  const disabledState = disabled || loading;
  const press = async () => {
    if (disabledState) return;
    await Haptics.selectionAsync().catch(() => undefined);
    onPress?.({} as never);
  };
  const content = (
    <View style={styles.buttonContents}>
      {loading ? (
        <ActivityIndicator color={colors.primaryForeground} size="small" />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={variant === 'quiet' ? colors.foreground : colors.primaryForeground} />
      ) : null}
      <AppText
        size={15}
        weight="semibold"
        tone={variant === 'quiet' ? 'foreground' : 'foreground'}
      >
        {title}
      </AppText>
    </View>
  );
  if (variant === 'primary') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabledState }}
        disabled={disabledState}
        onPress={press}
        style={({ pressed }) => [style, pressed && styles.pressed, disabledState && styles.disabled]}
        testID={testID}
      >
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.button, styles.primaryButton]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }
  const background =
    variant === 'danger'
      ? colors.destructive
      : variant === 'secondary'
        ? colors.secondary
        : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabledState }}
      disabled={disabledState}
      onPress={press}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor: colors.border },
        variant !== 'quiet' && styles.outlinedButton,
        style,
        pressed && styles.pressed,
        disabledState && styles.disabled,
      ]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  const colors = useColors();
  return (
    <View style={styles.fieldWrap}>
      {label ? <AppText size={13} tone="muted" weight="medium">{label}</AppText> : null}
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        selectionColor={colors.accent}
        style={[
          styles.field,
          { color: colors.foreground, backgroundColor: colors.card, borderColor: error ? colors.destructive : colors.border },
        ]}
        {...props}
      />
      {error ? <AppText size={12} tone="primary">{error}</AppText> : null}
    </View>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: object }) {
  const colors = useColors();
  return (
    <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

export function PageTitle({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.pageTitleRow}>
      <View style={styles.flex}>
        {eyebrow ? <AppText size={11} tone="accent" weight="bold" style={styles.eyebrow}>{eyebrow.toUpperCase()}</AppText> : null}
        <AppText size={29} weight="bold" style={{ letterSpacing: -0.8 }}>{title}</AppText>
        {subtitle ? <AppText size={14} tone="muted" style={styles.subtitle}>{subtitle}</AppText> : null}
      </View>
      {right ? <View style={[styles.titleRight, { borderColor: colors.border }]}>{right}</View> : null}
    </View>
  );
}

export function SeverityBadge({ severity }: { severity: Severity | 'None' | string }) {
  const norm = severity
    ? (severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase())
    : 'None';
  const palette = {
    Low: { bg: '#052E16', fg: '#4ADE80', border: '#166534' },
    Medium: { bg: '#451A03', fg: '#FB923C', border: '#9A3412' },
    High: { bg: '#450A0A', fg: '#F87171', border: '#991B1B' },
    Critical: { bg: '#450A0A', fg: '#EF4444', border: '#7F1D1D' },
    None: { bg: '#1C1917', fg: '#A8A29E', border: '#44403C' },
  }[norm] || { bg: '#1C1917', fg: '#A8A29E', border: '#44403C' };

  return (
    <View style={[styles.severity, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <View style={[styles.severityDot, { backgroundColor: palette.fg }]} />
      <AppText size={11} weight="bold" style={{ color: palette.fg }}>{norm}</AppText>
    </View>
  );
}

export function ReportRow({
  report,
  onPress,
  onConfirm,
  showConfirm = false,
}: {
  report: PotholeReport;
  onPress: () => void;
  onConfirm?: () => void;
  showConfirm?: boolean;
}) {
  const colors = useColors();
  const date = new Date(report.createdAt);
  const when = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.reportRow, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
    >
      <View style={styles.reportPin}>
        <Ionicons
          name={
            report.source === 'sensor'
              ? 'car-sport-outline'
              : report.source.startsWith('ai_')
                ? 'scan-outline'
                : 'camera-outline'
          }
          size={19}
          color={colors.accent}
        />
      </View>
      <View style={styles.reportCopy}>
        <View style={styles.reportTitleRow}>
          <SeverityBadge severity={report.severity} />
          {report.status === 'fixed' ? <AppText size={11} tone="success" weight="semibold">Fixed</AppText> : null}
          {report.pendingSync ? <AppText size={11} tone="warning" weight="semibold">On device</AppText> : null}
        </View>
        <AppText size={13} weight="medium" numberOfLines={1} style={styles.reportNote}>
          {report.note || report.reason || 'Pothole reported'}
        </AppText>
        <AppText size={11} tone="muted">
          {when} · {report.upvotes} confirmations · {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
        </AppText>
      </View>
      {showConfirm && onConfirm ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirm this pothole"
          onPress={(event) => {
            event.stopPropagation();
            onConfirm();
          }}
          style={styles.confirmIcon}
        >
          <View style={styles.confirmContents}>
            <Ionicons name="checkmark-circle-outline" size={21} color={colors.accent} />
            <AppText size={9} tone="accent" weight="semibold">Confirm</AppText>
          </View>
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
        <Ionicons name={icon} size={23} color={colors.accent} />
      </View>
      <AppText size={17} weight="semibold">{title}</AppText>
      <AppText size={13} tone="muted" style={styles.emptyText}>{description}</AppText>
      {action}
    </View>
  );
}

export function StatTile({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
}) {
  const colors = useColors();
  return (
    <Panel style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: accent ? '#331715' : colors.secondary }]}>
        <Ionicons name={icon} size={18} color={accent ? colors.primary : colors.accent} />
      </View>
      <AppText size={23} weight="bold">{value}</AppText>
      <AppText size={11} tone="muted" weight="medium">{label}</AppText>
    </Panel>
  );
}

export function SmallIconButton({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.smallIcon, { borderColor: colors.border }, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={21} color={colors.foreground} />
    </Pressable>
  );
}

export function Pill({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? '#351512' : colors.card,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <AppText size={12} weight="semibold" tone={selected ? 'primary' : 'muted'}>{title}</AppText>
    </Pressable>
  );
}

export function InfoLine({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={[styles.infoLine, { borderBottomColor: colors.border }]}>
      <Ionicons name={icon} size={19} color={colors.accent} />
      <View style={styles.flex}>
        <AppText size={14} weight="medium">{title}</AppText>
        {subtitle ? <AppText size={12} tone="muted" style={styles.infoSubtitle}>{subtitle}</AppText> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pageContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, gap: 18 },
  flex: { flex: 1 },
  button: { minHeight: 52, borderRadius: 16, paddingHorizontal: 18, justifyContent: 'center' },
  primaryButton: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  outlinedButton: { borderWidth: 1 },
  buttonContents: { flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.5 },
  fieldWrap: { gap: 8 },
  field: { minHeight: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: 15, fontSize: 15, fontFamily: 'Inter_400Regular' },
  panel: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  pageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleRight: { minWidth: 42, minHeight: 42, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { letterSpacing: 1.8, marginBottom: 6 },
  subtitle: { marginTop: 6, lineHeight: 20 },
  severity: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 100, borderWidth: 1, alignSelf: 'flex-start' },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 12 },
  reportPin: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#291512', alignItems: 'center', justifyContent: 'center' },
  reportCopy: { flex: 1, gap: 5 },
  reportTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reportNote: { marginTop: 1 },
  confirmIcon: { minWidth: 38, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  confirmContents: { alignItems: 'center', gap: 1 },
  empty: { borderWidth: 1, borderRadius: 22, padding: 22, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyText: { lineHeight: 19, textAlign: 'center', maxWidth: 270 },
  stat: { flex: 1, minHeight: 115, justifyContent: 'center', padding: 14 },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  smallIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 14 },
  pill: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100 },
  infoLine: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  infoSubtitle: { marginTop: 4, lineHeight: 17 },
});
