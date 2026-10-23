import Share from 'react-native-share';
import * as Sharing from 'expo-sharing';

/**
 * Opens the OS share sheet with the card as an image, so Messenger, iMessage
 * and WhatsApp present it as a photo (tap to expand) rather than a file
 * attachment or link. Falls back to expo-sharing's file share if
 * react-native-share is unavailable or errors for a reason other than the
 * user dismissing the sheet.
 *
 * Returns whether a share surface was presented.
 */
export async function shareImageFile(imageUri: string): Promise<boolean> {
  const url = imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`;
  try {
    await Share.open({
      url,
      type: 'image/png',
      filename: 'pour-across-america-card',
      failOnCancel: false,
    });
    return true;
  } catch (err) {
    console.warn('react-native-share failed, falling back to expo-sharing:', err);
  }

  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(imageUri, { mimeType: 'image/png', UTI: 'public.png' });
  return true;
}
