import { Stack } from 'expo-router';
import { color } from '@loane/shared';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.surface.page } }}
    />
  );
}
