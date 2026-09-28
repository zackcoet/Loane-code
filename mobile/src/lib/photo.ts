/**
 * Picking, shrinking and uploading a profile photo.
 *
 * Phones take enormous photos. A modern iPhone shot is several megabytes,
 * and uploading that to show an 80pt avatar wastes her data, her battery
 * and our storage bill. So every image is resized and re-compressed on the
 * device before a single byte leaves it — the Storage rules' 8 MB cap is a
 * backstop, not the normal path.
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storagePaths, type ImageRef } from '@loane/shared';
import { storage } from '../firebase/config';

/** Profile photos are shown at most at ~200pt, so 800px is generous. */
const PROFILE_MAX_EDGE = 800;
/** Listing photos fill the screen in a carousel, so they need more. */
const LISTING_MAX_EDGE = 1600;
const QUALITY = 0.7;

export type PhotoSource = 'camera' | 'library';

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

/**
 * Opens the camera or the photo library.
 * Returns null when she cancels or declines permission.
 */
export async function pickPhoto(
  source: PhotoSource,
  /** Square crop for avatars; free crop for garments. */
  shape: 'square' | 'free' = 'square',
): Promise<PickedPhoto | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) return null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    ...(shape === 'square' ? { aspect: [1, 1] as [number, number] } : {}),
    quality: 1,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0]!;
  return {
    uri: asset.uri,
    width: asset.width ?? LISTING_MAX_EDGE,
    height: asset.height ?? LISTING_MAX_EDGE,
  };
}

/** Resizes the long edge down and re-compresses as JPEG. */
export async function compressPhoto(
  photo: PickedPhoto,
  maxEdge: number = PROFILE_MAX_EDGE,
): Promise<PickedPhoto> {
  const longEdge = Math.max(photo.width, photo.height);
  if (longEdge <= maxEdge) return photo;

  const resize = photo.width >= photo.height ? { width: maxEdge } : { height: maxEdge };

  const result = await ImageManipulator.manipulateAsync(photo.uri, [{ resize }], {
    compress: QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return { uri: result.uri, width: result.width, height: result.height };
}

/**
 * Uploads to `users/{uid}/profile/…` and returns the public URL.
 *
 * The path carries her uid, and the Storage rules check that it matches the
 * signed-in user — which is what stops anyone writing into someone else's
 * folder.
 */
export async function uploadProfilePhoto(uid: string, photo: PickedPhoto): Promise<string> {
  const compressed = await compressPhoto(photo, PROFILE_MAX_EDGE);

  // React Native has no File object; fetching the local uri gives a Blob.
  const response = await fetch(compressed.uri);
  const blob = await response.blob();

  // A fresh name each time, so a changed photo is never served from cache.
  const fileName = `avatar-${Date.now()}.jpg`;
  const target = ref(storage, storagePaths.profilePhoto(uid, fileName));

  await uploadBytes(target, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(target);
}

/**
 * Uploads one post photo and returns the stored reference.
 *
 * Same treatment as a listing photo — a look fills the feed, so it needs
 * the resolution.
 */
export async function uploadPostPhoto(
  uid: string,
  postDraftId: string,
  photo: PickedPhoto,
  index: number,
): Promise<ImageRef> {
  const compressed = await compressPhoto(photo, LISTING_MAX_EDGE);

  const response = await fetch(compressed.uri);
  const blob = await response.blob();

  const fileName = `${index}-${Date.now()}.jpg`;
  const path = storagePaths.postPhoto(uid, postDraftId, fileName);
  const target = ref(storage, path);

  await uploadBytes(target, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(target);

  return { path, url, width: compressed.width, height: compressed.height };
}

/**
 * Uploads one garment photo and returns the stored reference.
 *
 * Listing photos are the product — they fill a carousel — so they are
 * resized to 1600px rather than 800, and still land far under the Storage
 * rules' 8 MB cap.
 */
export async function uploadListingPhoto(
  uid: string,
  listingId: string,
  photo: PickedPhoto,
  index: number,
): Promise<ImageRef> {
  const compressed = await compressPhoto(photo, LISTING_MAX_EDGE);

  const response = await fetch(compressed.uri);
  const blob = await response.blob();

  const fileName = `${index}-${Date.now()}.jpg`;
  const path = storagePaths.listingPhoto(uid, listingId, fileName);
  const target = ref(storage, path);

  await uploadBytes(target, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(target);

  return { path, url, width: compressed.width, height: compressed.height };
}

/**
 * Uploads a condition photo for a booking — drop-off, return, or a
 * reported problem.
 *
 * With no payments during beta these photos ARE the protection. There is
 * no hold to draw on and no claim to make against a card; a
 * before-and-after record is the only thing either side can point at.
 */
export async function uploadBookingPhoto(
  uid: string,
  bookingId: string,
  photo: PickedPhoto,
  index: number,
): Promise<ImageRef> {
  const compressed = await compressPhoto(photo, LISTING_MAX_EDGE);

  const response = await fetch(compressed.uri);
  const blob = await response.blob();

  const fileName = `${index}.jpg`;
  const path = storagePaths.bookingPhoto(uid, bookingId, fileName);
  const target = ref(storage, path);

  await uploadBytes(target, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(target);

  return { path, url, width: compressed.width, height: compressed.height };
}

/**
 * A photo sent in a chat.
 *
 * Smaller than a listing photo — it is shown in a bubble, not a
 * carousel — which keeps sending quick on campus wifi.
 */
export async function uploadMessagePhoto(uid: string, photo: PickedPhoto): Promise<ImageRef> {
  const compressed = await compressPhoto(photo, PROFILE_MAX_EDGE);

  const response = await fetch(compressed.uri);
  const blob = await response.blob();

  const path = storagePaths.messagePhoto(uid, `${Date.now()}.jpg`);
  const target = ref(storage, path);

  await uploadBytes(target, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(target);

  return { path, url, width: compressed.width, height: compressed.height };
}
