import { Tabs } from 'expo-router';

import { AppTabBar } from '@/components/navigation/tab-bar';

export default function TabsLayout() {
  return (
    <Tabs backBehavior="history" tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="more" />
      {/* Reachable from Home and More, but not shown in the tab bar. */}
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="ai-advisor" options={{ href: null }} />
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen name="documents" options={{ href: null }} />
    </Tabs>
  );
}
