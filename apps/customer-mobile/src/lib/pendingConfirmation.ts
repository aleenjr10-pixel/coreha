import AsyncStorage from '@react-native-async-storage/async-storage';

// Remembers a sign-up whose email code has not been entered yet, so reopening the app
// goes straight back to the code screen. Storage failures only lose this convenience.
const KEY = 'coreha.pendingConfirmationEmail';

export async function getPendingConfirmation(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function setPendingConfirmation(email: string) {
  try {
    await AsyncStorage.setItem(KEY, email);
  } catch {
    // Ignore: the user can still confirm by signing in again.
  }
}

export async function clearPendingConfirmation() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
