import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { api } from "./api";

// Show notifications while the app is foregrounded too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Ask for permission, obtain this device's Expo push token, and register it with
 * the backend. Returns the token or null.
 *
 * NOTE: remote push does NOT work in Expo Go on SDK 53+ — this resolves to null
 * there and the app continues normally. It works in a development/production
 * build. Everything downstream (server storage + send) is already wired.
 */
export async function registerForPushAsync(): Promise<string | null> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return null;

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;

    const resp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = resp?.data ?? null;

    if (token) {
      try {
        await api.registerPushToken(token);
      } catch {
        // token stored locally is useless; server registration is best-effort.
      }
    }
    return token;
  } catch {
    // Expo Go (no remote push) or a simulator without push support.
    return null;
  }
}
