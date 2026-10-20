import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ErrorBoundaryProps } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { colors } from '../lib/theme';
import { Button, styles } from './ui';

// Exported as `ErrorBoundary` from each route, so an error in one screen shows this
// message in place of that screen while the tabs and the rest of the app keep working.
export function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.screenContent, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.emptyIcon}>
          <AlertTriangle size={22} color={colors.danger} />
        </View>
        <Text style={[styles.emptyTitle, { textAlign: 'center' }]}>Something went wrong on this screen</Text>
        <Text style={[styles.emptyBody, { maxWidth: 320 }]}>
          The rest of the app still works. Try again, or open another tab.
        </Text>
        {__DEV__ ? <Text style={[styles.itemMeta, { textAlign: 'center', marginTop: 12 }]}>{error.message}</Text> : null}
        <View style={{ alignSelf: 'stretch' }}>
          <Button label="Try again" onPress={retry} />
        </View>
      </View>
    </SafeAreaView>
  );
}
