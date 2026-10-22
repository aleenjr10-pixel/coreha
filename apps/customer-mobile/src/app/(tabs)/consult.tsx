import { useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, CheckCircle2, ImagePlus, Phone, Plus, Trash2, X } from 'lucide-react-native';
import { Select } from '../../components/Select';
import { Badge, Button, Card, Chip, ErrorText, FieldLabel, Input, Screen, SectionTitle, styles } from '../../components/ui';
import { consultCategories, findCategory, findType, supplyLabels } from '../../lib/consultCatalog';
import { photosAvailable, pickPhoto as pickPhotoFrom, readPhotoBytes, type Photo } from '../../lib/photos';
import { useRestaurant } from '../../lib/session';
import { errorMessage, requireSupabase } from '../../lib/supabase';
import { colors, formatDate, fonts } from '../../lib/theme';
import type { ConsultationLead, LeadStatus } from '../../lib/types';
import { useQuery } from '../../lib/useQuery';

const expertPhone = process.env.EXPO_PUBLIC_EXPERT_PHONE ?? '';

const SUCCESS_MESSAGE = 'Cererea ta a fost preluată. Expertul tău te va contacta telefonic cu variantele optime.';

const leadBadge: Record<LeadStatus, { label: string; tone: 'neutral' | 'good' | 'warning' }> = {
  new: { label: 'Preluată', tone: 'warning' },
  contacted: { label: 'Expert în legătură', tone: 'good' },
  quote_requested: { label: 'Colectăm oferte', tone: 'good' },
  closed: { label: 'Închisă', tone: 'neutral' },
};

type DraftItem = {
  key: string;
  categoryId: string | null;
  typeLabel: string | null;
  fuel: 'gas' | 'electric' | null;
  gasNotes: string;
  supply: '220V' | '380V' | null;
  capacity: string;
  photo: Photo | null;
};

let keyCounter = 0;

function newItem(): DraftItem {
  keyCounter += 1;
  return { key: `item-${keyCounter}`, categoryId: null, typeLabel: null, fuel: null, gasNotes: '', supply: null, capacity: '', photo: null };
}

// Electric is implied when the machine has no gas option.
function effectiveFuel(item: DraftItem) {
  const type = findType(item.categoryId, item.typeLabel);
  if (!type) return null;
  if (type.power === 'none') return 'none';
  if (type.power === 'electric') return 'electric';
  return item.fuel;
}

