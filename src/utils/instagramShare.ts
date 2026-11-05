import { Platform, Linking } from 'react-native';
import Share, { Social } from 'react-native-share';
import * as Sharing from 'expo-sharing';

async function isInstagramAvailable(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    try {
      return await Linking.canOpenURL('instagram-stories://share');
    } catch {
      return false;
    }
  }
  try {
    const result = await Share.isPackageInstalled('com.instagram.android');
    return result?.isInstalled ?? false;
  } catch {
    return false;
  }
}

/**
 * Hands a wine card image directly to Instagram Stories when Instagram is
 * installed, falling back to the generic OS share sheet otherwise — no
 * public web page or link is generated, image-only.
 *
 * Returns whether a share surface was actually presented, so the caller can
 * tell "the user is now sharing" apart from "there was nothing to share
 * through on this device" (e.g. a simulator with no share targets at all).
 */
export async function shareToInstagramStoriesOrFallback(imageUri: string): Promise<boolean> {
  const available = await isInstagramAvailable();

  if (available) {
    try {
      await Share.shareSingle({
        social: Social.InstagramStories,
        backgroundImage: imageUri,
        // Instagram's Stories share sheet expects an app identifier for the
        // "source_application" handoff. We don't use App Links / attribution
        // (no public web page per this pilot's scope), so the bundle id is
        // sufficient — it isn't validated against a registered Facebook app
        // for a plain image handoff with no link-back sticker.
        appId: 'app.replit.pouracrossamerica',
      });
      return true;
    } catch (err) {
      // User cancelling inside Instagram and a genuine failure look the same
      // here — fall through to the generic share sheet either way so the
      // user always has a path to finish sharing.
      console.warn('Instagram Stories share failed, falling back:', err);
    }
  }

  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) return false;
  await Sharing.shareAsync(imageUri, { mimeType: 'image/png', UTI: 'public.png' });
  return true;
}
