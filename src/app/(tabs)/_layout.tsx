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
      {/* Activity, AI advisor, Reports and Documents are pushed screens (src/app/*.tsx), not
          hidden tabs: since Expo Router 58 a hidden tab cannot be opened. */}
    </Tabs>
  );
}
