import { loadOptional } from './optionalModule';

type SplashModule = typeof import('expo-splash-screen');

const splash = loadOptional<SplashModule>('expo-splash-screen', () => require('expo-splash-screen'));

// Hides the native splash screen. Safe to call more than once, and a no-op when the
// module is unavailable, so a stuck splash can never hide a running app.
export function hideSplash() {
  if (!splash) return;
  try {
    splash.hide();
  } catch (err) {
    console.warn('[splash] could not hide the splash screen', err);
  }
}
