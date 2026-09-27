/**
 * Placeholder for the middle + tab.
 *
 * Pressing + never actually lands here — the tab layout intercepts the
 * press and opens the "Post a Look / Add to My Closet" sheet. This file
 * exists so Expo Router has a route to hang the tab button on.
 */

import { Redirect } from 'expo-router';

export default function PostTab() {
  return <Redirect href="/(tabs)/feed" />;
}
