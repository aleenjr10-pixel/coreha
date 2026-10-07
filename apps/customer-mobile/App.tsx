import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Building2, Check, LogOut } from 'lucide-react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
let persistAuthSession = true;

const authStorage = {
  getItem: (key: string) => (persistAuthSession ? AsyncStorage.getItem(key) : Promise.resolve(null)),
  setItem: async (key: string, value: string) => {
    if (persistAuthSession) {
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          storage: authStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

const green = '#286d53';
type AuthScreen = 'signin' | 'signup' | 'home';

export default function App() {
  const [screen, setScreen] = useState<AuthScreen>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cui, setCui] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountCui, setAccountCui] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = screen === 'signup';
  const normalizedCui = cui.trim().toUpperCase().replace(/\s/g, '');
  const validCui = /^(RO)?\d{2,10}$/.test(normalizedCui);
  const canSubmit =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    password.length >= 6 &&
    (!isSignUp || validCui) &&
    !loading;

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;

    function updateAccount(session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) {
      if (!active) {
        return;
      }

      if (!session) {
        setAccountEmail('');
        setAccountCui('');
        setScreen('signin');
        return;
      }

      const sessionCui = session.user.user_metadata?.cui;
      setAccountEmail(session.user.email ?? '');
      setAccountCui(typeof sessionCui === 'string' ? sessionCui : '');
      setScreen('home');
    }

    supabase.auth.getSession().then(({ data }) => updateAccount(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      updateAccount(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit() {
    if (!supabase) {
      setError('Missing Supabase config. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to your environment.');
      return;
    }

    setLoading(true);
    setError(null);
    persistAuthSession = rememberMe;

    try {
      if (!rememberMe) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
          if (signOutError) {
            throw signOutError;
          }
        }
      }

      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { cui: normalizedCui },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.session) {
          const sessionCui = data.user.user_metadata?.cui;
          setAccountEmail(data.user.email ?? email.trim());
          setAccountCui(typeof sessionCui === 'string' ? sessionCui : normalizedCui);
          setScreen('home');
        } else {
          throw new Error('Email confirmation is still enabled in Supabase. Disable it to finish signing up without a code.');
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          throw signInError;
        }

        if (data.session) {
          const sessionCui = data.user.user_metadata?.cui;
          setAccountEmail(data.user.email ?? email.trim());
          setAccountCui(typeof sessionCui === 'string' ? sessionCui : '');
          setScreen('home');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to continue. Please check your details.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      setError('Missing Supabase configuration.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        throw signOutError;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign out.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (screen === 'home') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.homeContainer}>
          <View style={styles.homeHeader}>
            <View style={styles.brandWrap}>
              <View style={styles.brandIcon}>
                <ActivityIndicator size={18} color="white" />
              </View>
              <Text style={styles.brandText}>coreha.</Text>
            </View>
            <Pressable style={styles.signOutButton} onPress={handleSignOut} accessibilityLabel="Sign out">
              <LogOut size={18} color={green} />
            </Pressable>
          </View>

          <Text style={styles.homeEyebrow}>CUSTOMER SPACE</Text>
          <Text style={styles.homeTitle}>Welcome to CoreHa</Text>
          <Text style={styles.homeSubtitle}>Your restaurant account is ready.</Text>

          <View style={styles.homeCard}>
            <View style={styles.homeCardIcon}>
              <Building2 size={21} color={green} />
            </View>
            <Text style={styles.homeCardTitle}>Business profile</Text>
            <Text style={styles.homeFieldLabel}>COMPANY CUI</Text>
            <Text style={styles.homeFieldValue}>{accountCui || 'Not provided'}</Text>
            <View style={styles.homeDivider} />
            <Text style={styles.homeFieldLabel}>ACCOUNT EMAIL</Text>
            <Text style={styles.homeFieldValue}>{accountEmail}</Text>
          </View>

          <View style={styles.setupNotice}>
            <Check size={18} color={green} />
            <Text style={styles.setupNoticeText}>Account created successfully</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brandWrap}>
            <View style={styles.brandIcon}>
              <ActivityIndicator size={18} color="white" />
            </View>
            <Text style={styles.brandText}>coreha.</Text>
          </View>

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
              style={[styles.primaryButton, (!canSubmit || loading) && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || loading}
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
                setScreen(isSignUp ? 'signin' : 'signup');
                setError(null);
              }}
              disabled={loading}
            >
              <Text style={styles.modeButtonText}>
                {isSignUp ? 'Back to sign in' : 'Create account'}
              </Text>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f6f3',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingTop: 36,
    paddingBottom: 42,
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: green,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#243328',
    letterSpacing: -0.7,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#213128',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#67776d',
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#ffffff',
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
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#758177',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dfe6df',
    backgroundColor: '#f9faf9',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#213128',
  },
  errorText: {
    marginTop: 14,
    color: '#a74438',
    fontSize: 12,
    lineHeight: 18,
  },
  fieldHint: {
    marginTop: 7,
    color: '#879188',
    fontSize: 11,
    lineHeight: 16,
  },
  rememberRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#aab5ac',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: green,
    borderColor: green,
  },
  rememberText: {
    color: '#536258',
    fontSize: 12,
  },
  primaryButton: {
    height: 48,
    borderRadius: 10,
    backgroundColor: green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  modeButton: {
    marginTop: 12,
    height: 48,
    borderWidth: 1,
    borderColor: green,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonText: {
    color: green,
    fontWeight: '600',
    fontSize: 13,
  },
  footerText: {
    marginTop: 18,
    color: '#67776d',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },
  homeContainer: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 42,
  },
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  signOutButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8e2',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeEyebrow: {
    color: '#89938b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  homeTitle: {
    marginTop: 8,
    color: '#213128',
    fontSize: 28,
    fontWeight: '700',
  },
  homeSubtitle: {
    marginTop: 6,
    color: '#67776d',
    fontSize: 14,
  },
  homeCard: {
    padding: 18,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#e2e8e1',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  homeCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 7,
    backgroundColor: '#eaf1e7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeCardTitle: {
    marginTop: 14,
    marginBottom: 20,
    color: '#38463c',
    fontSize: 16,
    fontWeight: '700',
  },
  homeFieldLabel: {
    color: '#929c93',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  homeFieldValue: {
    marginTop: 5,
    color: '#46544a',
    fontSize: 13,
  },
  homeDivider: {
    height: 1,
    marginVertical: 16,
    backgroundColor: '#edf0ec',
  },
  setupNotice: {
    minHeight: 54,
    paddingHorizontal: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#dce7d9',
    borderRadius: 7,
    backgroundColor: '#eef4ea',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  setupNoticeText: {
    color: '#365342',
    fontSize: 12,
    fontWeight: '600',
  },
});
