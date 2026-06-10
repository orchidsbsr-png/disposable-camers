import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Your Supabase project credentials ────────────────────────────
// Project Settings → API → Project URL + anon public key
const SUPABASE_URL  = 'https://xyscefxarwpdphyjiltj.supabase.co';
const SUPABASE_ANON = 'sb_publishable_BpiGG5_mIaqL9Ne7kTRJWg_xxyJ5DAZ';
// ──────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage:           AsyncStorage,
    autoRefreshToken:  true,
    persistSession:    true,
    detectSessionInUrl: false,   // Required for React Native (no URL-based OAuth)
  },
});

// ── Auth ──────────────────────────────────────────────────────────

export const signUp = async ({ email, password, displayName }) => {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: displayName?.trim() || email.split('@')[0] } },
  });
  if (error) throw error;
  return data;
};

export const signIn = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
};

export const signOut = () => supabase.auth.signOut();

// ── Events ────────────────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode    = () =>
  Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export const createEvent = async ({ name, maxPhotos = 10, hostId }) => {
  const code = genCode();
  const { data, error } = await supabase
    .from('events')
    .insert({ name: name.trim(), code, max_photos: maxPhotos, host_id: hostId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getEventByCode = async (code) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .maybeSingle();
  if (error) throw error;
  return data; // null if not found
};

// ── Photos ────────────────────────────────────────────────────────

export const fetchPhotos = async (eventId) => {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('event_id', eventId)
    .order('taken_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
};

export const insertPhoto = async ({ eventId, userId, url, filterId }) => {
  const { data, error } = await supabase
    .from('photos')
    .insert({ event_id: eventId, user_id: userId, url, filter_id: filterId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// Upload local photo URI → Supabase Storage → return public URL.
// Uses XHR + FormData: React Native handles FormData with { uri, name, type }
// natively at the OS level — no expo-file-system needed, no fetch() limitations.
export const uploadToStorage = (localUri, eventId, userId) =>
  new Promise(async (resolve, reject) => {
    const path = `${eventId}/${userId}/${Date.now()}.jpg`;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return reject(new Error('Not authenticated'));

    const form = new FormData();
    // React Native reads file:// URIs natively when passed in this shape
    form.append('', { uri: localUri, name: 'photo.jpg', type: 'image/jpeg' });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/event-photos/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON);
    // Do NOT set Content-Type manually — XHR sets multipart/form-data with boundary

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const { data } = supabase.storage
          .from('event-photos')
          .getPublicUrl(path);
        resolve(data.publicUrl);
      } else {
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
      }
    };
    xhr.onerror   = () => reject(new Error('XHR network error'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.timeout   = 30_000;
    xhr.send(form);
  });

// Realtime subscription for photos in an event
export const subscribeToPhotos = (eventId, onInsert) => {
  const channel = supabase
    .channel(`photos:${eventId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'photos', filter: `event_id=eq.${eventId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
};
