import { Tabs } from 'expo-router';
import { View, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';

interface TabIconProps {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  focused: boolean;
  label: string;
}

function TabIcon({ name, color, focused, label }: TabIconProps) {
  return (
    <View
      style={{
        width: 72,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
      }}
    >
      <Ionicons name={name} size={22} color={color} />
      <Text
        numberOfLines={1}
        style={{
          color,
          fontSize: 10,
          lineHeight: 12,
          textAlign: 'center',
          fontFamily: focused ? 'Inter_600SemiBold' : 'Inter_400Regular',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const colors = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceContainer,
          borderTopColor: colors.outlineVariant,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
        },
        tabBarShowLabel: false,
        tabBarIconStyle: {
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.outline,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'home' : 'home-outline'}
              color={color}
              focused={focused}
              label="Início"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'library' : 'library-outline'}
              color={color}
              focused={focused}
              label="Decks"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'bar-chart' : 'bar-chart-outline'}
              color={color}
              focused={focused}
              label="Progresso"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'person' : 'person-outline'}
              color={color}
              focused={focused}
              label="Perfil"
            />
          ),
        }}
      />
    </Tabs>
  );
}
