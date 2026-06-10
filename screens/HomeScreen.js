import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Share, Modal, Dimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Linking from 'expo-linking';
import { createEvent, getEventByCode, signOut } from '../supabase';
import { saveEvent, getCachedEvent } from '../db';

const { width: W } = Dimensions.get('window');
const MAX_OPTIONS  = [5, 10, 20, 36];

const C = {
  bg: '#070d1f', surface: '#0f1830', surface2: '#1a2440',
  border: 'rgba(255,255,255,0.08)', text: '#ffffff',
  dim: 'rgba(255,255,255,0.45)', mute: 'rgba(255,255,255,0.18)',
  accent: '#4d8ef7', warm: '#f5a523', red: '#ff4757',
};

export default function HomeScreen({ user, onJoinEvent }) {
  const [mode,         setMode]         = useState(null);
  const [eventName,    setEventName]    = useState('');
  const [maxPhotos,    setMaxPhotos]    = useState(10);
  const [joinCode,     setJoinCode]     = useState('');
  const [createdEvent, setCreatedEvent] = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [qrModal,      setQrModal]      = useState(false);

  const reset = () => { setMode(null); setError(''); setEventName(''); setJoinCode(''); };

  const handleCreate = async () => {
    if (!eventName.trim()) { setError('Give your event a name.'); return; }
    setLoading(true); setError('');
    try {
      const ev = await createEvent({ name: eventName, maxPhotos, hostId: user.id });
      await saveEvent(ev);
      setCreatedEvent(ev);
      setMode('created');
    } catch { setError('Could not create event. Check your connection.'); }
    finally  { setLoading(false); }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setError('Enter the 6-character code.'); return; }
    setLoading(true); setError('');
    try {
      let ev = await getCachedEvent(code);
      if (!ev) ev = await getEventByCode(code);
      if (!ev) { setError('Event not found.'); setLoading(false); return; }
      await saveEvent(ev);
      onJoinEvent(code);
    } catch { setError('Connection error. Try again.'); }
    finally  { setLoading(false); }
  };

  const getShareURL = () => createdEvent
    ? Linking.createURL(`join/${createdEvent.code}`)
    : '';

  const shareEvent = () => {
    Share.share({
      message: `📷 Join me on Candid Cam!\n\n${createdEvent.name}\nCode: ${createdEvent.code}\n\nScan the QR or tap to join instantly:\n${getShareURL()}`,
    });
  };

  const displayName = user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'there';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={s.root}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={s.topBar}>
          <Text style={s.greeting}>Hey, {displayName.split(' ')[0]} 👋</Text>
          <TouchableOpacity onPress={signOut} activeOpacity={0.7}>
            <Text style={s.signOut}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Logo */}
        <View style={s.logoWrap}>
          <Text style={s.logo}>CANDID<Text style={{ color: C.accent }}> CAM</Text></Text>
          <Text style={s.tagline}>disposable · digital · shared</Text>
        </View>

        {/* Main CTAs */}
        {mode === null && (
          <View style={s.ctaGroup}>
            <TouchableOpacity style={s.btnPrimary} onPress={() => setMode('create')} activeOpacity={0.88}>
              <Text style={s.btnPrimaryText}>📷  Create Event</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSecondary} onPress={() => setMode('join')} activeOpacity={0.88}>
              <Text style={s.btnSecondaryText}>Join with Code</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Create form */}
        {mode === 'create' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>New Event</Text>
            <Text style={s.label}>EVENT NAME</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Anna's Birthday"
              placeholderTextColor={C.mute}
              value={eventName}
              onChangeText={setEventName}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
              autoFocus
            />
            <Text style={s.label}>SHOTS PER PERSON</Text>
            <View style={s.pillRow}>
              {MAX_OPTIONS.map(n => (
                <TouchableOpacity
                  key={n}
                  style={[s.pill, maxPhotos === n && s.pillOn]}
                  onPress={() => setMaxPhotos(n)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.pillText, maxPhotos === n && s.pillTextOn]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!!error && <Text style={s.err}>{error}</Text>}
            <TouchableOpacity style={s.btnPrimary} onPress={handleCreate} disabled={loading} activeOpacity={0.88}>
              <Text style={s.btnPrimaryText}>{loading ? 'Creating…' : 'Create Event'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={reset} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Event created — QR + share */}
        {mode === 'created' && createdEvent && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Ready 🎉</Text>

            <TouchableOpacity style={s.qrBlock} onPress={() => setQrModal(true)} activeOpacity={0.85}>
              <QRCode value={getShareURL()} size={148} color="#ffffff" backgroundColor="transparent" />
              <Text style={s.qrHint}>Tap to enlarge</Text>
            </TouchableOpacity>

            <View style={s.codePill}>
              <Text style={s.codeLabel}>OR SHARE CODE</Text>
              <Text style={s.codeValue}>{createdEvent.code}</Text>
            </View>

            <TouchableOpacity style={s.btnPrimary} onPress={shareEvent} activeOpacity={0.88}>
              <Text style={s.btnPrimaryText}>📤  Share with Guests</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnSecondary, { marginTop: 10 }]} onPress={() => onJoinEvent(createdEvent.code)} activeOpacity={0.88}>
              <Text style={s.btnSecondaryText}>Open Camera →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Join form */}
        {mode === 'join' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Join Event</Text>
            <Text style={s.label}>6-CHARACTER CODE</Text>
            <TextInput
              style={[s.input, s.codeInput]}
              placeholder="ABC123"
              placeholderTextColor={C.mute}
              value={joinCode}
              onChangeText={t => setJoinCode(t.toUpperCase().slice(0, 6))}
              autoCapitalize="characters"
              maxLength={6}
              returnKeyType="go"
              onSubmitEditing={handleJoin}
              autoFocus
            />
            {!!error && <Text style={s.err}>{error}</Text>}
            <TouchableOpacity style={s.btnPrimary} onPress={handleJoin} disabled={loading} activeOpacity={0.88}>
              <Text style={s.btnPrimaryText}>{loading ? 'Finding…' : 'Join →'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={reset} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={s.footer}>Guests scan the QR code — no app install needed in Expo Go.</Text>
      </ScrollView>

      {/* Full-screen QR modal */}
      <Modal visible={qrModal} transparent animationType="fade" onRequestClose={() => setQrModal(false)}>
        <TouchableOpacity style={s.qrModal} activeOpacity={1} onPress={() => setQrModal(false)}>
          <View style={s.qrModalCard}>
            <Text style={s.qrModalTitle}>{createdEvent?.name}</Text>
            <Text style={s.qrModalSub}>Guests scan this to join instantly</Text>
            <View style={s.qrModalBox}>
              {createdEvent && (
                <QRCode value={getShareURL()} size={W * 0.62} color="#ffffff" backgroundColor="transparent" />
              )}
            </View>
            <Text style={s.qrCodeBig}>{createdEvent?.code}</Text>
            <Text style={s.qrDismiss}>Tap anywhere to close</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flexGrow: 1, backgroundColor: C.bg,
    paddingHorizontal: 24, paddingTop: 60, paddingBottom: 48, alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', maxWidth: 380, marginBottom: 44,
  },
  greeting: { fontSize: 13, color: C.dim, fontFamily: 'SpaceMono_400Regular' },
  signOut:  { fontSize: 12, color: C.red, fontFamily: 'SpaceMono_400Regular' },

  logoWrap: { alignItems: 'center', marginBottom: 52 },
  logo: { fontFamily: 'BebasNeue_400Regular', fontSize: 68, color: C.text, letterSpacing: 5, lineHeight: 72 },
  tagline: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, letterSpacing: 4, color: C.dim, marginTop: 6 },

  ctaGroup: { width: '100%', maxWidth: 360, gap: 12 },
  btnPrimary: {
    width: '100%', backgroundColor: C.accent,
    paddingVertical: 17, borderRadius: 14, alignItems: 'center',
  },
  btnPrimaryText: { fontFamily: 'SpaceMono_700Bold', fontSize: 13, color: '#fff', letterSpacing: 0.5 },
  btnSecondary: {
    width: '100%', paddingVertical: 17, borderRadius: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border,
  },
  btnSecondaryText: { fontFamily: 'SpaceMono_700Bold', fontSize: 13, color: C.dim, letterSpacing: 0.5 },

  card: {
    width: '100%', maxWidth: 380,
    backgroundColor: C.surface, borderRadius: 20,
    padding: 24, borderWidth: 1, borderColor: C.border, marginTop: 4,
  },
  cardTitle: {
    fontFamily: 'BebasNeue_400Regular', fontSize: 28, letterSpacing: 2,
    color: C.text, marginBottom: 20, textAlign: 'center',
  },
  label: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9, letterSpacing: 2.5,
    color: C.dim, marginBottom: 8,
  },
  input: {
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: 'SpaceMono_400Regular', fontSize: 14, color: C.text, marginBottom: 18,
  },
  codeInput: { textAlign: 'center', fontSize: 24, letterSpacing: 10 },

  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  pill: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  pillOn: { backgroundColor: C.accent, borderColor: C.accent },
  pillText: { fontFamily: 'SpaceMono_700Bold', fontSize: 14, color: C.dim },
  pillTextOn: { color: '#fff' },

  qrBlock: {
    alignItems: 'center', paddingVertical: 20, marginBottom: 16,
    borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2,
  },
  qrHint: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: C.dim,
    marginTop: 10, letterSpacing: 1,
  },

  codePill: {
    backgroundColor: C.surface2, borderRadius: 14, padding: 16,
    alignItems: 'center', marginBottom: 18, borderWidth: 1, borderColor: C.border,
  },
  codeLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, letterSpacing: 3, color: C.dim, marginBottom: 6 },
  codeValue: { fontFamily: 'BebasNeue_400Regular', fontSize: 44, letterSpacing: 10, color: C.text },

  err: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: C.red,
    textAlign: 'center', marginBottom: 10,
  },
  cancelBtn: { alignItems: 'center', marginTop: 14, padding: 6 },
  cancelText: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, letterSpacing: 1.5, color: C.dim },
  footer: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9, letterSpacing: 1,
    color: C.mute, textAlign: 'center', marginTop: 28, lineHeight: 16,
  },

  qrModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  qrModalCard: {
    backgroundColor: C.surface, borderRadius: 24, padding: 32,
    alignItems: 'center', width: '100%', maxWidth: 360, borderWidth: 1, borderColor: C.border,
  },
  qrModalTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 28, letterSpacing: 3, color: C.text, marginBottom: 4 },
  qrModalSub: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, letterSpacing: 1, color: C.dim, marginBottom: 28, textAlign: 'center' },
  qrModalBox: { padding: 20, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2 },
  qrCodeBig: { fontFamily: 'BebasNeue_400Regular', fontSize: 36, letterSpacing: 10, color: C.text, marginTop: 20 },
  qrDismiss: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: C.mute, marginTop: 16, letterSpacing: 1 },
});
