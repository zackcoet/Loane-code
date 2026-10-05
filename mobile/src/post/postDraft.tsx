/**
 * The look she is building, shared across the five screens that build it.
 *
 * Arrange, Details, Tag pieces and Preview all read and write one draft.
 * Without this each screen would have to hand the whole post to the next
 * through route params — which cannot carry a tag list, and which loses
 * everything the moment she taps back.
 *
 * MEMORY ONLY, deliberately, unlike the signup draft.
 *
 * The photos are local file URIs handed to us by the system picker. Those
 * URIs are only valid for this run of the app: persisting them would mean
 * restoring a draft whose pictures have all become broken images, which is
 * worse than losing the draft. A half-written caption is not worth that.
 *
 * Cleared on share, and on abandoning the flow.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Occasion } from '@loane/shared';
import type { PickedPhoto } from '../lib/photo';

/** A tag placed on a photo, before the post exists. */
export interface DraftTag {
  listingId: string;
  /** Fraction of the photo, 0-1. Never pixels. */
  x: number;
  y: number;
}

export interface DraftPhoto {
  /**
   * Stable across reorders and removals, so a tag never follows the
   * wrong picture when she drags a thumbnail. An array index would.
   */
  id: string;
  picked: PickedPhoto;
  tags: DraftTag[];
}

interface PostDraftState {
  photos: DraftPhoto[];
  caption: string;
  occasions: Occasion[];

  setPhotos: (photos: DraftPhoto[]) => void;
  addPhotos: (picked: PickedPhoto[]) => void;
  removePhoto: (id: string) => void;
  movePhoto: (from: number, to: number) => void;
  replacePhoto: (id: string, picked: PickedPhoto) => void;

  addTag: (photoId: string, tag: DraftTag) => void;
  removeTag: (photoId: string, index: number) => void;
  moveTag: (photoId: string, index: number, x: number, y: number) => void;

  setCaption: (value: string) => void;
  setOccasions: (value: Occasion[]) => void;

  /** Total tags across every photo — what the Details row counts. */
  tagCount: number;
  reset: () => void;
}

const PostDraftContext = createContext<PostDraftState | null>(null);

let photoSeq = 0;
const nextPhotoId = () => `p${(photoSeq += 1)}`;

export function PostDraftProvider({ children }: { children: React.ReactNode }) {
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [caption, setCaption] = useState('');
  const [occasions, setOccasions] = useState<Occasion[]>([]);

  const addPhotos = useCallback((picked: PickedPhoto[]) => {
    setPhotos((current) => [
      ...current,
      ...picked.map((p) => ({ id: nextPhotoId(), picked: p, tags: [] })),
    ]);
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos((current) => current.filter((p) => p.id !== id));
  }, []);

  const movePhoto = useCallback((from: number, to: number) => {
    setPhotos((current) => {
      if (from === to || from < 0 || to < 0) return current;
      if (from >= current.length || to >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }, []);

  /** After a crop: same photo, same tags, new file. */
  const replacePhoto = useCallback((id: string, picked: PickedPhoto) => {
    setPhotos((current) => current.map((p) => (p.id === id ? { ...p, picked } : p)));
  }, []);

  const addTag = useCallback((photoId: string, tag: DraftTag) => {
    setPhotos((current) =>
      current.map((p) => (p.id === photoId ? { ...p, tags: [...p.tags, tag] } : p)),
    );
  }, []);

  const removeTag = useCallback((photoId: string, index: number) => {
    setPhotos((current) =>
      current.map((p) =>
        p.id === photoId ? { ...p, tags: p.tags.filter((_, i) => i !== index) } : p,
      ),
    );
  }, []);

  const moveTag = useCallback((photoId: string, index: number, x: number, y: number) => {
    setPhotos((current) =>
      current.map((p) =>
        p.id === photoId
          ? { ...p, tags: p.tags.map((t, i) => (i === index ? { ...t, x, y } : t)) }
          : p,
      ),
    );
  }, []);

  const reset = useCallback(() => {
    setPhotos([]);
    setCaption('');
    setOccasions([]);
  }, []);

  const value = useMemo<PostDraftState>(
    () => ({
      photos,
      caption,
      occasions,
      setPhotos,
      addPhotos,
      removePhoto,
      movePhoto,
      replacePhoto,
      addTag,
      removeTag,
      moveTag,
      setCaption,
      setOccasions,
      tagCount: photos.reduce((sum, p) => sum + p.tags.length, 0),
      reset,
    }),
    [
      photos,
      caption,
      occasions,
      addPhotos,
      removePhoto,
      movePhoto,
      replacePhoto,
      addTag,
      removeTag,
      moveTag,
      reset,
    ],
  );

  return <PostDraftContext.Provider value={value}>{children}</PostDraftContext.Provider>;
}

export function usePostDraft(): PostDraftState {
  const value = useContext(PostDraftContext);
  if (!value) {
    throw new Error('usePostDraft must be used inside PostDraftProvider');
  }
  return value;
}
