import { Tabs } from 'expo-router';

import { AppTabBar } from '@/components/navigation/tab-bar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="ai-advisor" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="tasks" />
      {/* Reachable by navigation, but not shown in the tab bar. */}
      <Tabs.Screen name="documents" options={{ href: null }} />
      <Tabs.Screen name="more" options={{ href: null }} />
    </Tabs>
  );
}