function isComplete(item: DraftItem) {
  const fuel = effectiveFuel(item);
  if (!fuel) return false;
  return fuel !== 'electric' || item.supply !== null;
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ConsultScreen() {
  const restaurant = useRestaurant();

  const [items, setItems] = useState<DraftItem[]>(() => [newItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const leads = useQuery(async () => {
    const { data, error: loadError } = await requireSupabase()
      .from('consultation_leads')
      .select('id, equipment_type, fuel_source, electrical_supply, capacity_requirement, technical_details, status, created_at, consultation_lead_items(count)')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .returns<ConsultationLead[]>();
    if (loadError) throw loadError;
    return data;
  }, [restaurant.id]);

  const canSubmit = items.length > 0 && items.every(isComplete);

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function callExpert() {
    try {
      await Linking.openURL(`tel:${expertPhone.replace(/[^\d+]/g, '')}`);
    } catch {
      setError(`Nu am putut porni apelul. Sună-ne la ${expertPhone}.`);
    }
  }

  async function uploadPhoto(photo: Photo) {
    const extension = photo.mimeType === 'image/png' ? 'png' : 'jpg';
    const path = `${restaurant.id}/${randomId()}.${extension}`;
    const body = await readPhotoBytes(photo);
    const { error: uploadError } = await requireSupabase()
      .storage.from('consultation-photos')
      .upload(path, body, { contentType: photo.mimeType });
    if (uploadError) throw uploadError;
    return path;
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const payload = [];
      for (const item of items) {
        const fuel = effectiveFuel(item);
        payload.push({
          category: findCategory(item.categoryId)?.label,
          equipment_type: item.typeLabel,
          fuel_source: fuel,
          gas_notes: fuel === 'gas' ? item.gasNotes.trim() || null : null,
          electrical_supply: fuel === 'electric' ? item.supply : null,
          capacity_requirement: item.capacity.trim() || null,
          photo_path: item.photo ? await uploadPhoto(item.photo) : null,
        });
      }

      const { error: rpcError } = await requireSupabase().rpc('create_consultation_request', {
        p_restaurant_id: restaurant.id,
        p_items: payload,
      });
      if (rpcError) throw rpcError;

      setItems([newItem()]);
      setSubmitted(true);
      await leads.reload();
    } catch (err) {
      setError(errorMessage(err, 'Nu am putut trimite cererea. Încearcă din nou.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen
          eyebrow="ECHIPAMENTE NOI"
          title="Consultanță expert"
          subtitle={
            expertPhone
              ? 'Vrei să cumperi sau să înlocuiești echipamente? Apasă butonul de telefon pentru a vorbi cu un expert sau trimite-ne o cerere.'
              : 'Vrei să cumperi sau să înlocuiești echipamente? Trimite-ne o cerere și un expert te va contacta.'
          }
          refreshing={leads.refreshing}
          onRefresh={leads.refresh}
        >
          {submitted ? (
            <Card>
              <View style={local.successRow}>
                <CheckCircle2 size={22} color={colors.accent} />
                <Text style={local.successText}>{SUCCESS_MESSAGE}</Text>
              </View>
              <Button label="Trimite o nouă cerere" variant="secondary" onPress={() => setSubmitted(false)} />
            </Card>
          ) : (
            <>
              <SectionTitle>Cerere nouă</SectionTitle>
              {items.map((item, index) => (
                <ItemForm
                  key={item.key}
                  item={item}
                  index={index}
                  canRemove={items.length > 1}
                  disabled={saving}
                  onChange={(patch) => updateItem(item.key, patch)}
                  onRemove={() => setItems((current) => current.filter((other) => other.key !== item.key))}
                  onError={setError}
                />
              ))}

              <Pressable
                style={local.addButton}
                onPress={() => setItems((current) => [...current, newItem()])}
                disabled={saving || items.length >= 20}
                accessibilityRole="button"
                accessibilityLabel="Adaugă alt echipament"
              >
                <View style={local.addIcon}>
                  <Plus size={18} color={colors.onAccent} />
                </View>
                <Text style={local.addText}>Adaugă alt echipament</Text>
              </Pressable>

              <ErrorText message={error} />
              <Button
                label={items.length > 1 ? `Trimite cererea (${items.length} echipamente)` : 'Trimite cererea'}
                onPress={submit}
                disabled={!canSubmit}
                loading={saving}
              />
            </>
          )}

          {leads.data && leads.data.length > 0 ? <SectionTitle>Cererile tale</SectionTitle> : null}
          <ErrorText message={leads.error} />
          {leads.data?.map((lead) => {
            const itemCount = lead.consultation_lead_items?.[0]?.count ?? 0;
            return (
              <Card key={lead.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle} numberOfLines={2}>{lead.equipment_type}</Text>
                  <Badge label={leadBadge[lead.status].label} tone={leadBadge[lead.status].tone} />
                </View>
                <Text style={styles.itemMeta}>
                  {itemCount > 1 ? `${itemCount} echipamente · ` : ''}Trimisă {formatDate(lead.created_at)}
                </Text>
              </Card>
            );
          })}

          {/* Keeps the last card scrollable out from under the call button. */}
          {expertPhone ? <View style={{ height: 72 }} /> : null}
        </Screen>
      </KeyboardAvoidingView>

      {expertPhone ? (
        <Pressable
          style={({ pressed }) => [local.callFab, pressed && { opacity: 0.85 }]}
          onPress={callExpert}
          accessibilityRole="button"
          accessibilityLabel={`Sună un expert CoreHa la ${expertPhone}`}
          hitSlop={8}
        >
          <Phone size={26} color={colors.onAccent} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ItemForm({
  item,
  index,
  canRemove,
  disabled,
  onChange,
  onRemove,
  onError,
}: {
  item: DraftItem;
  index: number;
  canRemove: boolean;
  disabled: boolean;
  onChange: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
  onError: (message: string | null) => void;
}) {
  const category = findCategory(item.categoryId);
  const type = findType(item.categoryId, item.typeLabel);
  const fuel = effectiveFuel(item);

  async function pickPhoto(source: 'camera' | 'library') {
    onError(null);
    try {
      const photo = await pickPhotoFrom(source);
      if (photo) onChange({ photo });
    } catch (err) {
      onError(errorMessage(err, 'Nu am putut încărca poza.'));
    }
  }

  return (
    <Card style={{ marginTop: index === 0 ? 0 : 14 }}>
      <View style={styles.rowBetween}>
        <Text style={local.itemHeading}>Echipament {index + 1}</Text>
        {canRemove ? (
          <Pressable onPress={onRemove} disabled={disabled} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Șterge echipamentul ${index + 1}`}>
            <Trash2 size={18} color={colors.danger} />
          </Pressable>
        ) : null}
      </View>

      <FieldLabel>1. CATEGORIA</FieldLabel>
      <Select
        title="Categoria"
        placeholder="Alege categoria"
        value={item.categoryId}
        options={consultCategories.map((option) => ({ value: option.id, label: option.label }))}
        onChange={(categoryId) => {
          if (categoryId !== item.categoryId) onChange({ categoryId, typeLabel: null, fuel: null, supply: null, gasNotes: '' });
        }}
        disabled={disabled}
      />

      {category ? (
        <>
          <FieldLabel>2. TIPUL EXACT</FieldLabel>
          <Select
            title={category.label}
            placeholder="Alege tipul de utilaj"
            value={item.typeLabel}
            options={category.types.map((option) => ({ value: option.label, label: option.label }))}
            onChange={(typeLabel) => {
              if (typeLabel !== item.typeLabel) onChange({ typeLabel, fuel: null, supply: null, gasNotes: '' });
            }}
            disabled={disabled}
          />
        </>
      ) : null}

      {type && type.power !== 'none' ? (
        <>
          <FieldLabel>3. ALIMENTAREA</FieldLabel>
          {type.power === 'gas_or_electric' ? (
            <View style={styles.chipRow}>
              <Chip label="Gaz" selected={item.fuel === 'gas'} onPress={() => onChange({ fuel: 'gas', supply: null })} />
              <Chip label="Electric" selected={item.fuel === 'electric'} onPress={() => onChange({ fuel: 'electric', gasNotes: '' })} />
            </View>
          ) : null}

          {fuel === 'gas' ? (
            <Input
              style={{ marginTop: 10 }}
              value={item.gasNotes}
              onChangeText={(gasNotes) => onChange({ gasNotes })}
              placeholder="Observații gaz (ex: rețea sau butelie)"
              editable={!disabled}
            />
          ) : null}

          {fuel === 'electric' ? (
            <View style={[styles.chipRow, type.power === 'gas_or_electric' && { marginTop: 10 }]}>
              {(Object.keys(supplyLabels) as (keyof typeof supplyLabels)[]).map((supply) => (
                <Chip key={supply} label={supplyLabels[supply]} selected={item.supply === supply} onPress={() => onChange({ supply })} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {type ? (
        <>
          <FieldLabel>{type.power === 'none' ? '3' : '4'}. DETALII FINALE</FieldLabel>
          <Input
            value={item.capacity}
            onChangeText={(capacity) => onChange({ capacity })}
            placeholder="Specificați volumul/capacitatea dorită"
            editable={!disabled}
          />

          {item.photo ? (
            <View style={local.photoWrap}>
              <Image source={{ uri: item.photo.uri }} style={local.photo} accessibilityLabel="Poza spațiului din bucătărie" />
              <Pressable
                style={local.photoRemove}
                onPress={() => onChange({ photo: null })}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel="Șterge poza"
              >
                <X size={16} color={colors.onAccent} />
              </Pressable>
            </View>
          ) : !photosAvailable() ? (
            <Text style={local.photoHint}>Adăugarea pozelor nu este disponibilă în această versiune a aplicației.</Text>
          ) : (
            <>
              <Text style={local.photoHint}>Opțional: o poză cu spațiul din bucătărie unde va fi pus utilajul.</Text>
              <View style={local.photoButtons}>
                <Pressable style={local.photoButton} onPress={() => pickPhoto('camera')} disabled={disabled} accessibilityRole="button">
                  <Camera size={17} color={colors.accent} />
                  <Text style={local.photoButtonText}>Fă o poză</Text>
                </Pressable>
                <Pressable style={local.photoButton} onPress={() => pickPhoto('library')} disabled={disabled} accessibilityRole="button">
                  <ImagePlus size={17} color={colors.accent} />
                  <Text style={local.photoButtonText}>Din galerie</Text>
                </Pressable>
              </View>
            </>
          )}
        </>
      ) : null}
    </Card>
  );
}

const local = StyleSheet.create({
  callFab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  successRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  successText: { flex: 1, color: colors.accentStrong, fontSize: 15, fontFamily: fonts.semibold, lineHeight: 22 },
  itemHeading: { color: colors.text, fontSize: 15, fontFamily: fonts.bold },
  addButton: {
    marginTop: 14,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  addIcon: {
    width: 28,
    height: 28,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: colors.accent, fontSize: 14, fontFamily: fonts.bold },
  photoHint: { marginTop: 12, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  photoButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  photoButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoButtonText: { color: colors.accent, fontSize: 13, fontFamily: fonts.semibold },
  photoWrap: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  photo: { width: '100%', height: 180, backgroundColor: colors.inputBackground },
  photoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export { ScreenErrorBoundary as ErrorBoundary } from '../../components/ScreenErrorBoundary';
