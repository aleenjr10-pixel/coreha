import { Tabs } from 'expo-router';
import { FileText, Headset, User, Wrench } from 'lucide-react-native';
import { useSession } from '../../lib/session';
import { colors } from '../../lib/theme';

export default function TabsLayout() {
  const { restaurant } = useSession();

  // Briefly true while signing out, before the root guard removes this group.
  if (!restaurant) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Equipment', tabBarIcon: ({ color, size }) => <Wrench color={color} size={size} /> }} />
      <Tabs.Screen name="consult" options={{ title: 'Consult', tabBarIcon: ({ color, size }) => <Headset color={color} size={size} /> }} />
      <Tabs.Screen name="reports" options={{ title: 'Offers', tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
