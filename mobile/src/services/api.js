import * as SecureStore from 'expo-secure-store';
import { createApiClient } from '../../../shared/apiClient.js';
import { API_URL } from '../config';

// Tokens live in the OS keystore (Android Keystore / iOS Keychain), never in plain storage.
const opt = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }; // readable after a phone restart, so the session survives
const storage = { get: (k) => SecureStore.getItemAsync(k, opt), set: (k, v) => SecureStore.setItemAsync(k, v, opt), del: (k) => SecureStore.deleteItemAsync(k, opt) };
export const api = createApiClient({ baseUrl: API_URL, storage });
