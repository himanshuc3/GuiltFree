import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Order, StatusResponse } from '@guiltfree/shared';
import { OrderCard } from '../components/OrderCard';
import { PeriodCard } from '../components/PeriodCard';
import { formatDay } from '../format';

interface Props {
  data: StatusResponse | null;
  orders: Order[];
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export function HomeScreen({ data, orders, error, refreshing, onRefresh }: Props) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {error && (
        <View style={[styles.banner, styles.errorBanner]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {data?.status.limitReached && (
        <View style={[styles.banner, styles.limitBanner]}>
          <Text style={styles.limitTitle}>Time to skip the delivery app</Text>
          {data.status.reasons.map((r) => (
            <Text key={r} style={styles.limitText}>
              {r}
            </Text>
          ))}
          {data.status.resetsAt && <Text style={styles.limitText}>Resets {formatDay(data.status.resetsAt)}.</Text>}
        </View>
      )}

      {data && (
        <>
          <PeriodCard title="This week" period={data.status.week} />
          <PeriodCard title="This month" period={data.status.month} />
        </>
      )}

      <Text style={styles.section}>Recent orders</Text>
      {orders.length === 0 && !error && (
        <Text style={styles.empty}>
          No orders yet. Orders appear here after Swiggy sends the “delivered” email. Pull down to sync.
        </Text>
      )}
      {orders.map((o) => (
        <OrderCard key={o.orderId} order={o} />
      ))}

      {data?.sync.lastError && <Text style={styles.syncError}>Last sync failed: {data.sync.lastError}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  banner: { borderRadius: 12, padding: 14, marginBottom: 12 },
  errorBanner: { backgroundColor: '#ffebe9' },
  errorText: { color: '#a40e26', fontSize: 14 },
  limitBanner: { backgroundColor: '#fff1e5' },
  limitTitle: { fontSize: 16, fontWeight: '700', color: '#953800', marginBottom: 4 },
  limitText: { fontSize: 14, color: '#953800' },
  section: { fontSize: 16, fontWeight: '700', color: '#1f2328', marginTop: 8, marginBottom: 8 },
  empty: { color: '#57606a', fontSize: 14 },
  syncError: { marginTop: 12, color: '#a40e26', fontSize: 12 },
});
