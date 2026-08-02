import React from 'react';
import { Pressable, Text } from 'react-native';
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
        <Stack.Screen
          name="Guard Mode"
          component={GuardModeScreen}
          options={({ navigation }) => ({
            headerRight: () => (
              <Pressable onPress={() => navigation.navigate('Vault Mode')} style={{ marginRight: 16 }}>
                <Text style={{ color: '#5B8DEF', fontSize: 15, fontWeight: '600' }}>Vault →</Text>
              </Pressable>
            ),
          })}
        />
        <Stack.Screen
          name="Vault Mode"
          component={VaultModeScreen}
          options={({ navigation }) => ({
            headerLeft: () => (
              <Pressable onPress={() => navigation.navigate('Guard Mode')} style={{ marginRight: 16 }}>
                <Text style={{ color: '#5B8DEF', fontSize: 15, fontWeight: '600' }}>← Guard</Text>
              </Pressable>
            ),
          })}
        />
        {/* TODO: Pre-Deploy Checklist screen */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
