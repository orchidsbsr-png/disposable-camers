import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Dimensions, Platform,
} from 'react-native';
import { CameraView as ExpoCameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';

const { width: W, height: H } = Dimensions.get('window');

const C = {
  bg: '#000', text: '#fff', dim: 'rgba(255,255,255,0.55)',
  mute: 'rgba(255,255,255,0.25)', accent: '#4d8ef7', warm: '#f5a523',
  surface: 'rgba(0,0,0,0.55)', border: 'rgba(255,255,255,0.12)',
};

export const FILTERS = [
  { id: 'natural', name: 'NATURAL', overlay: null,               opacity: 0    },
  { id: 'kodak',   name: 'KODAK',   overlay: 'rgb(255,170,40)',  opacity: 0.13 },
  { id: 'fuji',    name: 'FUJI',    overlay: 'rgb(20,80,20)',    opacity: 0.09 },
  { id: 'expired', name: 'EXPIRED', overlay: 'rgb(200,140,30)',  opacity: 0.22 },
  { id: 'bw',      name: 'B&W',     overlay: 'rgb(40,40,40)',    opacity: 0.28 },
  { id: 'fade',    name: 'FADE',    overlay: 'rgb(255,255,255)', opacity: 0.15 },
  { id: 'vivid',   name: 'VIVID',   overlay: 'rgb(80,0,200)',    opacity: 0.08 },
  { id: 'cinema',  name: 'CINEMA',  overlay: 'rgb(0,0,30)',      opacity: 0.22 },
];

const ZOOM_STEPS = [0, 0.1, 0.5]; // rough: 1x, 2x, 5x on most sensors
const ZOOM_LABELS = ['1×', '2×', '5×'];

export default function CameraView({ event, userId, shotsUsed, maxShots, onPhotoTaken, onGallery, lastPhotoUri }) {
  const cameraRef  = useRef(null);
  const flashAnim  = useRef(new Animated.Value(0)).current;
  // Slot-machine roll animation for the shot counter
  const rollY      = useRef(new Animated.Value(0)).current;
  const rollOpacity = useRef(new Animated.Value(1)).current;

  const [permission, requestPermission] = useCameraPermissions();
  const [facing,    setFacing]    = useState('back');
  const [flash,     setFlash]     = useState('off');  // 'off' | 'on' | 'torch'
  const [timerMode, setTimerMode] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [filterIdx, setFilterIdx] = useState(0);
  const [showGrid,  setShowGrid]  = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [zoomIdx,   setZoomIdx]   = useState(0);

  const shotsLeft     = maxShots - shotsUsed;
  const filmDone      = shotsLeft <= 0;
  const currentFilter = FILTERS[filterIdx];

  // Slot-machine roll: number exits upward, new number rolls in from below
  useEffect(() => {
    rollY.setValue(40);
    rollOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(rollY,      { toValue: 0,   useNativeDriver: true, tension: 120, friction: 8 }),
      Animated.timing(rollOpacity,{ toValue: 1,   duration: 180, useNativeDriver: true }),
    ]).start();
  }, [shotsLeft]);

  const doFlash = useCallback(() => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  }, [flashAnim]);

  const doCapture = useCallback(async () => {
    if (capturing || !cameraRef.current || filmDone) return;
    setCapturing(true);
    try {
      doFlash();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.88, skipProcessing: false, exif: false,
      });

      let uri = photo.uri;

      // Mirror front-camera selfies to match preview
      if (facing === 'front') {
        const flipped = await ImageManipulator.manipulateAsync(
          uri,
          [{ flip: ImageManipulator.FlipType.Horizontal }],
          { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG }
        );
        uri = flipped.uri;
      }

      onPhotoTaken(uri, currentFilter.id); // fire-and-forget
    } catch (e) {
      console.error('Capture error:', e);
    } finally {
      setCapturing(false);
    }
  }, [capturing, filmDone, facing, currentFilter, onPhotoTaken, doFlash]);

  const handleShutter = useCallback(() => {
    if (filmDone || countdown !== null) return;
    if (timerMode > 0) {
      let c = timerMode;
      setCountdown(c);
      const iv = setInterval(() => {
        c--;
        if (c <= 0) { clearInterval(iv); setCountdown(null); doCapture(); }
        else { setCountdown(c); Haptics.selectionAsync(); }
      }, 1000);
    } else {
      doCapture();
    }
  }, [filmDone, countdown, timerMode, doCapture]);

  const cycleFlash = () => setFlash(f => f === 'off' ? 'on' : f === 'on' ? 'torch' : 'off');
  const cycleTimer = () => setTimerMode(t => t === 0 ? 3 : t === 3 ? 10 : 0);
  const cycleZoom  = () => setZoomIdx(i => (i + 1) % ZOOM_STEPS.length);

  const flashIcon = flash === 'off' ? '⚡' : flash === 'on' ? '⚡' : '🔦';
  const flashLabel = flash === 'off' ? 'OFF' : flash === 'on' ? 'ON' : 'TORCH';

  if (!permission) return <View style={s.root} />;
  if (!permission.granted) {
    return (
      <View style={s.permRoot}>
        <Text style={s.permEmoji}>📷</Text>
        <Text style={s.permText}>Candid Cam needs camera access.</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={s.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Live camera feed */}
      <ExpoCameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
        zoom={ZOOM_STEPS[zoomIdx]}
      />

      {/* Filter colour overlay */}
      {currentFilter.overlay && (
        <View style={[StyleSheet.absoluteFill, {
          backgroundColor: currentFilter.overlay,
          opacity: currentFilter.opacity,
          pointerEvents: 'none',
        }]} />
      )}

      {/* Letterbox bars (cinematic feel) */}
      <View style={s.barTop} pointerEvents="none" />
      <View style={s.barBottom} pointerEvents="none" />

      {/* Grid overlay */}
      {showGrid && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {[0.33, 0.66].map(p => <View key={`h${p}`} style={[s.gridLine, { top: `${p * 100}%`, left: 0, right: 0, height: 1 }]} />)}
          {[0.33, 0.66].map(p => <View key={`v${p}`} style={[s.gridLine, { left: `${p * 100}%`, top: 0, bottom: 0, width: 1 }]} />)}
        </View>
      )}

      {/* Shutter flash overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: flashAnim }]}
        pointerEvents="none"
      />

      {/* Countdown */}
      {countdown !== null && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={s.countdownWrap}>
            <Text style={s.countdownNum}>{countdown}</Text>
          </View>
        </View>
      )}

      {/* ── TOP HUD ─────────────────────────────────────────────── */}
      <View style={s.topHud}>
        <TouchableOpacity onPress={onGallery} style={s.topBtn} activeOpacity={0.75}>
          <Text style={s.topBtnText}>✕</Text>
        </TouchableOpacity>

        <Text style={s.eventName} numberOfLines={1}>{event.name}</Text>

        <TouchableOpacity onPress={cycleFlash} style={[s.topBtn, flash !== 'off' && s.topBtnActive]} activeOpacity={0.75}>
          <Text style={s.topBtnText}>{flash === 'off' ? '⚡' : flash === 'on' ? '⚡' : '🔦'}</Text>
          {flash !== 'off' && <Text style={s.topBtnBadge}>{flashLabel}</Text>}
        </TouchableOpacity>
      </View>

      {/* ── RIGHT SIDE CONTROLS ────────────────────────────────── */}
      <View style={s.rightControls}>
        <TouchableOpacity style={[s.sideBtn, timerMode > 0 && s.sideBtnActive]} onPress={cycleTimer} activeOpacity={0.75}>
          <Text style={s.sideBtnText}>⏱</Text>
          {timerMode > 0 && <Text style={s.sideBadge}>{timerMode}s</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[s.sideBtn, showGrid && s.sideBtnActive]} onPress={() => setShowGrid(v => !v)} activeOpacity={0.75}>
          <Text style={s.sideBtnText}>⊞</Text>
        </TouchableOpacity>
      </View>

      {/* ── FILTER STRIP ───────────────────────────────────────── */}
      <View style={s.filterArea}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterContent}
        >
          {FILTERS.map((f, i) => (
            <TouchableOpacity
              key={f.id}
              style={[s.filterPill, i === filterIdx && s.filterPillOn]}
              onPress={() => setFilterIdx(i)}
              activeOpacity={0.8}
            >
              <Text style={[s.filterText, i === filterIdx && s.filterTextOn]}>{f.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── BOTTOM CONTROLS ────────────────────────────────────── */}
      <View style={s.bottomBar}>
        {/* Shot counter — slot-machine roll on each shutter press */}
        <View style={s.shotCounter}>
          <View style={s.shotNumClip}>
            <Animated.Text
              style={[s.shotNum, {
                transform: [{ translateY: rollY }],
                opacity: rollOpacity,
              }]}
            >
              {Math.max(0, shotsLeft)}
            </Animated.Text>
          </View>
          <Text style={s.shotLabel}>SHOTS{'\n'}LEFT</Text>
        </View>

        {/* Shutter */}
        <TouchableOpacity
          style={[s.shutterOuter, (filmDone || capturing) && { opacity: 0.35 }]}
          onPress={handleShutter}
          disabled={filmDone || capturing || countdown !== null}
          activeOpacity={0.9}
        >
          <View style={s.shutterInner} />
        </TouchableOpacity>

        {/* Right controls: zoom + flip */}
        <View style={s.rightBottom}>
          <TouchableOpacity style={s.zoomBtn} onPress={cycleZoom} activeOpacity={0.75}>
            <Text style={s.zoomText}>{ZOOM_LABELS[zoomIdx]}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.flipBtn}
            onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
            activeOpacity={0.75}
          >
            <Text style={s.flipText}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── FILM FINISHED ──────────────────────────────────────── */}
      {filmDone && (
        <View style={s.doneOverlay}>
          <Text style={s.doneEmoji}>🎞</Text>
          <Text style={s.doneTitle}>FILM FINISHED</Text>
          <Text style={s.doneSub}>You used all {maxShots} shots</Text>
          <TouchableOpacity style={s.doneBtn} onPress={onGallery} activeOpacity={0.85}>
            <Text style={s.doneBtnText}>View Gallery →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Letterbox
  barTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: Platform.OS === 'ios' ? 100 : 80,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  barBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: Platform.OS === 'ios' ? 180 : 160,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.18)' },

  countdownWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  countdownNum: {
    fontFamily: 'BebasNeue_400Regular', fontSize: 140, color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 16,
  },

  // Top HUD
  topHud: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: Platform.OS === 'ios' ? 58 : 36,
    paddingHorizontal: 20, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  topBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  topBtnActive: { backgroundColor: 'rgba(77,142,247,0.3)', borderColor: C.accent },
  topBtnText: { fontSize: 15 },
  topBtnBadge: {
    position: 'absolute', bottom: -4, right: -4,
    backgroundColor: C.accent, borderRadius: 8,
    paddingHorizontal: 4, paddingVertical: 1,
    fontSize: 7, color: '#fff', fontFamily: 'SpaceMono_700Bold',
  },
  eventName: {
    fontFamily: 'SpaceMono_700Bold', fontSize: 12, letterSpacing: 1,
    color: '#fff', maxWidth: W * 0.5, textAlign: 'center',
  },

  // Right controls
  rightControls: {
    position: 'absolute',
    right: 14,
    top: '38%',
    gap: 10,
  },
  sideBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  sideBtnActive: { backgroundColor: 'rgba(77,142,247,0.25)', borderColor: C.accent },
  sideBtnText: { fontSize: 18 },
  sideBadge: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 4,
    fontSize: 7, color: '#fff', fontFamily: 'SpaceMono_700Bold',
  },

  // Filter strip
  filterArea: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 148 : 128,
    left: 0, right: 0, height: 36,
  },
  filterContent: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: C.border,
  },
  filterPillOn: { backgroundColor: '#fff', borderColor: '#fff' },
  filterText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, letterSpacing: 1.5, color: C.dim },
  filterTextOn: { color: '#000', fontFamily: 'SpaceMono_700Bold' },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 12, paddingHorizontal: 32,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },

  // Shot counter (POV style) — slot-machine roll
  shotCounter: { alignItems: 'flex-start', width: 72 },
  shotNumClip: { height: 52, overflow: 'hidden', justifyContent: 'flex-end' },
  shotNum: {
    fontFamily: 'BebasNeue_400Regular', fontSize: 48,
    color: '#fff', lineHeight: 52,
  },
  shotLabel: {
    fontFamily: 'SpaceMono_700Bold', fontSize: 8,
    color: C.dim, letterSpacing: 1.5, lineHeight: 11,
  },

  // Shutter
  shutterOuter: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#fff',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#fff', shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  shutterInner: {
    width: 62, height: 62, borderRadius: 31,
    borderWidth: 2, borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },

  // Right bottom controls
  rightBottom: { alignItems: 'center', gap: 10, width: 72 },
  zoomBtn: {
    backgroundColor: C.surface, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  zoomText: { fontFamily: 'SpaceMono_700Bold', fontSize: 12, color: '#fff' },
  flipBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  flipText: { fontSize: 20 },

  // Film done overlay
  doneOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,13,31,0.95)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  doneEmoji: { fontSize: 60 },
  doneTitle: {
    fontFamily: 'BebasNeue_400Regular', fontSize: 44, letterSpacing: 4, color: '#fff',
  },
  doneSub: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 12, color: C.dim, letterSpacing: 1.5,
  },
  doneBtn: {
    marginTop: 12, backgroundColor: C.accent,
    paddingVertical: 15, paddingHorizontal: 36, borderRadius: 12,
  },
  doneBtnText: { fontFamily: 'SpaceMono_700Bold', fontSize: 13, color: '#fff', letterSpacing: 1 },

  // Permission
  permRoot: {
    flex: 1, backgroundColor: '#070d1f',
    alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16,
  },
  permEmoji: { fontSize: 56 },
  permText: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 13,
    color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 22,
  },
  permBtn: {
    backgroundColor: C.accent, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12,
  },
  permBtnText: { fontFamily: 'SpaceMono_700Bold', fontSize: 13, color: '#fff', letterSpacing: 1 },
});
