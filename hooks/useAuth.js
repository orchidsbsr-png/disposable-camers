import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

/**
 * Returns { user, isLoading }.
 *   user === undefined  → still checking session (show splash)
 *   user === null       → not logged in (show AuthScreen)
 *   user === object     → logged in (show app)
 */
export function useAuth() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    // 1. Load persisted session (AsyncStorage → instant, no network)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // 2. Keep in sync with any auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, isLoading: user === undefined };
}
