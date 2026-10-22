import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AlertTriangle, ClipboardList, Pencil, Sparkles } from 'lucide-react-native';
import { Badge, Button, Card, Chip, EmptyState, ErrorText, LoadingView, Screen, styles } from '../../components/ui';
import {
  compareByDueDate,
  dayLabel,
  dueBadge,
  frequencyLabel,
  nextDays,
  type EquipmentWithAlerts,
  type OpenAlert,
  type Tone,
} from '../../lib/equipment';
import { onAlertReceived } from '../../lib/push';
import { useRestaurant } from '../../lib/session';
import { errorMessage, requireSupabase } from '../../lib/supabase';
import { categoryLabels, colors, formatDate, fonts } from '../../lib/theme';
import { useQuery } from '../../lib/useQuery';

function alertBadge(alert: OpenAlert): { label: string; tone: Tone } {
  if (alert.status === 'scheduled') {
    return { label: alert.scheduled_for ? `Cleaning ${formatDate(alert.scheduled_for)}` : 'Cleaning scheduled', tone: 'good' };
  }
  if (alert.status === 'acknowledged') return { label: 'Confirmed', tone: 'warning' };
  return { label: 'Action needed', tone: 'danger' };
}

export default function EquipmentScreen() {
  const restaurant = useRestaurant();

  const equipment = useQuery(async () => {
    const { data, error } = await requireSupabase()
      .from('equipment_items')
      .select(
        'id, category, label, maintenance_frequency_days, last_service_at, next_due_at, status, notes, alert_events(id, status, alert_message, delivered_at, scheduled_for)',
      )
      .eq('restaurant_id', restaurant.id)
      .neq('status', 'retired')
      .neq('alert_events.status', 'resolved')
      .order('next_due_at', { ascending: true, nullsFirst: false })
      .order('delivered_at', { referencedTable: 'alert_events', ascending: false })
      .returns<EquipmentWithAlerts[]>();
    if (error) throw error;
    return [...data].sort(compareByDueDate);
  }, [restaurant.id]);

  // A new alert arriving while the app is open shows up without pulling to refresh.
  const { reload } = equipment;
  useEffect(() => onAlertReceived(reload), [reload]);

  if (equipment.loading) return <LoadingView />;

  const items = equipment.data ?? [];

  return (
    <Screen
      eyebrow={restaurant.legal_name.toUpperCase()}
      title="Equipment"
      refreshing={equipment.refreshing}
      onRefresh={equipment.refresh}
    >
      <ErrorText message={equipment.error} />

      {equipment.data && items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={21} color={colors.accent} />}
          title="No equipment yet"
          body="Our team adds your equipment after the on-site assessment. It will show up here with its cleaning schedule."
        />
      ) : null}

      {items.map((item) => (
        <EquipmentCard key={item.id} item={item} onChanged={equipment.reload} />
      ))}
    </Screen>
  );
}

function EquipmentCard({ item, onChanged }: { item: EquipmentWithAlerts; onChanged: () => Promise<void> }) {
  const [picking, setPicking] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = nextDays(7);
  const openAlert = item.alert_events[0];
  const badge = openAlert ? alertBadge(openAlert) : dueBadge(item);
  const urgent = openAlert?.status === 'sent' || badge.tone === 'danger';

  async function run(action: () => PromiseLike<{ error: unknown }>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      const { error: actionError } = await action();
      if (actionError) throw actionError;
      setPicking(false);
      setSelectedDay(null);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  function requestCleaning() {
    if (selectedDay === null) return;
    run(
      () =>
        requireSupabase().rpc('request_equipment_service', {
          p_equipment_id: item.id,
          p_scheduled_for: days[selectedDay].toISOString(),
        }),
      'Unable to request cleaning.',
    );
  }

  return (
    <Card style={urgent ? { borderColor: colors.dangerBorder } : undefined}>
      <View style={styles.rowBetween}>
        <View style={local.titleRow}>
          {urgent ? <AlertTriangle size={18} color={colors.danger} /> : null}
          <Text style={styles.itemTitle}>{item.label}</Text>
        </View>
        <Badge label={badge.label} tone={badge.tone} />
      </View>

      {openAlert?.status === 'sent' ? <Text style={local.alertMessage}>{openAlert.alert_message}</Text> : null}

      <Text style={styles.itemMeta}>
        {categoryLabels[item.category]} · {frequencyLabel(item.maintenance_frequency_days)}
      </Text>
      <Text style={styles.itemMeta}>
        Last cleaned {formatDate(item.last_service_at)} · Next due {formatDate(item.next_due_at)}
      </Text>
      {item.notes ? <Text style={[styles.itemMeta, { fontStyle: 'italic' }]}>{item.notes}</Text> : null}

      {picking ? (
        <>
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>PREFERRED CLEANING DAY</Text>
          <View style={styles.chipRow}>
            {days.map((day, index) => (
              <Chip key={day.toISOString()} label={dayLabel(day, index)} selected={selectedDay === index} onPress={() => setSelectedDay(index)} />
            ))}
          </View>
          <Button label="Send request" onPress={requestCleaning} disabled={selectedDay === null} loading={busy} />
          <Button label="Cancel" variant="secondary" onPress={() => setPicking(false)} disabled={busy} />
        </>
      ) : (
        <View style={local.actions}>
          <View style={{ flex: 1 }}>
            <Button
              label={openAlert?.status === 'scheduled' ? 'Change date' : 'Request cleaning'}
              onPress={() => setPicking(true)}
              disabled={busy}
              icon={<Sparkles size={16} color={colors.onAccent} />}
            />
          </View>
          <Pressable
            style={local.iconButton}
            onPress={() => router.push({ pathname: '/equipment/[id]', params: { id: item.id } })}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.label}`}
          >
            <Pencil size={18} color={colors.accent} />
          </Pressable>
        </View>
      )}

      <ErrorText message={error} />
    </Card>
  );
}

const local = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  alertMessage: { marginTop: 10, color: colors.danger, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export { ScreenErrorBoundary as ErrorBoundary } from '../../components/ScreenErrorBoundary';
