import { useEffect, useRef } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button, LoadingView, styles } from '../components/ui';
import { onAlertOpened, registerForPush } from '../lib/push';
import { SessionProvider, useSession } from '../lib/session';
import { colors } from '../lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { loading, session, restaurant, restaurantError, reloadRestaurant, signOut } = useSession();

  if (loading) {
    return <LoadingView />;
  }

  // Don't send an existing customer to onboarding just because the lookup failed.
  if (session && !restaurant && restaurantError) {
    return (
      <View style={[styles.loading, { paddingHorizontal: 22 }]}>
        <Text style={styles.itemTitle}>We couldn't load your restaurant</Text>
        <Text style={[styles.itemMeta, { textAlign: 'center' }]}>{restaurantError}</Text>
        <Button label="Try again" onPress={reloadRestaurant} />
        <Button label="Sign out" variant="secondary" onPress={() => signOut().catch(() => {})} />
      </View>
    );
  }

  return (
    <>
      {session && restaurant ? <PushSetup userId={session.user.id} /> : null}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          headerTintColor: colors.green,
          headerTitleStyle: { color: colors.text },
        }}
      >
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>

        <Stack.Protected guard={!!session && !restaurant}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        <Stack.Protected guard={!!session && !!restaurant}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="equipment/[id]" options={{ headerShown: true, title: 'Edit equipment' }} />
          <Stack.Screen name="report/[id]" options={{ headerShown: true, title: 'Offer analysis' }} />
        </Stack.Protected>
      </Stack>
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
