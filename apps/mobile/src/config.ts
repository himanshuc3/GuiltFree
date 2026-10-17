import { Platform } from 'react-native';

// 10.0.2.2 is how the Android emulator reaches the host machine's localhost.
// For a physical phone, set EXPO_PUBLIC_API_URL to http://<laptop-lan-ip>:3000 (or use `adb reverse`).
const DEFAULT_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_URL;
// EXPO_PUBLIC_* values are bundled into the app, so this is a dev convenience, not a secret.
export const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? 'dev-api-key';
