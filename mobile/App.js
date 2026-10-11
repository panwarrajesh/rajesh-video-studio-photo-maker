import { useEffect } from 'react';
import { AppState, View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from './src/state/auth';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import EditorScreen from './src/screens/EditorScreen';
import { c } from './src/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const status = useAuth((s) => s.status);
  useEffect(() => { // restore the saved session on start; re-check when the app returns from the background
    useAuth.getState().restore();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') useAuth.getState().revalidate(); });
    return () => sub.remove();
  }, []);
  // 'loading' shows a splash, so a logged-in user never sees the login screen flash
  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}><Text style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>Rajesh Video Studio</Text><ActivityIndicator color={c.brand} /></View>;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: c.bg, card: c.s1, primary: c.brand } }}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          {status === 'authed' ? (<><Stack.Screen name="Home" component={HomeScreen} /><Stack.Screen name="Editor" component={EditorScreen} options={{ gestureEnabled: false }} /></>) : <Stack.Screen name="Auth" component={AuthScreen} />}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
