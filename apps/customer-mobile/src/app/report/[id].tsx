import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card, ErrorText, LoadingView, SectionTitle, styles } from '../../components/ui';
import { requireSupabase } from '../../lib/supabase';
import { colors, formatDate, formatMoney } from '../../lib/theme';
import type { ComparisonReport, SupplierOffer } from '../../lib/types';
import { useQuery } from '../../lib/useQuery';

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const report = useQuery(async () => {
    const { data, error } = await requireSupabase()
      .from('comparison_reports')
      .select(
        'id, summary, recommendation, published_at, supplier_quote_requests(technical_specifications, supplier_offers(id, supplier_name, model_name, price, estimated_monthly_kwh, warranty_terms, material_durability, maintenance_cost, advantages, disadvantages))',
      )
      .eq('id', id)
      .eq('status', 'published')
      .single<ComparisonReport>();
    if (error) throw error;
    return data;
  }, [id]);

  if (report.loading) return <LoadingView />;

  const data = report.data;
  const offers = data?.supplier_quote_requests?.supplier_offers ?? [];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.screenContent}>
      <ErrorText message={report.error} />
      {data ? (
        <>
          <Text style={styles.eyebrow}>PUBLISHED {formatDate(data.published_at).toUpperCase()}</Text>
          <Text style={[styles.title, { fontSize: 24 }]}>{data.supplier_quote_requests?.technical_specifications ?? 'Equipment analysis'}</Text>

          <Card>
            <Text style={styles.fieldLabel}>SUMMARY</Text>
            <Text style={local.body}>{data.summary}</Text>
            {data.recommendation ? (
              <>
                <Text style={styles.fieldLabel}>EXPERT RECOMMENDATION</Text>
                <Text style={local.body}>{data.recommendation}</Text>
              </>
            ) : null}
          </Card>

          <SectionTitle>
            {offers.length} supplier {offers.length === 1 ? 'offer' : 'offers'}
          </SectionTitle>
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

function OfferCard({ offer }: { offer: SupplierOffer }) {
  const rows: [string, string][] = [
    ['Price', formatMoney(offer.price)],
    ['Electricity', offer.estimated_monthly_kwh != null ? `${offer.estimated_monthly_kwh} kWh / month` : '—'],
    ['Maintenance cost', formatMoney(offer.maintenance_cost)],
    ['Warranty', offer.warranty_terms ?? '—'],
    ['Build quality', offer.material_durability ?? '—'],
  ];

  return (
    <Card style={{ marginTop: 0, marginBottom: 14 }}>
      <Text style={styles.itemTitle}>{offer.supplier_name}</Text>
      {offer.model_name ? <Text style={styles.itemMeta}>{offer.model_name}</Text> : null}

      <View style={local.table}>
        {rows.map(([label, value]) => (
          <View key={label} style={local.row}>
            <Text style={local.rowLabel}>{label}</Text>
            <Text style={local.rowValue}>{value}</Text>
          </View>
        ))}
      </View>

      {offer.advantages ? (
        <>
          <Text style={[styles.fieldLabel, { color: colors.green }]}>ADVANTAGES</Text>
          <Text style={local.body}>{offer.advantages}</Text>
        </>
      ) : null}
      {offer.disadvantages ? (
        <>
          <Text style={[styles.fieldLabel, { color: colors.danger }]}>DISADVANTAGES</Text>
          <Text style={local.body}>{offer.disadvantages}</Text>
        </>
      ) : null}
    </Card>
  );
}

const local = StyleSheet.create({
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  table: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#edf0ec' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#edf0ec',
  },
  rowLabel: { color: colors.textMuted, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});

export { ScreenErrorBoundary as ErrorBoundary } from '../../components/ScreenErrorBoundary';
