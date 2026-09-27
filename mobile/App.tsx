import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppStoreProvider, useAppStore } from './src/data/AppStore';
import { AuthProvider, useAuth } from './src/features/account/AuthContext';
import { AuthScreen } from './src/features/account/AuthScreen';
import { Paywall } from './src/features/account/Paywall';
import { MeasureScreen } from './src/features/measure/MeasureScreen';
import { PermissionGate } from './src/features/measure/PermissionGate';
import { PatientsScreen } from './src/features/patients/PatientsScreen';
import { ReportScreen } from './src/features/report/ReportScreen';
import { NavigationContext, type Screen } from './src/navigation';
import { colors } from './src/ui/theme';

function Root() {
  const { ready } = useAppStore();
  const [screen, setScreen] = useState<Screen>('measure');
  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return (
    <NavigationContext.Provider value={setScreen}>
      {/* La caméra reste montée sous les autres écrans : retour instantané à la mesure. */}
      <PermissionGate>
        <View style={[StyleSheet.absoluteFill, screen !== 'measure' && styles.hidden]} pointerEvents={screen === 'measure' ? 'auto' : 'none'}>
          <MeasureScreen />
        </View>
      </PermissionGate>
      {screen === 'patients' && (
        <View style={StyleSheet.absoluteFill}>
          <PatientsScreen />
        </View>
      )}
      {screen === 'report' && (
        <View style={StyleSheet.absoluteFill}>
          <ReportScreen />
        </View>
      )}
      <Paywall />
    </NavigationContext.Provider>
  );
}

/** Connexion obligatoire ; puis un espace de données par compte praticien. */
function Gate() {
  const auth = useAuth();
  if (!auth.ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (!auth.view) return <AuthScreen />;
  return (
    <AppStoreProvider key={auth.view.account.id} accountId={auth.view.account.id} practitionerName={auth.view.account.name}>
      <Root />
    </AppStoreProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" hidden />
      <AuthProvider>
        <View style={styles.root}>
          <Gate />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  hidden: { opacity: 0 },
});
