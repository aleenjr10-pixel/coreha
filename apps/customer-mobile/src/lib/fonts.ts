import { useEffect, useState } from 'react';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { loadOptional } from './optionalModule';

type FontModule = typeof import('expo-font');

// Loaded once at startup. Without expo-font, if loading fails, or if it takes longer than
// FONT_TIMEOUT_MS, the app starts anyway with the system font instead of Inter.
const fontModule = loadOptional<FontModule>('expo-font', () => require('expo-font'));

const FONT_TIMEOUT_MS = 3000;

const interFonts = { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold };

// True once the app can render: fonts loaded, failed, unavailable, or too slow.
export function useAppFonts(): boolean {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  // fontModule never changes while the app runs, so the hook order is stable.
  if (!fontModule) return true;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [loaded, error] = fontModule.useFonts(interFonts);
  if (error) console.warn('[fonts] Inter could not be loaded, using the system font', error);
  if (timedOut && !loaded && !error) console.warn('[fonts] Inter is taking too long to load, starting with the system font');
  return loaded || Boolean(error) || timedOut;
}
