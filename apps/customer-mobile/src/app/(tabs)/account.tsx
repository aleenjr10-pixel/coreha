import { useState } from 'react';
import { Text, View } from 'react-native';
import { Building2, LogOut } from 'lucide-react-native';
import { Button, Card, ErrorText, Screen, styles } from '../../components/ui';
import { useRestaurant, useSession } from '../../lib/session';
import { errorMessage } from '../../lib/supabase';
import { colors } from '../../lib/theme';

export default function AccountScreen() {
  const restaurant = useRestaurant();
  const { session, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
