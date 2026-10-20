import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Brand } from '../components/Brand';
import { Button, Card, ErrorText, FieldLabel, Input, Screen } from '../components/ui';
import { isValidCui, normalizeCui } from '../lib/cui';
import { useSession } from '../lib/session';
import { errorMessage, requireSupabase } from '../lib/supabase';

export default function OnboardingScreen() {
  const { session, reloadRestaurant, signOut } = useSession();
  const metadataCui = session?.user.user_metadata?.cui;

  const [legalName, setLegalName] = useState('');
  const [cui, setCui] = useState(typeof metadataCui === 'string' ? metadataCui : '');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedCui = normalizeCui(cui);
  const canSubmit = legalName.trim().length >= 2 && isValidCui(normalizedCui) && city.trim().length >= 2;

  async function handleSubmit() {
    if (!session) return;
    setSaving(true);
    setError(null);

    try {
      const { error: insertError } = await requireSupabase().from('restaurants').insert({
        owner_id: session.user.id,
        legal_name: legalName.trim(),
        cui: normalizedCui,
        city: city.trim(),
        address_line_1: address.trim() || null,
      });
      if (insertError) throw insertError;
      // Once the restaurant is loaded, the root layout opens the main tabs.
      await reloadRestaurant();
    } catch (err) {
      setError(errorMessage(err, 'Unable to save your restaurant.'));
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        eyebrow="STEP 1 OF 1"
        title="Your restaurant"
        subtitle="Tell us which restaurant this account manages. Our team uses it to set up your equipment inventory after the on-site assessment."
      >
        <Card>
          <Brand />
          <FieldLabel>COMPANY LEGAL NAME</FieldLabel>
          <Input value={legalName} onChangeText={setLegalName} placeholder="e.g. Bistro Central SRL" />

          <FieldLabel>COMPANY CUI</FieldLabel>
          <Input value={cui} onChangeText={setCui} placeholder="RO12345678" autoCapitalize="characters" autoCorrect={false} />

          <FieldLabel>CITY</FieldLabel>
          <Input value={city} onChangeText={setCity} placeholder="e.g. Cluj-Napoca" />

          <FieldLabel>ADDRESS (OPTIONAL)</FieldLabel>
          <Input value={address} onChangeText={setAddress} placeholder="Street and number" />

          <ErrorText message={error} />
          <Button label="Continue" onPress={handleSubmit} disabled={!canSubmit} loading={saving} />
          <Button
            label="Sign out"
            variant="secondary"
            onPress={() => signOut().catch((err) => setError(errorMessage(err, 'Unable to sign out.')))}
            disabled={saving}
          />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '../components/ScreenErrorBoundary';
