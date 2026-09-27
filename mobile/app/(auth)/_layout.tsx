import { Stack } from 'expo-router';
import { colors } from '@loane/shared';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white } }} />
  );
}
