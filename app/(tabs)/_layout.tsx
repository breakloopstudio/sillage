import { useMemo } from 'react';
import { View } from 'react-native';
import { TopTabs } from 'expo-router/js-top-tabs';
import { useTheme } from '../../src/theme/ThemeContext';
import { NavigationChromeProvider, useNavigationChrome } from '../../src/features/navigation/NavigationChromeContext';
import SearchChrome from '../../src/features/search/SearchChrome';
import DockBar, { type BottomTabBarProps } from '../../src/features/navigation/DockBar';

function TabsNavigator() {
  const { theme } = useTheme();
  const { resetDock } = useNavigationChrome();

  const screenOptions = useMemo(() => ({
    sceneStyle: { backgroundColor: theme.colors.background },
    swipeEnabled: true,
    animationEnabled: true,
    lazy: true,
  }), [theme.colors.background]);

  const screenListeners = useMemo(() => ({ focus: resetDock }), [resetDock]);

  return (
    <TopTabs
      tabBar={(props: BottomTabBarProps) => <DockBar {...props} />}
      tabBarPosition="bottom"
      overScrollMode="never"
      screenOptions={screenOptions}
      screenListeners={screenListeners}
    >
      <TopTabs.Screen name="index" />
      <TopTabs.Screen name="collection" />
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
