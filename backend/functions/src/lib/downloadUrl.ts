/**
 * Is `url` the download link for `path` in this project's own bucket?
 *
 * Download links look like
 * `https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path, encoded>?alt=media&token=…`.
 * Both bucket spellings are accepted: projects made after late 2024 use
 * `.firebasestorage.app`, older ones `.appspot.com`. On the emulators the
 * host is the laptop (seen from a phone, its wifi address), so only the
 * bucket and file are checked there.
 *
 * Shared by every function that saves a photo the phone uploaded (looks,
 * pieces), so "her own upload to Loane" means the same thing everywhere.
 */
export function isDownloadUrlFor(url: string, path: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const onEmulator =
    process.env.FUNCTIONS_EMULATOR === 'true' || !!process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (onEmulator) {
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  } else if (parsed.protocol !== 'https:' || parsed.hostname !== 'firebasestorage.googleapis.com') {
    return false;
  }

  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
  const buckets = [
    process.env.STORAGE_BUCKET,
    `${projectId}.firebasestorage.app`,
    `${projectId}.appspot.com`,
  ].filter((b): b is string => !!b && !!projectId);
  return buckets.some(
    (bucket) => parsed.pathname === `/v0/b/${bucket}/o/${encodeURIComponent(path)}`,
  );
}

/** A path with no empty, "." or ".." parts, under `prefix`, and not absurdly long. */
export function isSafePathUnder(path: unknown, prefix: string): path is string {
  return (
    typeof path === 'string' &&
    path.length <= 512 &&
    path.startsWith(prefix) &&
    path.length > prefix.length &&
    !path.split('/').some((part) => part === '' || part === '.' || part === '..')
  );
}
