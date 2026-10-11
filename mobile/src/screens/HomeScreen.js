import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, Image, Alert, Modal, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../state/auth';
import { api } from '../services/api';
import { uploadMedia } from '../services/upload';
import { c } from '../theme';

const RES = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };
const ratioOf = (w, h) => { const r = w / h; return r > 1.2 ? '16:9' : r < 0.7 ? '9:16' : r < 0.9 ? '4:5' : '1:1'; };
const mimeOf = (a) => a.mimeType || (a.type === 'video' ? 'video/mp4' : 'image/jpeg');

export default function HomeScreen({ navigation }) {
  const { user, offline } = useAuth();
  const [list, setList] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(null), [rename, setRename] = useState(null), [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { try { setList(await api.request('/projects')); setErr(''); } catch (e) { setErr(e.message); setList((l) => l || []); } }, []);
  useEffect(() => { load(); const u = navigation.addListener('focus', load); return u; }, [load, navigation]);

  async function newVideo() { // gallery -> project -> uploads (with progress + retry) -> editor with the clips on the timeline
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 30, quality: 1 });
    if (res.canceled || !res.assets?.length) return;
    const assets = res.assets, f = assets[0], [width, height] = RES[f.width && f.height ? ratioOf(f.width, f.height) : '9:16'];
    setErr(''); setBusy({ msg: 'Creating project…', pct: 0 });
    try {
      const p = await api.request('/projects', { method: 'POST', body: { name: `Project ${new Date().toLocaleDateString()}`, width, height, fps: 30 } });
      const ids = [], failed = [];
      for (let i = 0; i < assets.length; i++) {
        const a = assets[i];
        try {
          const m = await uploadMedia({ projectId: p.id, uri: a.uri, mime: mimeOf(a), duration: a.duration ? a.duration / 1000 : null, onProgress: (x) => setBusy({ msg: `Uploading ${i + 1} of ${assets.length}…`, pct: (i + x) / assets.length }) });
          ids.push(m.id);
        } catch (e) { failed.push(e.message); }
      }
      if (!ids.length) { setErr(failed[0] || 'Upload failed'); load(); return; }
      if (failed.length) Alert.alert('Some files were skipped', failed.slice(0, 3).join('\n'));
      navigation.navigate('Editor', { projectId: p.id, addIds: ids });
    } catch (e) { setErr(e.message); } finally { setBusy(null); }
  }
  const act = (fn) => async () => { try { await fn(); await load(); } catch (e) { setErr(e.message); } };
  const menu = (p) => Alert.alert(p.name, undefined, [
    { text: 'Rename', onPress: () => setRename({ id: p.id, name: p.name }) },
    { text: 'Duplicate', onPress: act(() => api.request(`/projects/${p.id}/duplicate`, { method: 'POST' })) },
    { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Delete project?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: act(() => api.request(`/projects/${p.id}`, { method: 'DELETE' })) }]) },
    { text: 'Cancel', style: 'cancel' },
  ]);
  const logout = () => Alert.alert('Log out?', 'You will need to log in again on this phone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: () => useAuth.getState().logout() }]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        <View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 24, fontWeight: '800' }}>Hi {(user?.name || '').split(' ')[0]} 👋</Text><Text style={{ color: c.mut }}>{offline ? 'Offline – showing saved session' : 'What will you create today?'}</Text></View>
        <Pressable onPress={logout} style={{ padding: 10 }}><Text style={{ color: c.mut, fontWeight: '700' }}>Log out</Text></Pressable>
      </View>
      <Pressable onPress={newVideo} style={{ marginHorizontal: 16, borderRadius: 22, padding: 20, backgroundColor: c.brand }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>＋ New video</Text><Text style={{ color: '#ffffffcc' }}>Pick photos & videos from your gallery</Text>
      </Pressable>
      {!!err && <View style={{ margin: 16, padding: 12, borderRadius: 12, backgroundColor: '#ff63701a', flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: '#ffb3ba', flex: 1 }}>{err}</Text><Pressable onPress={load}><Text style={{ color: '#fff', fontWeight: '800' }}>Retry</Text></Pressable></View>}
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', margin: 16, marginBottom: 6 }}>Projects</Text>
      {list === null ? <ActivityIndicator style={{ marginTop: 30 }} color={c.brand} /> : (
        <FlatList data={list} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: 16, gap: 10 }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={c.brand} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          ListEmptyComponent={<Text style={{ color: c.mut, textAlign: 'center', marginTop: 30 }}>No projects yet. Tap “New video”.</Text>}
          renderItem={({ item: p }) => (
            <Pressable onPress={() => navigation.navigate('Editor', { projectId: p.id })} onLongPress={() => menu(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.s1, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 10 }}>
              <View style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: c.s2, overflow: 'hidden' }}>{!!p.thumbnailUrl && <Image source={{ uri: p.thumbnailUrl }} style={{ width: 64, height: 64 }} />}</View>
              <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{p.name}</Text><Text style={{ color: c.mut }}>{new Date(p.updatedAt).toLocaleDateString()} · {p.width}×{p.height} · {Math.round(p.duration)}s</Text></View>
              <Pressable onPress={() => menu(p)} hitSlop={12}><Text style={{ color: c.mut, fontSize: 22 }}>⋮</Text></Pressable>
            </Pressable>)} />)}
      <Modal visible={!!busy} transparent animationType="fade"><View style={{ flex: 1, backgroundColor: '#000b', justifyContent: 'center', padding: 30 }}><View style={{ backgroundColor: c.s2, borderRadius: 20, padding: 22, gap: 12, alignItems: 'center' }}>
        <ActivityIndicator color={c.brand} /><Text style={{ color: c.text, fontWeight: '800' }}>{busy?.msg}</Text>
        <View style={{ height: 8, alignSelf: 'stretch', backgroundColor: c.s3, borderRadius: 4 }}><View style={{ height: 8, width: `${Math.round((busy?.pct || 0) * 100)}%`, backgroundColor: c.brand, borderRadius: 4 }} /></View><Text style={{ color: c.mut }}>Keep the app open</Text></View></View></Modal>
      <Modal visible={!!rename} transparent animationType="fade"><View style={{ flex: 1, backgroundColor: '#000b', justifyContent: 'center', padding: 24 }}><View style={{ backgroundColor: c.s2, borderRadius: 20, padding: 18, gap: 12 }}>
        <Text style={{ color: c.text, fontWeight: '800' }}>Rename project</Text>
        <TextInput value={rename?.name} onChangeText={(name) => setRename((r) => ({ ...r, name }))} autoFocus style={{ backgroundColor: c.s3, color: c.text, borderRadius: 12, padding: 12, fontSize: 16 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 18 }}>
          <Pressable onPress={() => setRename(null)}><Text style={{ color: c.mut, fontWeight: '700' }}>Cancel</Text></Pressable>
          <Pressable onPress={act(async () => { const r = rename; setRename(null); if (r.name.trim()) await api.request(`/projects/${r.id}`, { method: 'PUT', body: { name: r.name.trim() } }); })}><Text style={{ color: '#9fb0ff', fontWeight: '800' }}>Save</Text></Pressable></View></View></View></Modal>
    </SafeAreaView>
  );
}
