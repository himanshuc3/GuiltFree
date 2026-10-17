import { StyleSheet, Text, View } from 'react-native';
import type { MetricStatus, PeriodStatus } from '@guiltfree/shared';
import { LEVEL_COLOR, METRIC_LABEL, formatMetric } from '../format';

function Meter({ m }: { m: MetricStatus }) {
  const color = LEVEL_COLOR[m.level];
  return (
    <View style={styles.meter}>
      <View style={styles.meterHead}>
        <Text style={styles.metricName}>{METRIC_LABEL[m.metric]}</Text>
        <Text style={[styles.metricValue, { color }]}>
          {formatMetric(m.metric, m.used)}
          {m.limit !== null ? ` / ${formatMetric(m.metric, m.limit)}` : ''}
        </Text>
      </View>
      {m.limit !== null ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(100, (m.pct ?? 0) * 100)}%`, backgroundColor: color }]} />
        </View>
      ) : (
        <Text style={styles.noLimit}>No limit set</Text>
      )}
    </View>
  );
}

export function PeriodCard({ title, period }: { title: string; period: PeriodStatus }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {period.metrics.map((m) => (
        <Meter key={m.metric} m={m} />
      ))}
      {period.unestimatedOrders > 0 && (
        <Text style={styles.note}>
          {period.unestimatedOrders} order{period.unestimatedOrders > 1 ? 's have' : ' has'} no calorie estimate yet, so
          calories are understated.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#1f2328' },
  meter: { marginBottom: 12 },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  metricName: { fontSize: 14, color: '#57606a' },
  metricValue: { fontSize: 14, fontWeight: '600' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#eaeef2', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  noLimit: { fontSize: 12, color: '#9aa0a6' },
  note: { fontSize: 12, color: '#9a6700', marginTop: 4 },
});
