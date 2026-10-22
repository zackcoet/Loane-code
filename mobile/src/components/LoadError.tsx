/**
 * What a screen shows when its data could not be loaded.
 *
 * The rule (NORTH_STAR C6): a failed load is never shown as an empty
 * list or a blank. "No rentals yet" on a bad signal is a lie that makes
 * her think her booking vanished. This says what happened and offers the
 * one thing that helps.
 */

import { EmptyState } from './EmptyState';

interface Props {
  /** What failed, as she would say it: "your rentals", "this piece". */
  what: string;
  onRetry: () => void;
}

export function LoadError({ what, onRetry }: Props) {
  return (
    <EmptyState
      title={`Couldn't load ${what}`}
      body="Check your connection and try again."
      actionLabel="Try again"
      onAction={onRetry}
    />
  );
}
