import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GuardModeScreen from './src/screens/GuardModeScreen';
import VaultModeScreen from './src/screens/VaultModeScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0B0F14' }, headerTintColor: '#F3F4F6' }}>
        <Stack.Screen name="Guard Mode" component={GuardModeScreen} />
        <Stack.Screen name="Vault Mode" component={VaultModeScreen} />
        {/* TODO: Pre-Deploy Checklist screen */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
