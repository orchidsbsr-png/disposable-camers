import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchPhotos, insertPhoto, uploadToStorage, subscribeToPhotos,
} from '../supabase';
import {
  getCachedPhotos, savePhoto, savePhotos, resolveOptimistic, deletePhoto,
} from '../db';

/**
 * Central hook for all photo data in an event.
 *
 * Load order (fastest-first):
 *   1. SQLite cache  → instant, shown on first render
 *   2. Supabase fetch → merges with cache, updates stale data
 *   3. Realtime sub  → live inserts from other users appear immediately
 *
 * Optimistic updates:
 *   - addPhoto() adds a temp row to state + SQLite right away (local URI)
 *   - Upload runs in background
 *   - On success: temp row is replaced by the real server row
 *   - On failure: temp row is removed
 */
export function usePhotos(eventId, userId) {
  const [photos,  setPhotos]  = useState([]);
  const [loading, setLoading] = useState(true);
  const activeRef = useRef(true);

  useEffect(() => {
    if (!eventId) return;
    activeRef.current = true;

    const init = async () => {
      // ── Step 1: SQLite (instant) ───────────────────────────────────
      const cached = await getCachedPhotos(eventId);
      if (activeRef.current) {
        setPhotos(cached.map(p => ({ ...p, isOptimistic: !!p.is_optimistic })));
        setLoading(false);
      }

      // ── Step 2: Supabase fetch (background) ───────────────────────
      try {
        const remote = await fetchPhotos(eventId);
        if (!activeRef.current) return;

        await savePhotos(remote);

        setPhotos(prev => {
          // Keep optimistic rows from THIS user that aren't yet in Supabase
          const remoteIds = new Set(remote.map(p => p.id));
          const optimistic = prev.filter(p => p.isOptimistic && !remoteIds.has(p.id));
          return mergeSorted(remote.map(p => ({ ...p, isOptimistic: false })), optimistic);
        });
      } catch {
        // Network unavailable — cached data is already showing
      }
    };

    init();

    // ── Step 3: Realtime subscription ─────────────────────────────
    const unsub = subscribeToPhotos(eventId, async (newPhoto) => {
      if (!activeRef.current) return;
      const normalized = { ...newPhoto, isOptimistic: false };
      await savePhoto(normalized, false);

      setPhotos(prev => {
        // Already in list (shouldn't happen, but guard)
        if (prev.some(p => p.id === newPhoto.id)) return prev;

        // Replace matching optimistic from same user (within 90 s)
        const t = new Date(newPhoto.taken_at).getTime();
        const filtered = prev.filter(p => {
          if (!p.isOptimistic || p.user_id !== newPhoto.user_id) return true;
          return Math.abs(new Date(p.taken_at).getTime() - t) > 90_000;
        });
        return mergeSorted(filtered, [normalized]);
      });
    });

    return () => {
      activeRef.current = false;
      unsub();
    };
  }, [eventId]);

  /**
   * Take a photo:
   *   1. Adds temp row to state immediately (local URI → instant gallery update)
   *   2. Uploads to Supabase Storage + inserts DB row in the background
   *   3. Swaps temp with real row on success; removes on failure
   */
  const addPhoto = useCallback(async (localUri, filterId) => {
    const tempId  = `optimistic_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const takenAt = new Date().toISOString();

    const optimistic = {
      id:           tempId,
      event_id:     eventId,
      user_id:      userId,
      url:          localUri,      // shown in gallery immediately
      filter_id:    filterId,
      taken_at:     takenAt,
      isOptimistic: true,
    };

    // Immediately visible in UI + persisted in SQLite
    setPhotos(prev => mergeSorted(prev, [optimistic]));
    await savePhoto(optimistic, true);

    // Background upload (caller does NOT await this)
    uploadAndCommit({ tempId, localUri, filterId, takenAt }).catch(async (err) => {
      console.error('[addPhoto] upload failed:', err);
      await deletePhoto(tempId);
      setPhotos(prev => prev.filter(p => p.id !== tempId));
    });
  }, [eventId, userId]);

  const uploadAndCommit = async ({ tempId, localUri, filterId }) => {
    const url       = await uploadToStorage(localUri, eventId, userId);
    const realPhoto = await insertPhoto({ eventId, userId, url, filterId });
    const normalized = { ...realPhoto, isOptimistic: false };

    await resolveOptimistic(tempId, realPhoto);
    setPhotos(prev =>
      prev.map(p => p.id === tempId ? normalized : p)
    );
  };

  return { photos, loading, addPhoto };
}

// ── Helpers ────────────────────────────────────────────────────────

function mergeSorted(...arrays) {
  const all  = arrays.flat();
  const seen = new Set();
  return all
    .filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; })
    .sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at));
}
