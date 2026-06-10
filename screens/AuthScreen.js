import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, ScrollView, Platform,
} from 'react-native';
import { signIn, signUp } from '../supabase';

const C = {
  bg: '#070d1f', surface: '#0f1830', surface2: '#1a2440',
  border: 'rgba(255,255,255,0.08)', text: '#ffffff',
  dim: 'rgba(255,255,255,0.45)', mute: 'rgba(255,255,255,0.18)',
  accent: '#4d8ef7', red: '#ff4757',
};

export default function AuthScreen() {
  const [mode,        setMode]        = useState('signin');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const toggle = () => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); };

  const handle = async () => {
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    if (mode === 'signup' && password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError('');
    try {
      if (mode === 'signin') {
        await signIn({ email: email.trim(), password });
      } else {
        await signUp({ email: email.trim(), password, displayName: displayName.trim() || email.split('@')[0] });
      }
    } catch (e) {
      setError(e.message ?? 'Something went wrong. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.root} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={s.logoWrap}>
          <Text style={s.logo}>CANDID<Text style={{ color: C.accent }}> CAM</Text></Text>
          <Text style={s.tagline}>
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </Text>
        </View>

        <View style={s.form}>
          {mode === 'signup' && (
            <TextInput
              style={s.input} placeholder="Your name" placeholderTextColor={C.mute}
              value={displayName} onChangeText={setDisplayName}
              autoCapitalize="words" returnKeyType="next"
            />
          )}
          <TextInput
            style={s.input} placeholder="Email address" placeholderTextColor={C.mute}
            value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none" autoComplete="email" returnKeyType="next"
          />
          <TextInput
            style={s.input}
            placeholder={mode === 'signup' ? 'Password (min 6 characters)' : 'Password'}
            placeholderTextColor={C.mute}
            value={password} onChangeText={setPassword}
            secureTextEntry returnKeyType="done" onSubmitEditing={handle}
          />

          {!!error && (
            <View style={s.errBox}>
              <Text style={s.errText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={handle} disabled={loading} activeOpacity={0.88}>
            <Text style={s.btnText}>
              {loading
                ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
                : (mode === 'signin' ? 'Sign In  →' : 'Create Account  →')}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={toggle} style={s.toggle} activeOpacity={0.7}>
          <Text style={s.toggleText}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <Text style={{ color: C.accent }}>{mode === 'signin' ? 'Sign up' : 'Sign in'}</Text>
          </Text>
        </TouchableOpacity>

        <Text style={s.legal}>Your photos are shared with all guests in the same event.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flexGrow: 1, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center', padding: 28, minHeight: '100%',
  },
  logoWrap: { alignItems: 'center', marginBottom: 44 },
  logo: { fontFamily: 'BebasNeue_400Regular', fontSize: 60, color: C.text, letterSpacing: 5, lineHeight: 64 },
  tagline: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, letterSpacing: 2, color: C.dim, marginTop: 8 },

  form: { width: '100%', maxWidth: 340, gap: 12 },
  input: {
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 15,
    fontFamily: 'SpaceMono_400Regular', fontSize: 13, color: C.text,
  },
  errBox: {
    backgroundColor: 'rgba(255,71,87,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.3)', borderRadius: 10, padding: 12,
  },
  errText: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: '#ff6b78', textAlign: 'center' },

  btn: { backgroundColor: C.accent, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  btnText: { fontFamily: 'SpaceMono_700Bold', fontSize: 13, color: '#fff', letterSpacing: 1 },

  toggle: { marginTop: 28, padding: 10 },
  toggleText: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: C.dim, letterSpacing: 0.3 },

  legal: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9, letterSpacing: 0.5,
    color: C.mute, textAlign: 'center', marginTop: 24, lineHeight: 14,
  },
});
