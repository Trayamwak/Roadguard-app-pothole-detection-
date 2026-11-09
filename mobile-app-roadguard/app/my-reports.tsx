import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton, AppScreen, EmptyState, PageTitle, ReportRow, SmallIconButton } from '@/components/AppUI';
import { useApp } from '@/providers/AppProvider';

export default function MyReportsScreen() {
  const { reports } = useApp();

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <View style={styles.top}>
        <SmallIconButton icon="close" accessibilityLabel="Close my reports" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <PageTitle
            eyebrow="On-Device Storage"
            title="My reports"
            subtitle={`${reports.length} ${reports.length === 1 ? 'report' : 'reports'} stored on this device`}
          />
        </View>
      </View>

      {reports.length ? (
        <View style={styles.list}>
          {reports.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              onPress={() => router.push({ pathname: '/report/[id]', params: { id: report.id } })}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="pin-outline"
          title="No reports yet"
          description="When you scan or report a road issue, it will be stored safely on this device."
          action={
            <AppButton
              title="Create first report"
              icon="camera-outline"
              onPress={() => router.push({ pathname: '/report/new', params: { source: 'camera' } })}
            />
          }
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 13, gap: 18 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  list: { gap: 9 },
});
