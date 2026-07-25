import { useMemo } from 'react';
import { View } from 'react-native';
import { TopTabs } from 'expo-router/js-top-tabs';
import { useTheme } from '../../src/theme/ThemeContext';
import { NavigationChromeProvider, useNavigationChrome } from '../../src/features/navigation/NavigationChromeContext';
import SearchChrome from '../../src/features/search/SearchChrome';
import DockBar from '../../src/features/navigation/DockBar';

function TabsNavigator() {
  const { theme } = useTheme();
  const { resetDock } = useNavigationChrome();

  const screenOptions = useMemo(() => ({
    sceneStyle: { backgroundColor: theme.colors.background },
    swipeEnabled: true,
    animationEnabled: true,
    lazy: true,
  }), [theme.colors.background]);

  return (
    <TopTabs
      tabBar={(props: any) => <DockBar {...props} />}
      tabBarPosition="bottom"
      overScrollMode="never"
      screenOptions={screenOptions}
      screenListeners={{ focus: resetDock }}
    >
      <TopTabs.Screen name="index" />
      <TopTabs.Screen name="selection" />
      <TopTabs.Screen name="collection" />
      <TopTabs.Screen name="profile" />
    </TopTabs>
  );
}

export default function TabsLayout() {
  const { theme } = useTheme();
  return (
    <NavigationChromeProvider>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <SearchChrome />
        <View style={{ flex: 1 }}>
          <TabsNavigator />
        </View>
      </View>
    </NavigationChromeProvider>
  );
}
