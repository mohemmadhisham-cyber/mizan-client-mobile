import { Tabs } from 'expo-router';

import { AppTabBar } from '@/components/navigation/tab-bar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="documents" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
