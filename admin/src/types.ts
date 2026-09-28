export type Page =
  | 'overview'
  | 'users'
  | 'rentals'
  | 'listings'
  | 'posts'
  | 'comments'
  | 'reports'
  | 'claims'
  | 'campuses'
  | 'founding'
  | 'activity';

export const PAGE_LABELS: Record<Page, string> = {
  overview: 'Overview',
  users: 'Users',
  rentals: 'Rentals',
  listings: 'Listings',
  posts: 'Posts',
  comments: 'Comments',
  reports: 'Reports',
  claims: 'Damage Claims',
  campuses: 'Campuses',
  founding: 'Founding Closets',
  activity: 'Activity Log',
};

export const NAV_ITEMS: Page[] = [
  'overview',
  'users',
  'rentals',
  'listings',
  'posts',
  'comments',
  'reports',
  'claims',
  'campuses',
  'founding',
  'activity',
];
