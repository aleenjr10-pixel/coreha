import type { ImagePickerOptions } from 'expo-image-picker';
import { loadOptional } from './optionalModule';

// Camera, gallery and file reading for consultation photos. When their native modules are
// missing, photo picking is unavailable but the consultation form keeps working.

type ImagePickerModule = typeof import('expo-image-picker');
type FileSystemModule = typeof import('expo-file-system');

export type Photo = { uri: string; mimeType: string };

const imagePicker = () => loadOptional<ImagePickerModule>('expo-image-picker', () => require('expo-image-picker'));
const fileSystem = () => loadOptional<FileSystemModule>('expo-file-system', () => require('expo-file-system'));

export function photosAvailable() {
  return imagePicker() !== null && fileSystem() !== null;
}

// Returns the picked photo, null when the user cancels, or throws a readable error.
export async function pickPhoto(source: 'camera' | 'library'): Promise<Photo | null> {
  const picker = imagePicker();
  if (!picker) throw new Error('Adăugarea pozelor nu este disponibilă în această versiune a aplicației.');

  if (source === 'camera') {
    const permission = await picker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Permite accesul la cameră din setările telefonului pentru a face o poză.');
  }

  const options: ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
  const result = source === 'camera' ? await picker.launchCameraAsync(options) : await picker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  return asset ? { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' } : null;
}

// fetch(uri).arrayBuffer() can return an empty buffer for local files in React Native,
// so the photo is read through expo-file-system.
export async function readPhotoBytes(photo: Photo): Promise<Uint8Array> {
  const fs = fileSystem();
  if (!fs) throw new Error('Poza nu a putut fi citită în această versiune a aplicației.');
  const bytes = await new fs.File(photo.uri).bytes();
  if (bytes.byteLength === 0) throw new Error('Poza nu a putut fi citită. Încearcă să o alegi din nou.');
  return bytes;
}
