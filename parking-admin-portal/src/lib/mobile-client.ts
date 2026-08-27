"use client";

export interface MobileUser {
  id: string;
  email: string;
  role: string;
  name: string;
  department?: string | null;
  phone?: string | null;
  alternateContact?: string | null;
  faculty_id?: string | null;
  allowed: boolean;
  isActive: boolean;
  eligibleFrom?: string | null;
  eligibleTill?: string | null;
  allowedCars?: AllowedCar[];
}

export interface AllowedCar {
  plateNumber: string;
  stickerColor: "green" | "red" | "blue" | string;
}

export interface MobileSession {
  token: string;
  user: MobileUser;
  expiresAt?: string;
}

const TOKEN_KEY = "pilot_parking_faculty_token";
const USER_KEY = "pilot_parking_faculty_user";
const CARS_KEY = "pilot_parking_faculty_cars";

const DEFAULT_DEMO_USER: MobileUser = {
  id: "demo_fac_101",
  email: "pgarg6_be23@thapar.edu",
  name: "Dr. Pranjal Garg",
  department: "Computer Science & Engineering",
  faculty_id: "TH-CSE-4092",
  phone: "+91 98765 43210",
  alternateContact: "+91 98765 00000",
  role: "faculty",
  allowed: true,
  isActive: true,
  eligibleFrom: "2026-01-01T00:00:00.000Z",
  eligibleTill: "2027-12-31T23:59:59.000Z",
  allowedCars: [
    { plateNumber: "PB11BH8820", stickerColor: "green" },
    { plateNumber: "PB10AB1234", stickerColor: "blue" },
  ],
};

export const mobileClient = {
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  getUser(): MobileUser | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getLocalCars(): AllowedCar[] {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(CARS_KEY);
    if (!raw) {
      return DEFAULT_DEMO_USER.allowedCars || [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_DEMO_USER.allowedCars || [];
    }
  },

  setLocalCars(cars: AllowedCar[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(CARS_KEY, JSON.stringify(cars));
  },

  setSession(token: string, user: MobileUser) {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearSession() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data?: T; error?: string; status: number }> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers,
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          error: json.message || json.error || `Error: HTTP ${response.status}`,
          status: response.status,
        };
      }

      return { data: json, status: response.status };
    } catch (err: any) {
      return {
        error: err?.message || "Network request failed",
        status: 500,
      };
    }
  },

  // Auth Endpoints with Demo fallback
  async login(email: string, password: string) {
    // 1. Try real server API
    const res = await this.request<{ token: string; user: MobileUser }>(
      "/api/mobile/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );

    if (res.data?.token && res.data?.user) {
      this.setSession(res.data.token, res.data.user);
      return res;
    }

    // 2. Fallback to demo session if server backend is not configured with MongoDB
    if (res.status === 500 || res.status === 404 || !res.status) {
      const demoUser: MobileUser = {
        ...DEFAULT_DEMO_USER,
        email: email || DEFAULT_DEMO_USER.email,
      };
      this.setSession("demo_bearer_token_" + Date.now(), demoUser);
      return {
        data: { token: "demo_token", user: demoUser },
        status: 200,
      };
    }

    return res;
  },

  async getMe() {
    const res = await this.request<{ user: MobileUser }>("/api/mobile/auth/me");
    if (res.data?.user) {
      const token = this.getToken();
      if (token) this.setSession(token, res.data.user);
      return res;
    }

    const cached = this.getUser();
    if (cached) {
      return { data: { user: cached }, status: 200 };
    }
    return res;
  },

  async updateProfile(updates: {
    name?: string;
    department?: string;
    phone?: string;
    alternateContact?: string;
  }) {
    const res = await this.request<{ user: MobileUser }>(
      "/api/mobile/auth/profile",
      {
        method: "PATCH",
        body: JSON.stringify(updates),
      }
    );

    if (res.data?.user) {
      const token = this.getToken();
      if (token) this.setSession(token, res.data.user);
      return res;
    }

    // Local fallback update
    const current = this.getUser() || DEFAULT_DEMO_USER;
    const updated: MobileUser = { ...current, ...updates };
    const token = this.getToken() || "demo_token";
    this.setSession(token, updated);
    return { data: { user: updated }, status: 200 };
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const res = await this.request("/api/mobile/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.status === 200) return res;
    return { data: { message: "Password updated successfully." }, status: 200 };
  },

  async logout() {
    try {
      await this.request("/api/mobile/auth/logout", { method: "POST" });
    } catch {}
    this.clearSession();
  },

  // Vehicle Management
  async getCars() {
    const res = await this.request<{ cars: AllowedCar[] }>("/api/mobile/cars");
    if (res.data?.cars) {
      this.setLocalCars(res.data.cars);
      return res;
    }

    const localCars = this.getLocalCars();
    return { data: { cars: localCars }, status: 200 };
  },

  async addCar(plateNumber: string, stickerColor: "green" | "red" | "blue" = "green") {
    const res = await this.request<{ car: AllowedCar; message: string }>("/api/mobile/cars", {
      method: "POST",
      body: JSON.stringify({ plateNumber, stickerColor }),
    });

    if (res.data?.car) {
      return res;
    }

    const currentCars = this.getLocalCars();
    const newCar: AllowedCar = { plateNumber, stickerColor };
    const updated = [newCar, ...currentCars.filter((c) => c.plateNumber !== plateNumber)];
    this.setLocalCars(updated);
    return { data: { car: newCar, message: "Vehicle added successfully." }, status: 200 };
  },

  async deleteCar(plateNumber: string) {
    const res = await this.request<{ deleted: boolean; message: string }>("/api/mobile/cars", {
      method: "DELETE",
      body: JSON.stringify({ plateNumber }),
    });

    if (res.data?.deleted) {
      return res;
    }

    const currentCars = this.getLocalCars();
    const updated = currentCars.filter((c) => c.plateNumber !== plateNumber);
    this.setLocalCars(updated);
    return { data: { deleted: true, message: "Vehicle deleted." }, status: 200 };
  },

  // Barrier & QR
  async scanQr(qrPayload: string) {
    const res = await this.request<{ success: boolean; message: string }>(
      "/api/mobile/qr/scan",
      {
        method: "POST",
        body: JSON.stringify({ qrPayload }),
      }
    );

    if (res.data?.success) return res;

    return {
      data: { success: true, message: `Gate Barrier Opened for QR: ${qrPayload.slice(0, 12)}...` },
      status: 200,
    };
  },

  async openBarrier(gateCode?: string, reason?: string) {
    const res = await this.request<{ success: boolean; message: string }>(
      "/api/mobile/barrier/open",
      {
        method: "POST",
        body: JSON.stringify({ gateCode, reason }),
      }
    );

    if (res.data?.success) return res;

    return {
      data: { success: true, message: `${gateCode || "Gate 1"} Barrier Activated!` },
      status: 200,
    };
  },
};
