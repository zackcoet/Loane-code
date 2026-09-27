import type { AppEvent, User } from '@loane/shared';
import {
  type AdminData,
  type DateWindow,
  changeLabel,
  dayKey,
  isInPreviousWindow,
  isInWindow,
  matchesCampus,
  toDate,
  weekKey,
} from './adminData';

export function scopeData(data: AdminData, campusId: string): AdminData {
  return {
    users: data.users.filter((item) => matchesCampus(item, campusId)),
    campuses: data.campuses.filter((item) => campusId === 'all' || item.id === campusId),
    listings: data.listings.filter((item) => matchesCampus(item, campusId)),
    posts: data.posts.filter((item) => matchesCampus(item, campusId)),
    bookings: data.bookings.filter((item) => matchesCampus(item, campusId)),
    reports: data.reports.filter((item) => matchesCampus(item, campusId)),
    damageClaims: data.damageClaims.filter((item) => matchesCampus(item, campusId)),
    adminActions: data.adminActions,
    events: data.events.filter((item) => matchesCampus(item, campusId)),
  };
}

export function makeOverviewMetrics(data: AdminData, window: DateWindow) {
  const usersInWindow = data.users.filter((user) => isInWindow(user.createdAt, window));
  const usersPrevious = data.users.filter((user) => isInPreviousWindow(user.createdAt, window));
  const listingsInWindow = data.listings.filter((listing) => isInWindow(listing.createdAt, window));
  const listingsPrevious = data.listings.filter((listing) => isInPreviousWindow(listing.createdAt, window));
  const postsInWindow = data.posts.filter((post) => isInWindow(post.createdAt, window));
  const postsPrevious = data.posts.filter((post) => isInPreviousWindow(post.createdAt, window));
  const requests = data.bookings.filter(
    (booking) => booking.timeline.requestedAt && isInWindow(booking.timeline.requestedAt, window),
  );
  const previousRequests = data.bookings.filter(
    (booking) =>
      booking.timeline.requestedAt && isInPreviousWindow(booking.timeline.requestedAt, window),
  );
  const completed = data.bookings.filter(
    (booking) => booking.status === 'completed' && isInWindow(booking.timeline.completedAt, window),
  );
  const previousCompleted = data.bookings.filter(
    (booking) =>
      booking.status === 'completed' && isInPreviousWindow(booking.timeline.completedAt, window),
  );
  const allTime = window.key === 'all';

  return {
    headlines: [
      {
        label: 'Total Users',
        value: data.users.length,
        detail: changeLabel(usersInWindow.length, usersPrevious.length, allTime),
      },
      {
        label: 'New Signups',
        value: usersInWindow.length,
        detail: changeLabel(usersInWindow.length, usersPrevious.length, allTime),
      },
      { label: 'Daily Active', value: uniqueRecentUsers(data.events, 1), detail: 'Unique users in last 24 hours' },
      { label: 'Weekly Active', value: uniqueRecentUsers(data.events, 7), detail: 'Unique users in last 7 days' },
      {
        label: 'Listings',
        value: data.listings.length,
        detail: changeLabel(listingsInWindow.length, listingsPrevious.length, allTime),
      },
      {
        label: 'Posts',
        value: data.posts.length,
        detail: changeLabel(postsInWindow.length, postsPrevious.length, allTime),
      },
      {
        label: 'Rental Requests',
        value: requests.length,
        detail: changeLabel(requests.length, previousRequests.length, allTime),
      },
      {
        label: 'Completed Rentals',
        value: completed.length,
        detail: changeLabel(completed.length, previousCompleted.length, allTime),
      },
      { label: 'Views', value: eventCount(data.events, ['post_view', 'listing_view'], window), detail: 'Post + listing views' },
      { label: 'Likes', value: eventCount(data.events, ['post_like'], window), detail: 'Post likes' },
      { label: 'Saves', value: eventCount(data.events, ['post_save', 'save'], window), detail: 'Looks + listings saved' },
      { label: 'Follows', value: eventCount(data.events, ['follow'], window), detail: 'New follows' },
      { label: 'Tagged-Item Taps', value: eventCount(data.events, ['tagged_item_tap'], window), detail: 'Social to marketplace' },
    ],
    signupsChart: seriesByDay(data.users.map((user) => user.createdAt), window),
    activeUsersChart: activeSeries(data.events, window),
    listingsChart: seriesByDay(data.listings.map((listing) => listing.createdAt), window),
    postsChart: seriesByDay(data.posts.map((post) => post.createdAt), window),
  };
}

