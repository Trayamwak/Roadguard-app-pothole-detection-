import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton, AppScreen, AppText, EmptyState, Panel, PageTitle, ReportRow, SmallIconButton } from '@/components/AppUI';
import { reportsToCsv, updateReportStatus } from '@/lib/reports';
import { useApp } from '@/providers/AppProvider';
import { useColors } from '@/hooks/useColors';

export default function AdminScreen() {
  const colors = useColors();
  const { reports, reloadReports } = useApp();
  const [busy, setBusy] = useState(false);

  const openReports = useMemo(() => reports.filter((report) => report.status === 'open'), [reports]);

  const exportCsv = async () => {
    setBusy(true);
    try {
      const file = new File(Paths.cache, `roadguard-reports-${Date.now()}.csv`);
      file.write(reportsToCsv(reports));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export on-device reports' });
      } else {
        Alert.alert('Sharing unavailable', 'This device cannot share the CSV file.');
      }
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Could not create the CSV.');
    } finally {
      setBusy(false);
    }
  };

  const markFixed = async (id: string) => {
    try {
      await updateReportStatus(id, 'fixed');
      await reloadReports();
    } catch (error) {
      Alert.alert('Could not update report', error instanceof Error ? error.message : 'Try again later.');
    }
  };

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <View style={styles.top}>
        <SmallIconButton icon="close" accessibilityLabel="Close reports manager" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <PageTitle
            eyebrow="Local Management"
            title="Data & Export"
            subtitle="Review local reports and export to CSV."
          />
        </View>
      </View>

      <Panel style={styles.summary}>
        <View style={styles.summaryIcon}>
          <Ionicons name="document-text-outline" size={21} color={colors.accent} />
        </View>
        <View style={styles.summaryText}>
          <AppText size={22} weight="bold">{openReports.length}</AppText>
          <AppText size={11} tone="muted">open reports · {reports.length} total</AppText>
        </View>
        <AppButton
          title={busy ? 'Preparing…' : 'Export CSV'}
          icon="download-outline"
          loading={busy}
          onPress={exportCsv}
          style={styles.exportButton}
        />
      </Panel>

      {openReports.length ? (
        <View style={styles.list}>
          {openReports.map((report) => (
            <View key={report.id} style={styles.report}>
              <ReportRow
                report={report}
                onPress={() => router.push({ pathname: '/report/[id]', params: { id: report.id } })}
              />
              <AppButton
                title="Mark as fixed"
                icon="checkmark-done-outline"
                variant="secondary"
                onPress={() => markFixed(report.id)}
              />
            </View>
          ))}
        </View>
      ) : (
        <EmptyState
          icon="checkmark-done-outline"
          title="No open reports"
          description="All local reports are currently marked fixed."
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 13, paddingBottom: 36, gap: 17 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  summaryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A1A13' },
  summaryText: { flex: 1, gap: 3 },
  exportButton: { paddingHorizontal: 11 },
  list: { gap: 13 },
  report: { gap: 7 },
});
