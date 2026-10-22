import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MailCheck } from 'lucide-react-native';
import { Brand } from '../components/Brand';
import { Button, Card, ErrorText, FieldLabel, Input } from '../components/ui';
import { isValidCui, normalizeCui } from '../lib/cui';
import { clearPendingConfirmation, getPendingConfirmation, setPendingConfirmation } from '../lib/pendingConfirmation';
import { errorMessage, missingConfigMessage, supabase } from '../lib/supabase';
import { colors, fonts } from '../lib/theme';

// signin → signup → confirm (code from the welcome email)
// signin → forgot (send code) → reset (code + new password)
type Mode = 'signin' | 'signup' | 'confirm' | 'forgot' | 'reset';

const RESEND_SECONDS = 60;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const copy: Record<Mode, { title: string; subtitle: string }> = {
  signin: { title: 'Welcome back', subtitle: 'Sign in to your restaurant account.' },
  signup: { title: 'Create your account', subtitle: 'Start with your email, password, and company CUI.' },
  confirm: { title: 'Confirm your email', subtitle: 'We sent a welcome email with a confirmation code.' },
  forgot: { title: 'Reset your password', subtitle: 'Enter your account email and we will send you a code.' },
  reset: { title: 'Choose a new password', subtitle: 'Enter the code from the email and your new password.' },
};

