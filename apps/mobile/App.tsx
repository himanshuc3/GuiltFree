import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Order, StatusResponse } from '@guiltfree/shared';
import { api } from './src/api';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

type Tab = 'home' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [data, setData] = useState<StatusResponse | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [status, list] = await Promise.all([api.status(), api.orders()]);
      setData(status);
      setOrders(list);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Pull-to-refresh asks the server to check Gmail first, then reloads the ledger.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await api.sync();
    } catch (e) {
      setError((e as Error).message);
    }
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.brand}>GuiltFree</Text>
          <View style={styles.tabs}>
            {(['home', 'settings'] as const).map((t) => (
              <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'home' ? 'Budget' : 'Settings'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {tab === 'home' ? (
          <HomeScreen data={data} orders={orders} error={error} refreshing={refreshing} onRefresh={refresh} />
        ) : (
          <SettingsScreen data={data} onSaved={load} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f8fa' },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  brand: { fontSize: 24, fontWeight: '800', color: '#1f2328', marginBottom: 12 },
  tabs: { flexDirection: 'row', backgroundColor: '#eaeef2', borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, color: '#57606a', fontWeight: '600' },
  tabTextActive: { color: '#1f2328' },
});