export function makeFunnel(data: AdminData, window: DateWindow) {
  const users = data.users.filter((user) => isInWindow(user.createdAt, window));
  const userIds = new Set(users.map((user) => user.uid));
  const listed = new Set(data.listings.filter((listing) => userIds.has(listing.ownerUid)).map((item) => item.ownerUid));
  const posted = new Set(data.posts.filter((post) => userIds.has(post.authorUid)).map((item) => item.authorUid));
  const requested = new Set(data.bookings.filter((booking) => userIds.has(booking.renterUid)).map((item) => item.renterUid));
  const completed = new Set(
    data.bookings
      .filter((booking) => booking.status === 'completed')
      .flatMap((booking) => [booking.lenderUid, booking.renterUid])
      .filter((uid) => userIds.has(uid)),
  );

  return [
    { label: 'Signed up', value: users.length },
    { label: 'Completed profile', value: users.filter((user) => user.username && user.displayName).length },
    { label: 'Listed an item', value: listed.size },
    { label: 'Posted', value: posted.size },
    { label: 'Requested a rental', value: requested.size },
    { label: 'Completed a rental', value: completed.size },
  ];
}

export function makeRetention(users: User[], events: AppEvent[]) {
  const cohorts = new Map<string, User[]>();
  users.forEach((user) => {
    const key = weekKey(user.createdAt);
    cohorts.set(key, [...(cohorts.get(key) ?? []), user]);
  });

  return [...cohorts.entries()]
    .filter(([week]) => week !== 'Unknown')
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 8)
    .map(([week, cohort]) => {
      const start = new Date(`${week}T00:00:00`);
      const nextWeekStart = new Date(start);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);
      const laterStart = new Date(start);
      laterStart.setDate(laterStart.getDate() + 14);
      const cohortIds = new Set(cohort.map((user) => user.uid));
      const returningEvents = events.filter((event) => event.uid && cohortIds.has(event.uid));
      return {
        week,
        signups: cohort.length,
        nextWeek: uniqueAfter(returningEvents, nextWeekStart, laterStart),
        later: uniqueAfter(returningEvents, laterStart, null),
      };
    });
}

function uniqueRecentUsers(events: AppEvent[], days: number): number {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return new Set(
    events
      .filter((event) => event.uid && (toDate(event.createdAt)?.getTime() ?? 0) >= since.getTime())
      .map((event) => event.uid),
  ).size;
}

function eventCount(events: AppEvent[], types: AppEvent['type'][], window: DateWindow) {
  return events.filter((event) => types.includes(event.type) && isInWindow(event.createdAt, window)).length;
}

function seriesByDay(values: Array<Parameters<typeof dayKey>[0]>, window: DateWindow) {
  const counts = new Map<string, number>();
  values.filter((value) => isInWindow(value, window)).forEach((value) => addCount(counts, dayKey(value)));
  return mapToPoints(counts);
}

function activeSeries(events: AppEvent[], window: DateWindow) {
  const usersByDay = new Map<string, Set<string>>();
  events
    .filter((event) => event.uid && isInWindow(event.createdAt, window))
    .forEach((event) => {
      const key = dayKey(event.createdAt);
      usersByDay.set(key, new Set([...(usersByDay.get(key) ?? []), event.uid ?? '']));
    });
  return [...usersByDay.entries()]
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .slice(-14)
    .map(([label, set]) => ({ label: label.slice(5), value: set.size }));
}

function mapToPoints(counts: Map<string, number>) {
  return [...counts.entries()]
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .slice(-14)
    .map(([label, value]) => ({ label: label.slice(5), value }));
}

function addCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function uniqueAfter(events: AppEvent[], start: Date, end: Date | null) {
  return new Set(
    events
      .filter((event) => {
        const date = toDate(event.createdAt);
        if (!date) return false;
        return date >= start && (!end || date < end);
      })
      .map((event) => event.uid),
  ).size;
}
