import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MeasureScreen } from './src/features/measure/MeasureScreen';
import { PermissionGate } from './src/features/measure/PermissionGate';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" hidden />
      <PermissionGate>
        <MeasureScreen />
      </PermissionGate>
    </SafeAreaProvider>
  );
}
