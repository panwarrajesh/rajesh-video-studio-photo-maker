import { Component } from 'react';
import { View, Text, Pressable, Share, ScrollView } from 'react-native';
import { saveLastError } from '../lastError';
import { c } from '../theme';

// A crash shows this screen (with the error and a Share button) instead of a blank screen or the app silently closing.
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { saveLastError(error); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const text = `Rajesh Video Studio crashed\n${String(error?.stack || error?.message || error).slice(0, 1500)}`;
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: 24, justifyContent: 'center', gap: 14 }}>
        <Text style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>Something went wrong</Text>
        <Text style={{ color: c.mut }}>Your projects are safe on the server. Tap “Try again”. If it keeps happening, share the report.</Text>
        <ScrollView style={{ maxHeight: 180, backgroundColor: c.s2, borderRadius: 12, padding: 12 }}><Text style={{ color: '#ffb3ba', fontSize: 12 }}>{String(error?.message || error)}</Text></ScrollView>
        <Pressable onPress={() => this.setState({ error: null })} style={{ backgroundColor: c.brand, borderRadius: 12, padding: 14, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '800' }}>Try again</Text></Pressable>
        <Pressable onPress={() => Share.share({ message: text })} style={{ backgroundColor: c.s3, borderRadius: 12, padding: 14, alignItems: 'center' }}><Text style={{ color: c.text, fontWeight: '800' }}>Share error report</Text></Pressable>
      </View>
    );
  }
}