// Supabase errors in words a restaurant manager understands.
function friendlyError(err: unknown, fallback: string) {
  const message = errorMessage(err, fallback);
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.';
  if (/token has expired|otp.*(expired|invalid)|invalid.*token/i.test(message)) return 'The code is wrong or has expired. Request a new one.';
  if (/already registered|already been registered/i.test(message)) return 'An account with this email already exists. Sign in instead.';
  if (/rate limit|security purposes|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  if (/should be different/i.test(message)) return 'Choose a password different from the old one.';
  return message;
}

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordAgain, setNewPasswordAgain] = useState('');
  const [cui, setCui] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  // Reopening the app after leaving the code screen goes straight back to it.
  useEffect(() => {
    let active = true;
    getPendingConfirmation().then((pending) => {
      if (!active || !pending) return;
      setEmail(pending);
      setMode('confirm');
      setNotice(`Finish creating your account: enter the code we sent to ${pending}. If it expired, send a new one.`);
    });
    return () => {
      active = false;
    };
  }, []);

  // Ticks only while a resend countdown is running.
  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const trimmedEmail = email.trim();
  const normalizedCui = normalizeCui(cui);
  const validEmail = emailPattern.test(trimmedEmail);
  const validCode = /^\d{6,10}$/.test(code.trim());

  const canSubmit = !loading && {
    signin: validEmail && password.length >= 6,
    signup: validEmail && password.length >= 6 && isValidCui(normalizedCui),
    confirm: validCode,
    forgot: validEmail,
    reset: validCode && newPassword.length >= 6 && newPassword === newPasswordAgain,
  }[mode];

  function go(next: Mode, message: string | null = null) {
    // Leaving the code screen on purpose forgets the unfinished sign-up.
    if (mode === 'confirm' && next !== 'confirm') clearPendingConfirmation();
    setMode(next);
    setError(null);
    setNotice(message);
    setCode('');
  }

  function startCooldown() {
    setResendAt(Date.now() + RESEND_SECONDS * 1000);
    setNow(Date.now());
  }

  async function run(action: () => Promise<void>, fallback: string) {
    if (!supabase) {
      setError(missingConfigMessage);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(friendlyError(err, fallback));
    } finally {
      setLoading(false);
    }
  }

  const auth = () => supabase!.auth;

  function signIn() {
    return run(async () => {
      const { error: signInError } = await auth().signInWithPassword({ email: trimmedEmail, password });
      if (signInError) {
        // Accounts created but never confirmed go straight to the code step.
        if (/email not confirmed/i.test(signInError.message)) {
          await auth().resend({ type: 'signup', email: trimmedEmail });
          await setPendingConfirmation(trimmedEmail);
          startCooldown();
          go('confirm', `Your email is not confirmed yet. We sent a new code to ${trimmedEmail}.`);
          return;
        }
        throw signInError;
      }
      // The root layout's guards move the user on once the session updates.
    }, 'Unable to sign in.');
  }

  function signUp() {
    return run(async () => {
      const { data, error: signUpError } = await auth().signUp({
        email: trimmedEmail,
        password,
        options: { data: { cui: normalizedCui } },
      });
      if (signUpError) throw signUpError;
      // Without email confirmation Supabase signs the user in right away.
      if (data.session) return;
      await setPendingConfirmation(trimmedEmail);
      startCooldown();
      go('confirm', `We sent a welcome email to ${trimmedEmail}. Enter the code from it below.`);
    }, 'Unable to create the account.');
  }

  function confirm() {
    return run(async () => {
      const { error: verifyError } = await auth().verifyOtp({ email: trimmedEmail, token: code.trim(), type: 'signup' });
      if (verifyError) throw verifyError;
      // Confirmed and signed in: the root layout takes the user into the app.
      await clearPendingConfirmation();
    }, 'Unable to confirm the email.');
  }

  function resendConfirmation() {
    return run(async () => {
      const { error: resendError } = await auth().resend({ type: 'signup', email: trimmedEmail });
      if (resendError) throw resendError;
      startCooldown();
      setNotice(`We sent a new code to ${trimmedEmail}.`);
    }, 'Unable to send a new code.');
  }

  function sendResetCode() {
    return run(async () => {
      const { error: resetError } = await auth().resetPasswordForEmail(trimmedEmail);
      if (resetError) throw resetError;
      startCooldown();
      // Same message whether or not the account exists, so emails can't be probed.
      go('reset', `If ${trimmedEmail} has an account, we sent it a code.`);
    }, 'Unable to send the code.');
  }

  function resetPassword() {
    return run(async () => {
      const { error: verifyError } = await auth().verifyOtp({ email: trimmedEmail, token: code.trim(), type: 'recovery' });
      if (verifyError) throw verifyError;
      // The code signed the user in; the screen may close before this finishes, so a
      // failure here is shown as an alert rather than inline.
      const { error: updateError } = await auth().updateUser({ password: newPassword });
      if (updateError) {
        Alert.alert('Password not changed', friendlyError(updateError, 'Unable to save the new password.'));
      }
    }, 'Unable to reset the password.');
  }

  const submit = { signin: signIn, signup: signUp, confirm, forgot: sendResetCode, reset: resetPassword }[mode];
  const submitLabel = {
    signin: 'Sign in',
    signup: 'Create account',
    confirm: 'Confirm email',
    forgot: 'Send code',
    reset: 'Save new password',
  }[mode];

  const codeField = (
    <>
      <FieldLabel>CODE FROM THE EMAIL</FieldLabel>
      <Input
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
        placeholder="123456"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={10}
        style={styles.codeInput}
      />
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Brand />

          <Text style={styles.title}>{copy[mode].title}</Text>
          <Text style={styles.subtitle}>{copy[mode].subtitle}</Text>

          <Card style={{ marginTop: 0 }}>
            {notice ? (
              <View style={styles.notice}>
                <MailCheck size={18} color={colors.accentStrong} />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            {mode === 'signin' || mode === 'signup' || mode === 'forgot' ? (
              <>
                <FieldLabel>EMAIL</FieldLabel>
                <Input
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  autoCorrect={false}
                />
              </>
            ) : null}

            {mode === 'signin' || mode === 'signup' ? (
              <>
                <View style={styles.labelRow}>
                  <FieldLabel>PASSWORD</FieldLabel>
                  {mode === 'signin' ? (
                    <Pressable onPress={() => go('forgot')} hitSlop={8} accessibilityRole="button">
                      <Text style={styles.link}>Forgot password?</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                  secureTextEntry
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </>
            ) : null}

            {mode === 'signup' ? (
              <>
                <FieldLabel>COMPANY CUI</FieldLabel>
                <Input value={cui} onChangeText={setCui} placeholder="Enter your company CUI" autoCapitalize="characters" autoCorrect={false} />
                <Text style={styles.fieldHint}>This will be saved with your account for company setup.</Text>
              </>
            ) : null}


            {mode === 'confirm' ? (
              <Text style={styles.confirmEmail}>
                Code sent to <Text style={styles.confirmEmailValue}>{trimmedEmail}</Text>
              </Text>
            ) : null}

            {mode === 'confirm' || mode === 'reset' ? codeField : null}

            {mode === 'reset' ? (
              <>
                <FieldLabel>NEW PASSWORD</FieldLabel>
                <Input value={newPassword} onChangeText={setNewPassword} placeholder="At least 6 characters" secureTextEntry autoComplete="new-password" />
                <FieldLabel>NEW PASSWORD AGAIN</FieldLabel>
                <Input value={newPasswordAgain} onChangeText={setNewPasswordAgain} placeholder="Repeat the new password" secureTextEntry autoComplete="new-password" />
                {newPasswordAgain.length > 0 && newPassword !== newPasswordAgain ? (
                  <Text style={styles.fieldHint}>The two passwords don't match yet.</Text>
                ) : null}
              </>
            ) : null}

            <ErrorText message={error} />
            <Button label={submitLabel} onPress={submit} disabled={!canSubmit} loading={loading} />

            {mode === 'confirm' || mode === 'reset' ? (
              <Button
                label={resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
                variant="secondary"
                onPress={mode === 'confirm' ? resendConfirmation : sendResetCode}
                disabled={loading || resendIn > 0}
              />
            ) : null}

            {mode === 'signin' ? (
              <Button label="Create account" variant="secondary" onPress={() => go('signup')} disabled={loading} />
            ) : (
              <Button
                label={mode === 'confirm' ? 'Use another account' : 'Back to sign in'}
                variant="secondary"
                onPress={() => go('signin')}
                disabled={loading}
              />
            )}
          </Card>

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
  title: { fontSize: 30, fontFamily: fonts.bold, color: colors.text, marginBottom: 6 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, marginBottom: 18 },
  labelRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  link: { color: colors.accent, fontFamily: fonts.semibold, fontSize: 12, marginBottom: 8 },
  codeInput: { fontFamily: fonts.semibold, fontSize: 22, letterSpacing: 6, textAlign: 'center' },
  confirmEmail: { marginTop: 10, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  confirmEmailValue: { color: colors.text, fontFamily: fonts.semibold },
  fieldHint: { marginTop: 7, color: colors.textFaint, fontFamily: fonts.regular, fontSize: 11, lineHeight: 16 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  noticeText: { flex: 1, color: colors.body, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  footerText: { marginTop: 18, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 19, textAlign: 'center' },
});

export { ScreenErrorBoundary as ErrorBoundary } from '../components/ScreenErrorBoundary';
