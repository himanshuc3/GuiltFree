import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Limits, StatusResponse } from '@guiltfree/shared';
import { api } from '../api';
import { API_URL } from '../config';

type Draft = Record<'orders' | 'spend' | 'kcal', string>;

const toDraft = (l: Limits): Draft => ({
  orders: l.orders?.toString() ?? '',
  spend: l.spend?.toString() ?? '',
  kcal: l.kcal?.toString() ?? '',
});

/** Empty means "no limit". Returns null for anything that is not a positive number. */
function toLimits(d: Draft): Limits | null {
  const out: Limits = {};
  for (const key of ['orders', 'spend', 'kcal'] as const) {
    const raw = d[key].trim();
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || (key === 'orders' && !Number.isInteger(n))) return null;
    out[key] = n;
  }
  return out;
}

function LimitFields({ title, draft, onChange }: { title: string; draft: Draft; onChange: (d: Draft) => void }) {
  const field = (key: keyof Draft, label: string) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="No limit"
        value={draft[key]}
        onChangeText={(v) => onChange({ ...draft, [key]: v })}
      />
    </View>
  );
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {field('orders', 'Max orders')}
      {field('spend', 'Max spend (₹)')}
      {field('kcal', 'Max calories (kcal)')}
    </View>
  );
}

export function SettingsScreen({ data, onSaved }: { data: StatusResponse | null; onSaved: () => void }) {
  const [weekly, setWeekly] = useState<Draft>(() => toDraft(data?.settings.limits.weekly ?? {}));
  const [monthly, setMonthly] = useState<Draft>(() => toDraft(data?.settings.limits.monthly ?? {}));
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const w = toLimits(weekly);
    const m = toLimits(monthly);
    if (!w || !m) return setMessage({ text: 'Limits must be positive numbers (orders must be whole).', ok: false });
    setSaving(true);
    try {
      await api.saveLimits({ weekly: w, monthly: m });
      setMessage({ text: 'Saved.', ok: true });
      onSaved();
    } catch (e) {
      setMessage({ text: (e as Error).message, ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <LimitFields title="Weekly limits" draft={weekly} onChange={setWeekly} />
      <LimitFields title="Monthly limits" draft={monthly} onChange={setMonthly} />

      <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={save} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save limits'}</Text>
      </Pressable>
      {message && <Text style={[styles.message, { color: message.ok ? '#1a7f37' : '#a40e26' }]}>{message.text}</Text>}

      <View style={styles.card}>
        <Text style={styles.title}>Connections</Text>
        <Text style={styles.row}>Server: {API_URL}</Text>
        <Text style={styles.row}>
          Gmail:{' '}
          {data
            ? data.gmail.mode === 'mock'
              ? 'demo mode (sample emails)'
              : data.gmail.connected
                ? 'connected'
                : 'not connected'
            : '—'}
        </Text>
        {data?.gmail.mode === 'google' && !data.gmail.connected && (
          <Text style={styles.hint}>
            On the computer running the server, open http://localhost:3000/auth/google/start in a browser and approve
            read-only access.
          </Text>
        )}
        <Text style={styles.row}>
          Calorie estimates:{' '}
          {data ? (data.llm.mode === 'live' ? `model ${data.llm.model}` : 'placeholder values (no model configured)') : '—'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#1f2328' },
  field: { marginBottom: 10 },
  label: { fontSize: 13, color: '#57606a', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d0d7de', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  button: { backgroundColor: '#1ba672', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  message: { textAlign: 'center', marginBottom: 12 },
  row: { fontSize: 14, color: '#1f2328', marginBottom: 4 },
  hint: { fontSize: 12, color: '#57606a', marginBottom: 6 },
});
