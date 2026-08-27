import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import VipPassesScreen from "./src/screens/VipPassesScreen";
import GateScannerScreen from "./src/screens/GateScannerScreen";
import HouseHelpScreen from "./src/screens/HouseHelpScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import { Text, View } from "react-native";

const Tab = createBottomTabNavigator();

function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#090d16", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#818cf8", fontSize: 16, fontWeight: "bold" }}>Loading Campus Pass...</Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0f172a", shadowColor: "transparent", elevation: 0 },
        headerTitleStyle: { color: "#ffffff", fontWeight: "900", fontSize: 17 },
        tabBarStyle: {
          backgroundColor: "#0f172a",
          borderTopColor: "#1e293b",
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: "#818cf8",
        tabBarInactiveTintColor: "#64748b",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
      }}
    >
      <Tab.Screen
        name="Parking"
        component={HomeScreen}
        options={{
          title: "Parking & Hub",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18 }}>🚗</Text>,
        }}
      />
      <Tab.Screen
        name="VIPPasses"
        component={VipPassesScreen}
        options={{
          title: "VIP Passes",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18 }}>🎟️</Text>,
        }}
      />
      <Tab.Screen
        name="GateScanner"
        component={GateScannerScreen}
        options={{
          title: "Scan Gate",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18 }}>📷</Text>,
        }}
      />
      <Tab.Screen
        name="HouseHelp"
        component={HouseHelpScreen}
        options={{
          title: "House Help",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18 }}>🧹</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
