import { Alert, Linking } from 'react-native';

/**
 * Open an external link robustly. Linking.openURL silently rejects a URL with no
 * scheme (e.g. "cpwshop.com" or "www.wgfd.wyo.gov") — the button appears to do
 * nothing. We prepend https:// when there's no scheme and surface real failures
 * instead of swallowing them.
 */
export async function openExternalUrl(raw: string | null | undefined): Promise<void> {
  const url = (raw ?? '').trim();
  if (!url) return;
  const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
  try {
    await Linking.openURL(normalized);
  } catch {
    Alert.alert("Couldn't open the link", normalized);
  }
}
