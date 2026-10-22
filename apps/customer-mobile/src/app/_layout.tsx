import { useEffect, useRef } from 'react';
import { hideSplash } from '../lib/splash';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button, LoadingView, styles } from '../components/ui';
import { useAppFonts } from '../lib/fonts';
import { onAlertOpened, registerForPush } from '../lib/push';
import { SessionProvider, useSession } from '../lib/session';
import { colors, fonts } from '../lib/theme';

export default function RootLayout() {
  const fontsReady = useAppFonts();

  // Our own loading screen is on screen from the first render, so the native splash can go.
  useEffect(() => {
    hideSplash();
  }, []);

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <RootNavigator fontsReady={fontsReady} />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

// The navigator stays mounted for the whole life of the app. Unmounting and remounting it
// (for example while the restaurant loads after signing in) can leave a blank screen on
// Android, so loading and errors are drawn on top of it instead.
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { loading, session, restaurant, restaurantError, reloadRestaurant, signOut } = useSession();

  // While a sign-in is still resolving, keep showing the screens of the last settled state,
  // so the user never sees onboarding flash before their restaurant arrives.
  const settled = useRef({ signedIn: false, hasRestaurant: false });
  if (!loading) settled.current = { signedIn: Boolean(session), hasRestaurant: Boolean(restaurant) };
  const { signedIn, hasRestaurant } = settled.current;

  // Don't send an existing customer to onboarding just because the lookup failed.
  const restaurantFailed = Boolean(session && !restaurant && restaurantError && !loading);
  const busy = !fontsReady || loading;

  return (
    <>
      {session && restaurant ? <PushSetup userId={session.user.id} /> : null}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.text, fontFamily: fonts.semibold },
        }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && !hasRestaurant}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && hasRestaurant}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="equipment/[id]" options={{ headerShown: true, title: 'Edit equipment' }} />
          <Stack.Screen name="report/[id]" options={{ headerShown: true, title: 'Offer analysis' }} />
        </Stack.Protected>
      </Stack>

      {busy ? (
        <View style={StyleSheet.absoluteFill}>
          <LoadingView />
        </View>
      ) : restaurantFailed ? (
        <View style={[StyleSheet.absoluteFill, styles.loading, { paddingHorizontal: 22 }]}>
          <Text style={styles.itemTitle}>We couldn't load your restaurant</Text>
          <Text style={[styles.itemMeta, { textAlign: 'center' }]}>{restaurantError}</Text>
          <Button label="Try again" onPress={reloadRestaurant} />
          <Button label="Sign out" variant="secondary" onPress={() => signOut().catch(() => {})} />
        </View>
      ) : null}
    </>
  );
}

// Registers this phone for maintenance alerts once per signed-in user, and opens the
// equipment list when an alert notification is tapped (also when it launched the app).
// Push is optional: if it is unavailable in this build, these effects do nothing.
function PushSetup({ userId }: { userId: string }) {
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (registeredFor.current === userId) return;
    registeredFor.current = userId;
    registerForPush(true);
  }, [userId]);

  useEffect(() => onAlertOpened(() => router.navigate('/')), []);

  return null;
}

export { ScreenErrorBoundary as ErrorBoundary } from '../components/ScreenErrorBoundary';
