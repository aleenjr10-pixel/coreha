import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, floating } from '../lib/theme';

export function Screen({
  title,
  eyebrow,
  subtitle,
  children,
  refreshing,
  onRefresh,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.screenContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined
        }
      >
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      keyboardAppearance="dark"
      {...props}
      style={[styles.input, props.multiline && styles.inputMultiline, props.style]}
    />
  );
}

export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  icon?: ReactNode;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      style={[styles.button, primary ? styles.buttonPrimary : styles.buttonSecondary, (disabled || loading) && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary ? colors.onAccent : colors.accent} />
      ) : (
        <>
          {icon}
          <Text style={primary ? styles.buttonPrimaryText : styles.buttonSecondaryText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'warning' | 'danger' }) {
  const toneStyle = {
    neutral: { backgroundColor: colors.neutralSoft, color: colors.textMuted },
    good: { backgroundColor: colors.accentSoft, color: colors.accent },
    warning: { backgroundColor: colors.warningSoft, color: colors.warning },
    danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: toneStyle.backgroundColor }]}>
      <Text style={[styles.badgeText, { color: toneStyle.color }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <Card style={styles.empty}>
      <View style={styles.emptyIcon}>{icon}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </Card>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  return message ? <Text style={styles.errorText}>{message}</Text> : null;
}

export function LoadingView() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screenContent: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 42 },
  eyebrow: { color: colors.textFaint, fontSize: 11, fontFamily: fonts.bold, letterSpacing: 1 },
  title: { marginTop: 8, color: colors.text, fontSize: 28, fontFamily: fonts.bold },
  subtitle: { marginTop: 6, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  sectionTitle: { marginTop: 26, marginBottom: 10, color: colors.text, fontSize: 16, fontFamily: fonts.bold },
  card: {
    padding: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    ...floating,
  },
  fieldLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.label, letterSpacing: 1, marginBottom: 8, marginTop: 14 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBackground,
    paddingHorizontal: 14,
    fontFamily: fonts.regular, fontSize: 15,
    color: colors.text,
  },
  inputMultiline: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  buttonPrimary: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonSecondary: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.accentBorder },
  buttonDisabled: { opacity: 0.6 },
  buttonPrimaryText: { color: colors.onAccent, fontSize: 15, fontFamily: fonts.bold },
  buttonSecondaryText: { color: colors.accent, fontSize: 14, fontFamily: fonts.semibold },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.semibold },
  chipTextSelected: { color: colors.onAccent },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontFamily: fonts.bold },
  empty: { alignItems: 'center', paddingVertical: 30 },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: 14, color: colors.text, fontSize: 15, fontFamily: fonts.bold },
  emptyBody: { marginTop: 6, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  errorText: { marginTop: 14, color: colors.danger, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  itemTitle: { color: colors.text, fontSize: 15, fontFamily: fonts.bold, flexShrink: 1 },
  itemMeta: { marginTop: 4, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
});
