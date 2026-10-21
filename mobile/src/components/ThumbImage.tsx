/**
 * A listing or post photo shown SMALL — a grid cell, a row, a tile.
 *
 * Asks for the server-made thumbnail first (shared/src/thumbnails.ts)
 * and falls back to the full photo if the thumbnail is not there: in the
 * second or two after an upload, for photos from before thumbnails
 * existed, and for anything that is not a listing or post photo (seed
 * data, the demo garments). So it is always safe to use in place of
 * <Image>; it only ever saves bytes, never loses a picture.
 *
 * Use plain <Image> with the full URL where the photo fills the screen —
 * a 480px thumbnail would look soft there.
 */

import { useEffect, useState } from 'react';
import { Image, type ImageProps } from 'react-native';
import { thumbnailUrlFor } from '@loane/shared';

type Props = Omit<ImageProps, 'source'> & {
  /** The full photo's download URL. */
  uri: string;
};

export function ThumbImage({ uri, onError, ...rest }: Props) {
  const thumb = thumbnailUrlFor(uri);
  const [failed, setFailed] = useState(false);

  // A recycled list cell gets a new photo: give the new one its own try.
  useEffect(() => setFailed(false), [uri]);

  const source = thumb && !failed ? thumb : uri;
  return (
    <Image
      {...rest}
      source={{ uri: source }}
      onError={(event) => {
        if (source === thumb) setFailed(true);
        onError?.(event);
      }}
    />
  );
}
