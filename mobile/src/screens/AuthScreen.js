import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../state/auth';
import { API_URL } from '../config';
import { c } from '../theme';

export default function AuthScreen() {
  const [mode, setMode] = useState('login'), [name, setName] = useState(''), [email, setEmail] = useState(''), [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const reg = mode === 'register';
  async function submit() {
    if (!API_URL) return setErr('App is not configured: set EXPO_PUBLIC_API_URL (see README).');
    setErr(''); setBusy(true);
    try { if (reg) await useAuth.getState().register(name, email, pw); else await useAuth.getState().login(email, pw); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  const input = { backgroundColor: c.s2, color: c.text, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 14, fontSize: 16 };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: c.text, fontSize: 30, fontWeight: '800' }}>Rajesh Video Studio</Text>
          <Text style={{ color: c.mut, marginBottom: 12 }}>{reg ? 'Create your account' : 'Welcome back. Log in to continue.'}</Text>
          {reg && <TextInput style={input} placeholder="Name" placeholderTextColor={c.mut} value={name} onChangeText={setName} />}
          <TextInput style={input} placeholder="Email" placeholderTextColor={c.mut} autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
          <TextInput style={input} placeholder="Password (min 8)" placeholderTextColor={c.mut} secureTextEntry autoComplete={reg ? 'new-password' : 'current-password'} value={pw} onChangeText={setPw} onSubmitEditing={submit} />
          {!!err && <Text style={{ color: c.danger }}>{err}</Text>}
          <Pressable onPress={submit} disabled={busy} style={{ backgroundColor: c.brand, borderRadius: 12, padding: 15, alignItems: 'center', opacity: busy ? 0.7 : 1 }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{reg ? 'Sign up' : 'Log in'}</Text>}
          </Pressable>
          <Pressable onPress={() => { setMode(reg ? 'login' : 'register'); setErr(''); }}><Text style={{ color: '#9fb0ff', textAlign: 'center', padding: 8 }}>{reg ? 'Have an account? Log in' : 'New here? Sign up'}</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
