import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Chip, ErrorText, FieldLabel, Input, LoadingView, styles } from '../../components/ui';
import { frequencyLabel, frequencyPresets } from '../../lib/equipment';
import { errorMessage, requireSupabase } from '../../lib/supabase';
import { categoryLabels, colors, formatDate } from '../../lib/theme';
import type { EquipmentCategory, EquipmentItem } from '../../lib/types';
import { useQuery } from '../../lib/useQuery';

const categories = Object.keys(categoryLabels) as EquipmentCategory[];

export default function EditEquipmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const item = useQuery(async () => {
    const { data, error } = await requireSupabase()
      .from('equipment_items')
      .select('id, category, label, maintenance_frequency_days, last_service_at, next_due_at, status, notes')
      .eq('id', id)
      .single<EquipmentItem>();
    if (error) throw error;
    return data;
  }, [id]);

  if (item.loading) return <LoadingView />;
  if (!item.data) {
    return (
      <View style={[styles.screenContent, { backgroundColor: colors.background, flex: 1 }]}>
        <ErrorText message={item.error ?? 'Equipment not found.'} />
      </View>
    );
  }

  return <EditForm item={item.data} />;
}

function EditForm({ item }: { item: EquipmentItem }) {
  const [label, setLabel] = useState(item.label);
  const [category, setCategory] = useState<EquipmentCategory>(item.category);
  const [frequency, setFrequency] = useState(String(item.maintenance_frequency_days));
  const originalLastCleaned = item.last_service_at ? item.last_service_at.slice(0, 10) : '';
  const [lastCleaned, setLastCleaned] = useState(originalLastCleaned);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frequencyDays = Number.parseInt(frequency, 10);
  const validFrequency = Number.isInteger(frequencyDays) && frequencyDays >= 1 && frequencyDays <= 730;
  // Only a date the user changed is sent, so saving other fields keeps the current schedule.
  const lastCleanedChanged = lastCleaned !== originalLastCleaned;
  const lastCleanedDate = lastCleaned && lastCleanedChanged ? new Date(`${lastCleaned}T09:00:00`) : null;
  const validLastCleaned =
    !lastCleanedChanged || !lastCleaned || (/^\d{4}-\d{2}-\d{2}$/.test(lastCleaned) && !Number.isNaN(lastCleanedDate?.getTime()) && lastCleanedDate! <= new Date());
  const canSave = label.trim().length >= 2 && validFrequency && validLastCleaned;

  const previewNextDue =
    validLastCleaned && validFrequency && (lastCleanedDate || (item.last_service_at && frequencyDays !== item.maintenance_frequency_days))
      ? new Date((lastCleanedDate ?? new Date(item.last_service_at!)).getTime() + frequencyDays * 24 * 60 * 60 * 1000).toISOString()
      : item.next_due_at;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await requireSupabase()
        .from('equipment_items')
        .update({
          label: label.trim(),
          category,
          maintenance_frequency_days: frequencyDays,
          last_service_at: lastCleanedDate ? lastCleanedDate.toISOString() : item.last_service_at,
          notes: notes.trim() || null,
        })
        .eq('id', item.id);
      if (updateError) throw updateError;
      router.back();
    } catch (err) {
      setError(errorMessage(err, 'Unable to save changes.'));
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
        <Card style={{ marginTop: 0 }}>
          <FieldLabel>NAME</FieldLabel>
          <Input value={label} onChangeText={setLabel} placeholder="e.g. Walk-in fridge, kitchen" />

          <FieldLabel>CATEGORY</FieldLabel>
          <View style={styles.chipRow}>
            {categories.map((value) => (
              <Chip key={value} label={categoryLabels[value]} selected={category === value} onPress={() => setCategory(value)} />
            ))}
          </View>

          <FieldLabel>CLEANING FREQUENCY</FieldLabel>
          <View style={styles.chipRow}>
            {frequencyPresets.map((days) => (
              <Chip key={days} label={frequencyLabel(days)} selected={frequencyDays === days} onPress={() => setFrequency(String(days))} />
            ))}
          </View>
          <Input
            style={{ marginTop: 10 }}
            value={frequency}
            onChangeText={(value) => setFrequency(value.replace(/\D/g, ''))}
            placeholder="Days between cleanings"
            keyboardType="number-pad"
          />
          {!validFrequency ? <Text style={styles.errorText}>Enter a number of days between 1 and 730.</Text> : null}

          <FieldLabel>LAST CLEANED (YYYY-MM-DD)</FieldLabel>
          <Input value={lastCleaned} onChangeText={setLastCleaned} placeholder="2026-10-01" autoCorrect={false} keyboardType="numbers-and-punctuation" />
          {!validLastCleaned ? <Text style={styles.errorText}>Use the format YYYY-MM-DD, not in the future.</Text> : null}
          <Text style={styles.itemMeta}>Next cleaning due: {formatDate(previewNextDue)}</Text>

          <FieldLabel>NOTES</FieldLabel>
          <Input value={notes} onChangeText={setNotes} placeholder="Location, model, anything useful" multiline />

          <ErrorText message={error} />
          <Button label="Save changes" onPress={save} disabled={!canSave} loading={saving} />
          <Button label="Cancel" variant="secondary" onPress={() => router.back()} disabled={saving} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '../../components/ScreenErrorBoundary';
