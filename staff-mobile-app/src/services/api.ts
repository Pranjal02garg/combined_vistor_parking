import AsyncStorage from "@react-native-async-storage/async-storage";

// In local dev, use localhost or LAN IP. Default to web port 3000
export const API_BASE_URL = "http://localhost:3000/api/mobile";
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

export const api = {
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
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

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Network request failed");
    }
    return data;
  },

  // Auth APIs
  async login(email: string, password: string): Promise<{ token: string; user: MobileUser }> {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async getProfile(): Promise<{ user: MobileUser }> {
    return this.request("/auth/me");
  },

  // Parking & Barrier APIs
  async getCars(): Promise<{ cars: any[] }> {
    return this.request("/cars");
  },

  async registerCar(payload: {
    plateNumber: string;
    stickerColor: string;
    vehicleType: string;
    modelName?: string;
  }): Promise<{ car: any; message: string }> {
    return this.request("/cars", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getLots(): Promise<{ lots: any[] }> {
    return this.request("/lots");
  },

  async openBarrier(): Promise<{ success: boolean; message: string; gate: string }> {
    return this.request("/barrier/open", { method: "POST" });
  },

  async scanGateQR(qrPayload: string): Promise<{ success: boolean; message: string; gateName: string }> {
    return this.request("/barrier/scan", {
      method: "POST",
      body: JSON.stringify({ qrPayload }),
    });
  },

  // VIP Guest Passes
  async getVIPPasses(): Promise<{ passes: any[] }> {
    return this.request("/vip");
  },

  async createVIPPass(payload: {
    guestName: string;
    guestPhone: string;
    purpose: string;
    vehicleNumber?: string;
    validFrom?: string;
    validUntil?: string;
  }): Promise<{ pass: any; message: string }> {
    return this.request("/vip", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // House Helps
  async getHouseHelps(): Promise<{ helps: any[] }> {
    return this.request("/house-help");
  },
};
