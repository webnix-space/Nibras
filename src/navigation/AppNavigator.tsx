import React from 'react';
import { createDrawerNavigator, DrawerContentComponentProps } from '@react-navigation/drawer';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from '../screens/DashboardScreen';
import GuardModeScreen from '../screens/GuardModeScreen';
import VaultModeScreen from '../screens/VaultModeScreen';
import { color, spacing, type as t, radius } from '../theme/tokens';

const Drawer = createDrawerNavigator();

const NAV_ITEMS = [
  { name: 'Dashboard', icon: 'grid-outline' as const },
  { name: 'Guard Mode', icon: 'shield-checkmark-outline' as const },
  { name: 'Vault Mode', icon: 'lock-closed-outline' as const },
];

function CustomDrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const activeRoute = state.routeNames[state.index];

  return (
    <View style={styles.drawerContainer}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerTitle}>Nibras</Text>
        <Text style={styles.drawerSubtitle}>On-device security scanner</Text>
      </View>

      <View style={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeRoute === item.name;
          return (
            <Pressable
              key={item.name}
              onPress={() => navigation.navigate(item.name)}
              style={[styles.navItem, isActive && styles.navItemActive]}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={isActive ? color.textPrimary : color.textSecondary}
              />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.drawerFooter}>
        <Text style={styles.footerText}>Zero cloud. Ever.</Text>
      </View>
    </View>
  );
}

export default function AppNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: color.bg },
        headerTintColor: color.textPrimary,
        headerShadowVisible: false,
        drawerStyle: { backgroundColor: color.surface, width: 260 },
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} />
      <Drawer.Screen name="Guard Mode" component={GuardModeScreen} />
      <Drawer.Screen name="Vault Mode" component={VaultModeScreen} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerContainer: { flex: 1, backgroundColor: color.surface, paddingTop: 48 },
  drawerHeader: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  drawerTitle: { ...t.displayMedium, color: color.textPrimary },
  drawerSubtitle: { ...t.body, color: color.textTertiary, marginTop: spacing.xs },
  navList: { paddingHorizontal: spacing.md, gap: spacing.xs },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  navItemActive: { backgroundColor: color.surfaceElevated },
  navLabel: { ...t.body, color: color.textSecondary, fontWeight: '600' },
  navLabelActive: { color: color.textPrimary },
  drawerFooter: {
    marginTop: 'auto',
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: color.borderSubtle,
  },
  footerText: { ...t.caption, color: color.pulseAccent, letterSpacing: 0.5 },
});
