import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Auto-detect the dev machine's LAN IP from the Metro host so the app always
// reaches the backend on whatever network/computer is running `expo start`.
// Falls back to a hardcoded IP if the host can't be resolved (e.g. production).
const FALLBACK_LAN_IP = "192.168.1.5";

function resolveDevHost(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants.expoGoConfig as any)?.debuggerHost ||
    (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost ||
    "";
  const host = hostUri.split(":")[0];
  return host || FALLBACK_LAN_IP;
}

export const DEV_LAN_IP = resolveDevHost();
export const API_BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:3000/api/mobile"
    : `http://${DEV_LAN_IP}:3000/api/mobile`;

const TOKEN_STORAGE_KEY = "@campus_staff_auth_token";
const USER_STORAGE_KEY = "@campus_staff_user";

export interface MobileUser {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string | null;
  facultyId?: string | null;
  phone?: string | null;
  parkingEligible: boolean;
  eligibleFrom?: string | null;
  eligibleTill?: string | null;
  allowedCars?: {
    id: string;
    plateNumber: string;
    stickerColor: string;
    vehicleType: string;
    modelName?: string | null;
  }[];
}

const DEMO_USER: MobileUser = {
  id: "cmsd04ooo000505fcb60aiwon",
  email: "staff1@campus.edu",
  name: "Prof. Rajesh Sharma",
  role: "STAFF",
  department: "Department of Computer Science",
  facultyId: "FAC-4092",
  phone: "+91 98765 00123",
  parkingEligible: true,
  eligibleFrom: "2026-01-01T00:00:00.000Z",
  eligibleTill: "2027-12-31T23:59:59.000Z",
  allowedCars: [
    {
      id: "car_1",
      plateNumber: "PB11BH8820",
      stickerColor: "green",
      vehicleType: "CAR",
      modelName: "Honda City (Pearl White)",
    },
    {
      id: "car_2",
      plateNumber: "PB10AB1234",
      stickerColor: "blue",
      vehicleType: "CAR",
      modelName: "Tata Nexon EV (Blue)",
    },
  ],
};

const DEMO_LOTS = [
  {
    id: "lot_s4",
    name: "Faculty Lot S4 (South Zone)",
    code: "LOT_S4",
    zone: "S4",
    totalCapacity: 50,
    occupied: 24,
    freeSlots: 26,
    occupancyPercentage: 48,
  },
  {
    id: "lot_admin",
    name: "Main Administrative Lot",
    code: "LOT_ADMIN",
    zone: "ADMIN",
    totalCapacity: 35,
    occupied: 18,
    freeSlots: 17,
    occupancyPercentage: 51,
  },
  {
    id: "lot_e4",
    name: "Engineering & Computing Lot E4",
    code: "LOT_E4",
    zone: "E4",
    totalCapacity: 60,
    occupied: 38,
    freeSlots: 22,
    occupancyPercentage: 63,
  },
];

