import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { errorMessage, missingConfigMessage, setPersistAuthSession, supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { isValidCui, normalizeCui } from '../lib/cui';
import { Brand } from '../components/Brand';

export default function SignInScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cui, setCui] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedCui = normalizeCui(cui);
  const canSubmit =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    password.length >= 6 &&
    (!isSignUp || isValidCui(normalizedCui)) &&
    !loading;

  async function handleSubmit() {
    if (!supabase) {
      setError(missingConfigMessage);
      return;
    }

    setLoading(true);
    setError(null);
    setPersistAuthSession(rememberMe);

    try {
      if (!rememberMe) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
          if (signOutError) throw signOutError;
        }
      }

      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { cui: normalizedCui } },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          throw new Error('Email confirmation is still enabled in Supabase. Disable it to finish signing up without a code.');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      }
      // The root layout's guards move the user on once the session updates.
    } catch (err) {
      setError(errorMessage(err, 'Unable to continue. Please check your details.'));
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Brand />

          <Text style={styles.title}>{isSignUp ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.subtitle}>
            {isSignUp ? 'Start with your email, password, and company CUI.' : 'Sign in to your restaurant account.'}
          </Text>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />

            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />

            {isSignUp ? (
              <>
                <Text style={styles.fieldLabel}>COMPANY CUI</Text>
                <TextInput
                  style={styles.input}
                  value={cui}
                  onChangeText={setCui}
                  placeholder="Enter your company CUI"
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <Text style={styles.fieldHint}>This will be saved with your account for company setup.</Text>
              </>
            ) : (
              <Pressable
                style={styles.rememberRow}
                onPress={() => setRememberMe(!rememberMe)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe ? <Check size={13} color="white" strokeWidth={3} /> : null}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.primaryButtonText}>{isSignUp ? 'Create account' : 'Sign in'}</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.modeButton}
              onPress={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              disabled={loading}
            >
              <Text style={styles.modeButtonText}>{isSignUp ? 'Back to sign in' : 'Create account'}</Text>
            </Pressable>
          </View>

          <Text style={styles.footerText}>
            Restaurant operations, equipment maintenance, and supplier comparison in one place.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingTop: 36, paddingBottom: 42 },
  title: { fontSize: 30, fontWeight: '700', color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5ebe5',
    shadowColor: '#1a2b22',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: colors.label, letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBackground,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
  },
  errorText: { marginTop: 14, color: colors.danger, fontSize: 12, lineHeight: 18 },
  fieldHint: { marginTop: 7, color: colors.textFaint, fontSize: 11, lineHeight: 16 },
  rememberRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#aab5ac',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.green, borderColor: colors.green },
  rememberText: { color: '#536258', fontSize: 12 },
  primaryButton: {
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  primaryButtonDisabled: { opacity: 0.65 },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  modeButton: {
    marginTop: 12,
    height: 48,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonText: { color: colors.green, fontWeight: '600', fontSize: 13 },
  footerText: { marginTop: 18, color: colors.textMuted, fontSize: 12, lineHeight: 19, textAlign: 'center' },
});

export { ScreenErrorBoundary as ErrorBoundary } from '../components/ScreenErrorBoundary';
