import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import * as Linking from 'expo-linking';
import { useAuth } from './hooks/useAuth';
import AuthScreen  from './screens/AuthScreen';
import HomeScreen  from './screens/HomeScreen';
import EventScreen from './screens/EventScreen';

export default function App() {
  const [screen,    setScreen]    = useState('home');
  const [eventCode, setEventCode] = useState('');
  const { user, isLoading } = useAuth();

  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  const goToEvent = useCallback((code) => {
    setEventCode(code.toUpperCase().trim());
    setScreen('event');
  }, []);

  const goHome = useCallback(() => setScreen('home'), []);

  // ── Deep-link / QR-code handler ───────────────────────────────────
  const handleURL = useCallback(({ url }) => {
    if (!url) return;
    try {
      const { path } = Linking.parse(url);
      // handles:  candidcam://join/ABC123
      //           exp://x.x.x.x:8081/--/join/ABC123
      const clean = (path ?? '').replace(/^--\//, '');
      const match = clean.match(/^join\/([A-Z0-9]{6})$/i);
      if (match) goToEvent(match[1]);
    } catch {}
  }, [goToEvent]);

  useEffect(() => {
    Linking.getInitialURL().then(url => url && handleURL({ url }));
    const sub = Linking.addEventListener('url', handleURL);
    return () => sub.remove();
  }, [handleURL]);

  if (!fontsLoaded || isLoading) {
    return <View style={s.splash}><StatusBar style="light" /></View>;
  }

  if (!user) {
    return (
      <View style={s.root}>
        <StatusBar style="light" />
        <AuthScreen />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      {screen === 'home'
        ? <HomeScreen user={user} onJoinEvent={goToEvent} />
        : <EventScreen user={user} eventCode={eventCode} onBack={goHome} />
      }
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#070d1f' },
  splash: { flex: 1, backgroundColor: '#070d1f' },
});