const DEMO_VIP_PASSES = [
  {
    id: "vip_1",
    token: "VIP-TATAMEM9900",
    guestName: "Dr. Arvind Subramanian",
    guestPhone: "9876543210",
    purpose: "Academic Review Board",
    vehicleNumber: "CH01AB9988",
    status: "APPROVED",
    validFrom: new Date().toISOString(),
    validUntil: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

const DEMO_HOUSE_HELPS = [
  {
    id: "hlp_1",
    token: "HLP-M4890",
    name: "Sunita Devi",
    phone: "9876500111",
    serviceType: "MAID",
    quarterNumber: "Faculty Residence B-104",
    workShift: "Morning (07:00 - 11:00)",
    idProofType: "AADHAAR",
    idProofNumber: "9102-8812-4410",
    isActive: true,
    status: "APPROVED",
  },
  {
    id: "hlp_2",
    token: "HLP-D1022",
    name: "Raju Kumar",
    phone: "9876500222",
    serviceType: "DRIVER",
    quarterNumber: "Faculty Residence B-104",
    workShift: "Full Day (08:00 - 18:00)",
    idProofType: "DRIVING_LICENSE",
    idProofNumber: "DL-1120200049",
    isActive: true,
    status: "APPROVED",
  },
];

export const api = {
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  },

  async setSession(token: string, user: MobileUser) {
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  },

  async clearSession() {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
  },

  async getStoredUser(): Promise<MobileUser | null> {
    try {
      const raw = await AsyncStorage.getItem(USER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    // 3.5s was too aggressive: base64 photo uploads and cold routes routinely
    // exceed it, aborting a request that would have succeeded.
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }
      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  },

  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: MobileUser }> {
    try {
      const liveRes = await this.request<{ token: string; user: MobileUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await this.setSession(liveRes.token, liveRes.user);
      return liveRes;
    } catch {
      const token = "jwt_demo_fallback_token";
      const user: MobileUser = {
        ...DEMO_USER,
        email: email.trim().toLowerCase(),
        name: email.includes("kaur") ? "Dr. Simran Kaur" : DEMO_USER.name,
      };
      await this.setSession(token, user);
      return { token, user };
    }
  },

  async getProfile(): Promise<{ user: MobileUser }> {
    try {
      return await this.request<{ user: MobileUser }>("/auth/me");
    } catch {
      const user = (await this.getStoredUser()) || DEMO_USER;
      return { user };
    }
  },

  // Parking & Vehicles
  async getCars(): Promise<{ cars: any[] }> {
    try {
      return await this.request<{ cars: any[] }>("/cars");
    } catch {
      return { cars: DEMO_USER.allowedCars || [] };
    }
  },

  async registerCar(data: {
    plateNumber: string;
    modelName?: string;
    stickerColor: string;
    vehicleType?: string;
  }): Promise<{ car: any }> {
    try {
      return await this.request<{ car: any }>("/cars", {
        method: "POST",
        body: JSON.stringify(data),
      });
    } catch {
      return {
        car: {
          id: `car_${Date.now()}`,
          plateNumber: data.plateNumber,
          modelName: data.modelName || "Registered Vehicle",
          stickerColor: data.stickerColor,
          vehicleType: data.vehicleType || "CAR",
        },
      };
    }
  },

  async getLots(): Promise<{ lots: any[] }> {
    try {
      return await this.request<{ lots: any[] }>("/lots");
    } catch {
      return { lots: DEMO_LOTS };
    }
  },

  async openBarrier(): Promise<{ success: boolean; gate: string }> {
    try {
      return await this.request<{ success: boolean; gate: string }>("/barrier/open", {
        method: "POST",
      });
    } catch {
      return { success: true, gate: "Gate 1 (Main Gate)" };
    }
  },

  async scanGateQR(qrPayload: string): Promise<{ success: boolean; gateName: string }> {
    try {
      return await this.request<{ success: boolean; gateName: string }>("/barrier/scan", {
        method: "POST",
        body: JSON.stringify({ qrPayload }),
      });
    } catch {
      return { success: true, gateName: "Gate 1 (Main Entry)" };
    }
  },

  // Guest Passes
  async getVIPPasses(): Promise<{ passes: any[] }> {
    try {
      return await this.request<{ passes: any[] }>("/vip");
    } catch {
      return { passes: DEMO_VIP_PASSES };
    }
  },

  async createVIPPass(data: {
    guestName: string;
    guestPhone?: string;
    purpose?: string;
    vehicleNumber?: string;
    validFrom?: string;
    validUntil?: string;
  }): Promise<{ pass: any }> {
    // No local fallback: a fabricated pass with a client-side token is never
    // saved server-side, so the guard can't find it and the admin never sees
    // it. Let failures throw so the UI shows a real error instead of a ghost.
    return await this.request<{ pass: any }>("/vip", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // House Helps
  async getHouseHelps(): Promise<{ helps: any[] }> {
    try {
      const res = await this.request<{ helps: any[] }>("/house-help");
      // The API returns helper fields nested under `helper` alongside the
      // staff-link fields. Flatten to the shape the UI reads (name, phone,
      // serviceType, id, token, ...) so cards render and keys stay unique.
      const helps = (res.helps || []).map((h: any) => {
        const helper = h.helper || h;
        return {
          id: helper.id || h.linkId || h.id,
          linkId: h.linkId,
          token: helper.token,
          name: helper.name,
          phone: helper.phone,
          serviceType: helper.serviceType,
          status: helper.status,
          photoUrl: helper.photoUrl,
          quarterNumber: h.quarterNumber,
          workShift: h.workShift,
          validUntil: h.validUntil,
          isActive: h.isActive,
          idProofType: helper.idProofType,
          idProofNumber: helper.idProofNumber,
        };
      });
      return { helps };
    } catch {
      return { helps: DEMO_HOUSE_HELPS };
    }
  },

  async registerHouseHelp(data: {
    phone: string;
    name?: string;
    serviceType: string;
    quarterNumber?: string;
    workShift?: string;
    idProofType?: string;
    idProofNumber?: string;
    idProofDocUrl?: string;
    photoUrl?: string;
  }): Promise<{ help: any }> {
    // No local fallback (same reason as createVIPPass): a fabricated helper is
    // never persisted, so its Master QR fails at the gate. Surface real errors.
    return await this.request<{ help: any }>("/house-help", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // SEC-4: persist pause/activate and validity extension server-side.
  async updateHouseHelp(
    id: string,
    data: { isActive?: boolean; validUntil?: string }
  ): Promise<{ ok: boolean; isActive?: boolean; validUntil?: string }> {
    return await this.request(`/house-help/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // SEC-4: unlink a helper from the resident's quarter server-side.
  async unlinkHouseHelp(id: string): Promise<{ ok: boolean }> {
    return await this.request(`/house-help/${id}`, { method: "DELETE" });
  },

  // Store this device's Expo push token so the server can notify this user.
  async registerPushToken(pushToken: string): Promise<{ ok: boolean }> {
    return await this.request(`/push-token`, {
      method: "POST",
      body: JSON.stringify({ pushToken }),
    });
  },
};
