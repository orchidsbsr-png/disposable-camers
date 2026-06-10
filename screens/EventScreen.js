import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { getEventByCode } from '../supabase';
import { getCachedEvent, saveEvent } from '../db';
import { usePhotos } from '../hooks/usePhotos';
import CameraView from '../components/CameraView';
import GalleryView from '../components/GalleryView';

export default function EventScreen({ user, eventCode, onBack }) {
  const [event,   setEvent]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [view,    setView]    = useState('camera'); // 'camera' | 'gallery'

  // Load event — cache first, then network
  useEffect(() => {
    const load = async () => {
      try {
        let ev = await getCachedEvent(eventCode);
        if (!ev) {
          ev = await getEventByCode(eventCode);
          if (ev) await saveEvent(ev);
        }
        if (!ev) { setError('Event not found. Check the code.'); return; }
        setEvent(ev);
      } catch {
        setError('Could not load event. Check your connection.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventCode]);

  // ── Photo state (cache + optimistic + realtime) ───────────────────
  const { photos, loading: photosLoading, addPhoto } = usePhotos(
    event?.id ?? null,
    user.id
  );

  // Derive shots used from photos array (optimistic rows count immediately)
  const shotsUsed = photos.filter(p => p.user_id === user.id).length;

  // Most recent photo by this user (for gallery thumbnail in camera)
  const lastPhotoUri = [...photos].reverse().find(p => p.user_id === user.id)?.url ?? null;

  // ── Loading / error states ────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.center}>
        <Text style={s.loadingEmoji}>🎞️</Text>
        <Text style={s.loadingText}>LOADING FILM...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.loadingEmoji}>🎞️</Text>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.85}>
          <Text style={s.backBtnText}>← GO HOME</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {view === 'camera' ? (
        <CameraView
          event={event}
          userId={user.id}
          shotsUsed={shotsUsed}
          maxShots={event.max_photos}
          onPhotoTaken={addPhoto}
          onGallery={() => setView('gallery')}
          lastPhotoUri={lastPhotoUri}
        />
      ) : (
        <GalleryView
          event={event}
          photos={photos}
          photosLoading={photosLoading}
          userId={user.id}
          onBack={() => setView('camera')}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1, backgroundColor: '#0d0800',
    alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 16,
  },
  loadingEmoji: { fontSize: 48 },
  loadingText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12, letterSpacing: 4, color: 'rgba(254,243,199,0.55)',
  },
  errorText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 13, color: 'rgba(254,243,199,0.7)',
    textAlign: 'center', lineHeight: 22, letterSpacing: 0.5,
  },
  backBtn: {
    marginTop: 8, backgroundColor: '#ffbb00',
    paddingVertical: 13, paddingHorizontal: 32, borderRadius: 6,
  },
  backBtnText: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 13, color: '#0d0800', letterSpacing: 2,
  },
});
