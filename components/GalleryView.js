import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  FlatList, Modal, Share, Alert, Platform, Dimensions, ActivityIndicator,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing   from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

const { width: W } = Dimensions.get('window');
const COL_GAP   = 3;
const PHOTO_W   = (W - COL_GAP) / 2;
const PHOTO_H   = PHOTO_W * 1.25;

const C = {
  bg: '#070d1f', surface: '#0f1830', surface2: '#1a2440',
  border: 'rgba(255,255,255,0.08)', text: '#ffffff',
  dim: 'rgba(255,255,255,0.5)', mute: 'rgba(255,255,255,0.2)',
  accent: '#4d8ef7', warm: '#f5a523', red: '#ff4757',
};

const PERSON_COLORS = ['#4d8ef7','#f5a523','#ff6b9d','#4ecdc4','#a78bfa','#34d399','#f87171'];
const personColor   = (uid) => {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = uid.charCodeAt(i) + ((h << 5) - h);
  return PERSON_COLORS[Math.abs(h) % PERSON_COLORS.length];
};

export default function GalleryView({ event, photos, photosLoading, userId, onBack }) {
  const [selected, setSelected] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2400); };

  const saveToDevice = async (photo) => {
    if (photo.isOptimistic) { showToast('Still uploading…'); return; }
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo library access to save.'); return; }
      const dest = FileSystem.cacheDirectory + `candid-${photo.id}.jpg`;
      await FileSystem.downloadAsync(photo.url, dest);
      await MediaLibrary.createAssetAsync(dest);
      showToast('Saved to camera roll ✓');
    } catch { Alert.alert('Error', 'Could not save photo.'); }
    finally  { setSaving(false); }
  };

  const sharePhoto = async (photo) => {
    if (photo.isOptimistic) { showToast('Still uploading…'); return; }
    try {
      if (await Sharing.isAvailableAsync()) {
        const dest = FileSystem.cacheDirectory + `candid-share-${photo.id}.jpg`;
        await FileSystem.downloadAsync(photo.url, dest);
        await Sharing.shareAsync(dest, { mimeType: 'image/jpeg' });
      } else {
        await Share.share({ message: `📷 ${event.name}\n${photo.url}` });
      }
    } catch {}
  };

  const shareGallery = () => {
    Share.share({ message: `📷 ${event.name}\n\nCode: ${event.code}\n\nCheck out all our photos!` });
  };

  const renderPhoto = ({ item: photo }) => {
    const isOwn = photo.user_id === userId;
    const isOpt = !!photo.isOptimistic;
    const color = personColor(photo.user_id);

    return (
      <TouchableOpacity
        style={s.photoWrap}
        onPress={() => !isOpt && setSelected(photo)}
        activeOpacity={isOpt ? 1 : 0.92}
      >
        <Image source={{ uri: photo.url }} style={[s.photo, isOpt && { opacity: 0.55 }]} resizeMode="cover" />

        {/* Gradient overlay + name */}
        <View style={s.photoOverlay} pointerEvents="none">
          {isOpt ? (
            <View style={s.uploadingRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={s.uploadingText}>Uploading…</Text>
            </View>
          ) : (
            <View style={[s.authorChip, { backgroundColor: color + '33', borderColor: color + '66' }]}>
              <View style={[s.authorDot, { backgroundColor: color }]} />
              {isOwn && <Text style={s.authorYou}>YOU</Text>}
            </View>
          )}
        </View>

        {/* Quick actions (only after upload) */}
        {!isOpt && (
          <View style={s.quickActions} pointerEvents="box-none">
            <TouchableOpacity onPress={() => saveToDevice(photo)} style={s.quickBtn} activeOpacity={0.8}>
              <Text style={s.quickIcon}>⬇</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => sharePhoto(photo)} style={s.quickBtn} activeOpacity={0.8}>
              <Text style={s.quickIcon}>↗</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const uploaded = photos.filter(p => !p.isOptimistic).length;
  const total    = photos.length;

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.75}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{event.name}</Text>
          <Text style={s.headerSub}>{total} photo{total !== 1 ? 's' : ''}</Text>
        </View>

        <TouchableOpacity onPress={shareGallery} style={s.shareBtn} activeOpacity={0.75}>
          <Text style={s.shareIcon}>↗</Text>
        </TouchableOpacity>
      </View>

      {/* Live indicator */}
      <View style={s.liveBar}>
        <View style={s.liveDot} />
        <Text style={s.liveText}>LIVE</Text>
        {total > 0 && uploaded < total && (
          <Text style={s.syncText}>{total - uploaded} uploading…</Text>
        )}
      </View>

      {/* Photo grid */}
      {photosLoading && total === 0 ? (
        <View style={s.empty}>
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={s.emptyText}>Loading photos…</Text>
        </View>
      ) : total === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>📷</Text>
          <Text style={s.emptyText}>No photos yet</Text>
          <Text style={s.emptySub}>Be the first to shoot</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={p => p.id}
          numColumns={2}
          contentContainerStyle={s.grid}
          columnWrapperStyle={{ gap: COL_GAP }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Toast */}
      {!!toast && (
        <View style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}

      {/* Full-screen viewer */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={s.viewer}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          {selected && (
            <>
              <Image source={{ uri: selected.url }} style={s.viewerImg} resizeMode="contain" />
              <View style={s.viewerActions}>
                <TouchableOpacity style={s.viewerBtn} onPress={() => saveToDevice(selected)} activeOpacity={0.85}>
                  <Text style={s.viewerBtnText}>{saving ? 'Saving…' : '⬇  Save'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.viewerBtn, s.viewerBtnGhost]} onPress={() => sharePhoto(selected)} activeOpacity={0.85}>
                  <Text style={[s.viewerBtnText, { color: '#fff' }]}>↗  Share</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={() => setSelected(null)}>
                <Text style={s.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 14, paddingHorizontal: 18,
    backgroundColor: C.bg,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 20, color: C.text },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { fontFamily: 'SpaceMono_700Bold', fontSize: 13, color: C.text, letterSpacing: 0.5 },
  headerSub: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: C.dim, marginTop: 2 },
  shareBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  shareIcon: { fontSize: 20, color: C.accent },

  liveBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.red },
  liveText: { fontFamily: 'SpaceMono_700Bold', fontSize: 9, letterSpacing: 2, color: C.dim },
  syncText: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: C.dim, marginLeft: 8 },

  grid: { gap: COL_GAP, padding: 0 },

  photoWrap: { width: PHOTO_W, height: PHOTO_H, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },

  photoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
  },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  uploadingText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.7)' },
  authorChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
  },
  authorDot: { width: 7, height: 7, borderRadius: 4 },
  authorYou: { fontFamily: 'SpaceMono_700Bold', fontSize: 8, color: '#fff', letterSpacing: 1 },

  quickActions: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', gap: 4,
  },
  quickBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  quickIcon: { color: '#fff', fontSize: 12, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyEmoji: { fontSize: 52 },
  emptyText: { fontFamily: 'SpaceMono_700Bold', fontSize: 13, letterSpacing: 2, color: C.dim },
  emptySub: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, letterSpacing: 1, color: C.mute },

  toast: {
    position: 'absolute', bottom: 36, alignSelf: 'center',
    backgroundColor: 'rgba(15,24,48,0.96)', borderRadius: 999,
    paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1, borderColor: C.border,
  },
  toastText: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: '#fff', letterSpacing: 0.5 },

  viewer: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.97)',
    alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  viewerImg: { width: '100%', height: '72%' },
  viewerActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  viewerBtn: {
    backgroundColor: C.accent, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12,
  },
  viewerBtnGhost: {
    backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  viewerBtnText: { fontFamily: 'SpaceMono_700Bold', fontSize: 12, color: '#fff', letterSpacing: 1 },
  closeBtn: {
    position: 'absolute', top: 56, right: 20, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
