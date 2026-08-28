import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LanguageProvider } from "./src/i18n";
import LoginScreen from "./src/screens/LoginScreen";
import StaffPortalScreen from "./src/screens/StaffPortalScreen";
import { Text, View } from "react-native";

function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#020617", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#818cf8", fontSize: 14, fontWeight: "bold" }}>
          Authenticating Staff &amp; Resident Hub...
        </Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <StaffPortalScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
