import { StyleSheet, Text, View } from 'react-native';
import type { Order } from '@guiltfree/shared';
import { formatWhen, inr } from '../format';

export function OrderCard({ order }: { order: Order }) {
  const placeholder = order.items.some((i) => i.kcalSource === 'mock');
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.restaurant} numberOfLines={1}>
          {order.restaurant}
        </Text>
        <Text style={styles.total}>{inr(order.total)}</Text>
      </View>
      <Text style={styles.items} numberOfLines={2}>
        {order.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
      </Text>
      <View style={styles.row}>
        <Text style={styles.meta}>{formatWhen(order.deliveredAt)}</Text>
        <Text style={styles.meta}>
          {order.kcalTotal === undefined
            ? 'calories pending'
            : `~${Math.round(order.kcalTotal)} kcal${placeholder ? ' (placeholder)' : ' (est.)'}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  restaurant: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1f2328', marginRight: 8 },
  total: { fontSize: 15, fontWeight: '600', color: '#1f2328' },
  items: { fontSize: 13, color: '#57606a', marginVertical: 4 },
  meta: { fontSize: 12, color: '#8c959f' },
});
