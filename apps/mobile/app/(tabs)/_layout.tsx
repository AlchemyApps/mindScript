import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NowPlayingBar } from '../../components/NowPlayingBar';
import { Colors } from '../../lib/constants';

function CustomTabBar(props: BottomTabBarProps) {
  return (
    <View style={styles.tabBarWrapper}>
      <NowPlayingBar />
      <BottomTabBar {...props} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.gray400,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopWidth: 0,
            height: 60 + insets.bottom,
            paddingTop: 8,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
              },
              android: {
                elevation: 8,
              },
            }),
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            letterSpacing: 0.1,
          },
        }}
      >
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="library-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="player"
          options={{
            title: 'Now Playing',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="musical-notes-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabBarWrapper: {
    backgroundColor: Colors.surface,
  },
});
