import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, FileSearch } from 'lucide-react-native';
import { Card, EmptyState, ErrorText, LoadingView, Screen, styles } from '../../components/ui';
import { useRestaurant } from '../../lib/session';
import { requireSupabase } from '../../lib/supabase';
import { colors, formatDate } from '../../lib/theme';
import type { ComparisonReport } from '../../lib/types';
import { useQuery } from '../../lib/useQuery';

export default function ReportsScreen() {
  const restaurant = useRestaurant();

  const reports = useQuery(async () => {
    const { data, error } = await requireSupabase()
      .from('comparison_reports')
      .select('id, summary, recommendation, published_at, supplier_quote_requests!inner(technical_specifications, restaurant_id, supplier_offers(id))')
      .eq('status', 'published')
      .eq('supplier_quote_requests.restaurant_id', restaurant.id)
      .order('published_at', { ascending: false })
      .returns<ComparisonReport[]>();
    if (error) throw error;
    return data;
  }, [restaurant.id]);

  if (reports.loading) return <LoadingView />;

  return (
    <Screen
      eyebrow="SUPPLIER OFFERS"
      title="Offer analysis"
      subtitle="Technical and commercial comparisons prepared by your CoreHa expert."
      refreshing={reports.refreshing}
      onRefresh={reports.refresh}
    >
      <ErrorText message={reports.error} />

      {reports.data && reports.data.length === 0 ? (
        <EmptyState
          icon={<FileSearch size={21} color={colors.green} />}
          title="No analyses yet"
          body="After you request a consultation, we collect supplier offers and publish a clear comparison here."
        />
      ) : null}

      {reports.data?.map((report) => {
        const offerCount = report.supplier_quote_requests?.supplier_offers.length ?? 0;
        return (
          <Pressable
            key={report.id}
            onPress={() => router.push({ pathname: '/report/[id]', params: { id: report.id } })}
            accessibilityRole="button"
          >
            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {report.supplier_quote_requests?.technical_specifications ?? 'Equipment analysis'}
                </Text>
                <ChevronRight size={18} color={colors.textFaint} />
              </View>
              <Text style={styles.itemMeta} numberOfLines={2}>{report.summary}</Text>
              <Text style={styles.itemMeta}>
                {offerCount} {offerCount === 1 ? 'offer' : 'offers'} · Published {formatDate(report.published_at)}
              </Text>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '../../components/ScreenErrorBoundary';
