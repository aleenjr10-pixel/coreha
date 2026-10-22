import type { ComponentType, ReactNode } from 'react';
import { Platform, UIManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import { FileText, Headset, User, Wrench } from 'lucide-react-native';
import { loadOptional } from '../../lib/optionalModule';
import { useSession } from '../../lib/session';
import { colors, fonts } from '../../lib/theme';

type IconProps = { color: string; size?: number };

const screens: { name: string; title: string; Icon: ComponentType<IconProps> }[] = [
  { name: 'index', title: 'Equipment', Icon: Wrench },
  { name: 'consult', title: 'Consult', Icon: Headset },
  { name: 'reports', title: 'Offers', Icon: FileText },
  { name: 'account', title: 'Account', Icon: User },
];

// Swiping between tabs needs the native pager from react-native-pager-view. Builds made
// before it was added don't have it, so they keep the regular tab bar instead of crashing.
const hasNativePager = Platform.OS !== 'web' && Boolean(UIManager.hasViewManagerConfig?.('RNCViewPager'));

type TopTabsNavigator = ComponentType<Record<string, unknown> & { children: ReactNode }> & {
  Screen: ComponentType<{ name: string; options?: Record<string, unknown> }>;
};

const SwipeTabs = hasNativePager
  ? loadOptional<TopTabsNavigator>('expo-router/js-top-tabs', () => require('expo-router/js-top-tabs').default)
  : null;

export default function TabsLayout() {
  const { restaurant } = useSession();
  const insets = useSafeAreaInsets();

  // Briefly true while signing out, before the root guard removes this group.
  if (!restaurant) return null;

  if (SwipeTabs) {
    return (
      <SwipeTabs
        tabBarPosition="bottom"
        screenOptions={{
          swipeEnabled: true,
          lazy: true,
          lazyPreloadDistance: 1,
          tabBarShowIcon: true,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarPressColor: colors.accentSoft,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom,
            elevation: 0,
            shadowOpacity: 0,
          },
          // The indicator sits on the top edge of the bottom bar, above the active tab.
          tabBarIndicatorStyle: { top: 0, height: 3, borderRadius: 3, backgroundColor: colors.accent },
          tabBarItemStyle: { paddingVertical: 6 },
          tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.semibold, textTransform: 'none', margin: 0 },
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        {screens.map(({ name, title, Icon }) => (
          <SwipeTabs.Screen
            key={name}
            name={name}
            options={{ title, tabBarIcon: ({ color }: IconProps) => <Icon color={color} size={22} /> }}
          />
        ))}
      </SwipeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.semibold },
      }}
    >
      {screens.map(({ name, title, Icon }) => (
        <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color, size }) => <Icon color={String(color)} size={size} /> }} />
      ))}
    </Tabs>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '../../components/ScreenErrorBoundary';
