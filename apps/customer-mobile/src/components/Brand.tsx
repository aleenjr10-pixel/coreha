import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

export function Brand() {
  return (
    <View style={styles.brandWrap}>
      <View style={styles.brandIcon}>
        <ActivityIndicator size={18} color={colors.onAccent} />
      </View>
      <Text style={styles.brandText}>coreha.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brandWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandText: { fontSize: 26, fontFamily: fonts.bold, color: colors.textStrong, letterSpacing: -0.7 },
});
