import React from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import PlayersScreen from './src/screens/PlayersScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1 }}>
          <PlayersScreen />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
