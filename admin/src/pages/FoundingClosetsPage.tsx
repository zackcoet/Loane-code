import {
  isCountedListing,
  isCountedPost,
  isDeletedAccount,
  reportPersonLabel,
} from '@loane/shared';
import type { AdminData } from '../data/adminData';
import { formatShortDate, matchesCampus } from '../data/adminData';
import { EmptyState, Panel } from '../components/ui';
import { PersonLink } from '../components/PersonLink';
import { campusName } from './UsersPage';

export function FoundingClosetsPage({
  data,
  campusId,
  onOpenUser,
}: {
  data: AdminData;
  campusId: string;
  /** Opens her page under Users, where she is marked or unmarked. */
  onOpenUser: (uid: string) => void;
}) {
  // Pieces and looks that are on Loane now, counted from what the
  // dashboard loaded — the same rule as the Overview and her own page
  // (run 62). Removed and taken-down ones don't make a closet bigger.
  const pieces = new Map<string, number>();
  for (const listing of data.listings.filter(isCountedListing)) {
    pieces.set(listing.ownerUid, (pieces.get(listing.ownerUid) ?? 0) + 1);
  }
  const looks = new Map<string, number>();
  for (const post of data.posts.filter(isCountedPost)) {
    looks.set(post.authorUid, (looks.get(post.authorUid) ?? 0) + 1);
  }

  // Deleting an account already takes the mark off; this is the
  // belt-and-braces for anything marked before that rule existed.
  const founders = data.users
    .filter((user) => user.isFoundingCloset && !isDeletedAccount(user))
    .filter((user) => matchesCampus(user, campusId))
    .sort((a, b) => (pieces.get(b.uid) ?? 0) - (pieces.get(a.uid) ?? 0));

  return (
    <Panel title="Founding Closets" kicker={`${founders.length} closets`}>
      {founders.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Campus</th>
              <th>Pieces up</th>
              <th>Looks up</th>
              <th>Lent</th>
              <th>Last active</th>
            </tr>
          </thead>
          <tbody>
            {founders.map((user) => (
              <tr key={user.uid}>
                <td>
                  {user.displayName}
                  <PersonLink
                    person={reportPersonLabel(user.uid, data.users)}
                    onOpen={onOpenUser}
                  />
                </td>
                <td>{campusName(data.campuses, user.campusId)}</td>
                <td>{pieces.get(user.uid) ?? 0}</td>
                <td>{looks.get(user.uid) ?? 0}</td>
                <td>{user.stats.rentalsAsLender}</td>
                <td>{formatShortDate(user.lastActiveAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          title="No founding closets yet"
          body="Open a student under Users and press Make Founding Closet. Her pieces and looks are counted here."
        />
      )}
    </Panel>
  );
}
