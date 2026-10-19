import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { errorMessage, supabase } from './supabase';
import type { Restaurant } from './types';

type SessionState = {
  // True until the stored session and the user's restaurant have been loaded.
  loading: boolean;
  session: Session | null;
  restaurant: Restaurant | null;
  restaurantError: string | null;
  reloadRestaurant: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

async function fetchRestaurant(userId: string) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('restaurant_members')
    .select('restaurants(id, owner_id, legal_name, cui, city, county, address_line_1)')
    .eq('profile_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ restaurants: Restaurant | null }>();

  if (error) throw error;
  return data?.restaurants ?? null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(!supabase);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  // The user id the current restaurant state belongs to, so a fresh sign-in
  // never briefly renders with the previous (or missing) restaurant.
  const [loadedForUser, setLoadedForUser] = useState<string | null>(null);
  const [restaurantError, setRestaurantError] = useState<string | null>(null);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoaded(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setSessionLoaded(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadRestaurant = useCallback(async (id: string | null, isActive: () => boolean = () => true) => {
    if (!id) {
      setRestaurant(null);
      setRestaurantError(null);
      setLoadedForUser(null);
      return;
    }

    try {
      const next = await fetchRestaurant(id);
      if (!isActive()) return;
      setRestaurant(next);
      setRestaurantError(null);
    } catch (err) {
      if (!isActive()) return;
      setRestaurantError(errorMessage(err, 'Unable to load your restaurant.'));
    } finally {
      if (isActive()) setLoadedForUser(id);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadRestaurant(userId, () => active);
    return () => {
      active = false;
    };
  }, [userId, loadRestaurant]);

  const reloadRestaurant = useCallback(() => loadRestaurant(userId), [userId, loadRestaurant]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return (
    <SessionContext.Provider
      value={{
        loading: !sessionLoaded || (userId !== null && loadedForUser !== userId),
        session,
        restaurant,
        restaurantError,
        reloadRestaurant,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

// Screens behind the onboarding guard can rely on a restaurant being present.
export function useRestaurant() {
  const { restaurant } = useSession();
  if (!restaurant) throw new Error('useRestaurant requires a restaurant');
  return restaurant;
}
