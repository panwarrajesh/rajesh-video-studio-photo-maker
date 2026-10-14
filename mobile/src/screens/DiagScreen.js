import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { runDiagnostics, reportText } from '../diagnostics';
import { api } from '../services/api';
import { API_URL, APP_VERSION } from '../config';
import { readLastError, clearLastError } from '../lastError';
import { c } from '../theme';

export default function DiagScreen({ navigation }) {
  const [results, setResults] = useState(null), [last, setLast] = useState(null);
  const run = useCallback(async () => {
    setResults(null); setLast(await readLastError());
    setResults(await runDiagnostics({ apiUrl: API_URL, session: () => api.restore() }));
  }, []);
  useEffect(() => { run(); }, [run]);
  const text = results && reportText({ results, appVersion: APP_VERSION, os: `${Platform.OS} ${Platform.Version}`, apiUrl: API_URL, lastError: last });
  const bad = results?.filter((r) => !r.ok) || [];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}><Text style={{ color: c.text, fontSize: 22 }}>‹</Text></Pressable>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '800', flex: 1 }}>Connection check</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {!results && <ActivityIndicator color={c.brand} style={{ marginTop: 30 }} />}
        {results && <Text style={{ color: bad.length ? c.danger : c.ok, fontWeight: '800', fontSize: 16 }}>{bad.length ? `${bad.length} problem${bad.length > 1 ? 's' : ''} found` : 'Everything looks fine'}</Text>}
        {results?.map((r) => (
          <View key={r.id} style={{ backgroundColor: c.s1, borderRadius: 14, borderWidth: 1, borderColor: r.ok ? c.line : '#ff637066', padding: 12, gap: 4 }}>
            <Text style={{ color: r.ok ? c.text : c.danger, fontWeight: '800' }}>{r.ok ? '✓' : '✗'}  {r.title}</Text>
            {!!r.detail && <Text style={{ color: c.mut, fontSize: 12 }}>{r.detail}</Text>}
            {!r.ok && !!r.fix && <Text style={{ color: '#ffd9a0', fontSize: 13 }}>{r.fix}</Text>}
          </View>))}
        {!!last && <View style={{ backgroundColor: c.s1, borderRadius: 14, padding: 12 }}><Text style={{ color: c.danger, fontWeight: '800' }}>Last crash</Text><Text style={{ color: c.mut, fontSize: 11 }}>{last}</Text>
          <Pressable onPress={async () => { await clearLastError(); setLast(null); }}><Text style={{ color: '#9fb0ff', marginTop: 6 }}>Clear</Text></Pressable></View>}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, padding: 16 }}>
        <Pressable onPress={run} style={{ flex: 1, backgroundColor: c.s3, borderRadius: 12, padding: 14, alignItems: 'center' }}><Text style={{ color: c.text, fontWeight: '800' }}>Check again</Text></Pressable>
        <Pressable disabled={!results} onPress={() => Share.share({ message: text })} style={{ flex: 1, backgroundColor: c.brand, borderRadius: 12, padding: 14, alignItems: 'center', opacity: results ? 1 : 0.5 }}><Text style={{ color: '#fff', fontWeight: '800' }}>Share report</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}
