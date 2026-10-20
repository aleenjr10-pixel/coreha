import { useCallback, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BellRing, Building2, LogOut } from 'lucide-react-native';
import { Badge, Button, Card, ErrorText, Screen, styles } from '../../components/ui';
import { openNotificationSettings, registerForPush, type PushStatus } from '../../lib/push';
import { useRestaurant, useSession } from '../../lib/session';
import { errorMessage } from '../../lib/supabase';
import { colors } from '../../lib/theme';

export default function AccountScreen() {
  const restaurant = useRestaurant();
  const { session, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [enabling, setEnabling] = useState(false);

  // Re-check when the screen opens and when the user returns from the phone settings.
  useFocusEffect(
    useCallback(() => {
      registerForPush(false).then(setPushStatus);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') registerForPush(false).then(setPushStatus);
      });
      return () => subscription.remove();
    }, []),
  );

  async function enablePush() {
    if (pushStatus === 'blocked') {
      await openNotificationSettings();
      return;
    }
    setEnabling(true);
    setPushStatus(await registerForPush(true));
    setEnabling(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
    } catch (err) {
      setError(errorMessage(err, 'Unable to sign out.'));
      setSigningOut(false);
    }
  }

  const fields: [string, string][] = [
    ['COMPANY', restaurant.legal_name],
    ['COMPANY CUI', restaurant.cui ?? 'Not provided'],
    ['LOCATION', [restaurant.address_line_1, restaurant.city].filter(Boolean).join(', ') || 'Not provided'],
    ['ACCOUNT EMAIL', session?.user.email ?? ''],
  ];

  return (
    <Screen eyebrow="CUSTOMER SPACE" title="Account">
      <Card style={{ marginTop: 24 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: colors.greenSoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 6,
          }}
        >
          <Building2 size={21} color={colors.green} />
        </View>
        {fields.map(([label, value], index) => (
          <View key={label} style={index > 0 ? { borderTopWidth: 1, borderTopColor: '#edf0ec', marginTop: 14 } : undefined}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <Text style={{ color: '#46544a', fontSize: 14 }}>{value}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
            <BellRing size={20} color={colors.green} />
            <Text style={styles.itemTitle}>Maintenance alerts</Text>
          </View>
          {pushStatus ? <Badge label={pushCopy[pushStatus].badge} tone={pushCopy[pushStatus].tone} /> : null}
        </View>
        <Text style={styles.itemMeta}>{pushStatus ? pushCopy[pushStatus].body : 'Checking…'}</Text>
        {pushStatus === 'denied' || pushStatus === 'blocked' || pushStatus === 'error' ? (
          <Button
            label={pushStatus === 'blocked' ? 'Open phone settings' : pushStatus === 'error' ? 'Try again' : 'Turn on alerts'}
            onPress={enablePush}
            loading={enabling}
          />
        ) : null}
      </Card>

      <ErrorText message={error} />
      <Button
        label="Sign out"
        variant="secondary"
        onPress={handleSignOut}
        loading={signingOut}
        icon={<LogOut size={16} color={colors.green} />}
      />
    </Screen>
  );
}

const pushCopy: Record<PushStatus, { badge: string; tone: 'good' | 'warning' | 'danger' | 'neutral'; body: string }> = {
  enabled: { badge: 'On', tone: 'good', body: 'This phone receives critical alerts when equipment needs maintenance.' },
  denied: { badge: 'Off', tone: 'danger', body: 'Turn on notifications so you never miss a maintenance alert.' },
  blocked: { badge: 'Off', tone: 'danger', body: 'Notifications are turned off for CoreHa. Turn them on in the phone settings.' },
  unsupported: { badge: 'Not available', tone: 'neutral', body: 'Alerts need the installed CoreHa app. They do not work in Expo Go or on the web.' },
  'not-configured': { badge: 'Not set up', tone: 'warning', body: 'This build is not connected to the push service yet.' },
  error: { badge: 'Error', tone: 'warning', body: 'We could not register this phone for alerts.' },
};

export { ScreenErrorBoundary as ErrorBoundary } from '../../components/ScreenErrorBoundary';
