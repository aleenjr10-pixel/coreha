const cache = new Map<string, unknown>();

// Loads a module backed by native code. When the installed app does not contain its
// native side (Expo Go, or a build made before the module was added), it returns null
// instead of throwing, so only the feature that needs it is unavailable.
export function loadOptional<T>(name: string, load: () => T): T | null {
  if (cache.has(name)) return cache.get(name) as T | null;

  let value: T | null = null;
  try {
    value = load();
  } catch (err) {
    console.warn(`[${name}] unavailable in this build:`, err instanceof Error ? err.message : err);
  }
  cache.set(name, value);
  return value;
}
