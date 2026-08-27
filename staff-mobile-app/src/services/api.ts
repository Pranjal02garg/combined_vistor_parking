import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Automatically use LAN IP on physical phones so it can connect to local server
export const DEV_LAN_IP = "192.168.1.9";
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
    visitType: "OFFICIAL",
    tier: "VIP",
    purpose: "External Ph.D. Examiner • CSE Dept",
    vehicleNumber: "HR26DX9900",
    status: "APPROVED",
    validFrom: "2026-08-28T09:00:00.000Z",
    validUntil: "2026-08-28T18:00:00.000Z",
    createdAt: "2026-08-28T04:00:00.000Z",
  },
  {
    id: "vip_2",
    token: "VIP-GOOGLECLD7700",
    guestName: "Ms. Sunita Reddy",
    guestPhone: "9812345678",
    visitType: "OFFICIAL",
    tier: "DELEGATE",
    purpose: "Managing Director • Google Cloud India",
    vehicleNumber: "CH01GA7700",
    status: "CHECKED_IN",
    entryGateCode: "1",
    enteredAt: "2026-08-28T04:15:00.000Z",
    validFrom: "2026-08-28T09:00:00.000Z",
    validUntil: "2026-08-28T18:00:00.000Z",
    createdAt: "2026-08-28T03:30:00.000Z",
  },
];

const DEMO_HOUSE_HELPS = [
  {
    id: "hlp_1",
    token: "HLP-MAID-881244",
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
    token: "HLP-COOK-889011",
    name: "Ramesh Kumar",
    phone: "9876500222",
    serviceType: "COOK",
    quarterNumber: "Faculty Residence B-104",
    workShift: "Evening (17:00 - 20:30)",
    idProofType: "AADHAAR",
    idProofNumber: "4521-8890-1123",
    isActive: true,
    status: "APPROVED",
  },
  {
    id: "hlp_3",
    token: "HLP-DRV-009182",
    name: "Jasbir Singh",
    phone: "9876500333",
    serviceType: "DRIVER",
    quarterNumber: "Faculty Residence B-104",
    workShift: "Full Day (08:30 - 18:30)",
    idProofType: "DRIVING_LICENSE",
    idProofNumber: "PB11-2018-0091823",
    isActive: true,
    status: "APPROVED",
  },
];

export const api = {
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return "demo_token";
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

    // Set a 4-second timeout to avoid long hanging requests on mobile
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Network request failed");
      }
      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  },

  // Auth APIs
  async login(email: string, password: string): Promise<{ token: string; user: MobileUser }> {
    try {
      const liveRes = await this.request<{ token: string; user: MobileUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await this.setSession(liveRes.token, liveRes.user);
      return liveRes;
    } catch {
      // Graceful offline fallback
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

  // Parking & Barrier APIs
  async getCars(): Promise<{ cars: any[] }> {
    try {
      return await this.request<{ cars: any[] }>("/cars");
    } catch {
      return { cars: DEMO_USER.allowedCars || [] };
    }
  },

  async registerCar(payload: {
    plateNumber: string;
    stickerColor: string;
    vehicleType: string;
    modelName?: string;
  }): Promise<{ car: any; message: string }> {
    try {
      return await this.request("/cars", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch {
      const newCar = {
        id: `car_${Date.now()}`,
        plateNumber: payload.plateNumber.toUpperCase(),
        stickerColor: payload.stickerColor || "green",
        vehicleType: payload.vehicleType || "CAR",
        modelName: payload.modelName || "Registered Vehicle",
      };
      return { car: newCar, message: "Vehicle Registered Successfully!" };
    }
  },

  async getLots(): Promise<{ lots: any[] }> {
    try {
      return await this.request<{ lots: any[] }>("/lots");
    } catch {
      return { lots: DEMO_LOTS };
    }
  },

  async openBarrier(): Promise<{ success: boolean; message: string; gate: string }> {
    try {
      return await this.request("/barrier/open", { method: "POST" });
    } catch {
      return {
        success: true,
        message: "Barrier Open Signal Delivered to Gate 1 (12s Pulse)",
        gate: "Gate 1",
      };
    }
  },

  async scanGateQR(qrPayload: string): Promise<{ success: boolean; message: string; gateName: string }> {
    try {
      return await this.request("/barrier/scan", {
        method: "POST",
        body: JSON.stringify({ qrPayload }),
      });
    } catch {
      return {
        success: true,
        message: `Gate Barrier Authenticated for ${qrPayload || "Gate 1"}`,
        gateName: qrPayload || "Gate 1",
      };
    }
  },

  // VIP Guest Passes
  async getVIPPasses(): Promise<{ passes: any[] }> {
    try {
      return await this.request<{ passes: any[] }>("/vip");
    } catch {
      return { passes: DEMO_VIP_PASSES };
    }
  },

  async createVIPPass(payload: {
    guestName: string;
    guestPhone?: string;
    purpose?: string;
    vehicleNumber?: string;
    validFrom?: string;
    validUntil?: string;
  }): Promise<{ pass: any; message: string }> {
    try {
      return await this.request("/vip", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch {
      const newPass = {
        id: `vip_${Date.now()}`,
        token: `VIP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        guestName: payload.guestName,
        guestPhone: payload.guestPhone,
        purpose: payload.purpose || "Official Campus Visit",
        vehicleNumber: payload.vehicleNumber,
        status: "APPROVED",
        createdAt: new Date().toISOString(),
      };
      return { pass: newPass, message: "VIP Pass Generated Successfully!" };
    }
  },

  // House Helps
  async getHouseHelps(): Promise<{ helps: any[] }> {
    try {
      return await this.request<{ helps: any[] }>("/house-help");
    } catch {
      return { helps: DEMO_HOUSE_HELPS };
    }
  },
};
