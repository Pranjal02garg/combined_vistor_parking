// Typed client for the Phase 2 API. Thin fetch wrappers the React Query hooks
// (and the refactored pages) call. All requests are same-origin.

export interface VisitDTO {
  id: string;
  referenceCode: string;
  category: string;
  categoryLabel: string | null;
  name: string;
  phone: string;
  vehicleNumber: string | null;
  details: Record<string, string>;
  selfieUrl: string;
  status: string;
  entryGateId: string;
  entryGateCode: string;
  entryGateName: string;
  exitGateId: string | null;
  exitGateCode: string | null;
  createdAt: string;
  approvedAt: string | null;
  exitedAt: string | null;
  blacklisted?: boolean;
}

export interface SubmitVisitBody {
  entryGate: string; // gate code, e.g. "1"
  name: string;
  phone: string;
  selfie: string; // base64 JPEG data URL
  fields: Record<string, string> & { category: string };
  otpToken?: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    // Never serve stale data from the browser/HTTP cache — the guard console is live.
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let details: any = undefined;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
      if (body?.details && Array.isArray(body.details) && body.details.length > 0) {
        details = body.details;
        const formatted = body.details
          .map((d: any) => `${d.path || "field"}: ${d.message}`)
          .join(", ");
        message = `${message} (${formatted})`;
      } else if (body?.details) {
        details = body.details;
      }
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(message, res.status, details);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: any) {
    super(message);
    this.name = "ApiError";
  }
}

export interface GateDTO {
  id: string;
  code: string;
  name: string;
}

export interface VIPDTO {
  id: string;
  token: string;
  guestName: string;
  guestPhone: string;
  purpose: string;
  vehicleNumber: string | null;
  status: string;
  hostStaffName: string;
  approver: { name: string; approvedAt: string } | null;
  entryGateCode: string | null;
  exitGateCode: string | null;
  validFrom: string | null;
  validUntil: string | null;
  enteredAt: string | null;
  exitedAt: string | null;
  createdAt: string;
  blacklisted?: boolean;
}

export interface SubmitVIPPassBody {
  guestName: string;
  guestPhone?: string;
  visitType: "PERSONAL" | "OFFICIAL";
  tier?: "VIP" | "GENERAL";
  vehicleNumber?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface VerifyVIPResponse {
  status: string;
  guestName: string;
  guestPhone: string;
  purpose: string;
  vehicleNumber: string | null;
  hostStaff: string;
  approver: { name: string; approvedAt: string } | null;
  validFrom: string | null;
  validUntil: string | null;
  alreadyEntered: boolean;
}

export interface AnalyticsDashboardResponse {
  summary: {
    totalCheckedIn: number;
    currentlyOnCampus: number;
    totalExited: number;
    escalatedAlerts: number;
    currentlyOverstaying?: number;
  };
  categoryBreakdown: Array<{ category: string; count: number }>;
  vipMetrics: {
    pending: number;
    approvedUnscanned: number;
    activeOnCampus: number;
  };
  gateThroughput: Array<{ gateCode: string; entries: number; exits: number }>;
}

export function fetchGates() {
  return request<{ gates: GateDTO[] }>("/api/gates");
}

export function submitVisit(body: SubmitVisitBody) {
  return request<{ referenceCode: string; status: string }>("/api/visits", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchQueue(gateId: string, cursor?: string) {
  const qs = new URLSearchParams({ gateId, ...(cursor ? { cursor } : {}) });
  return request<{ items: VisitDTO[]; nextCursor: string | null }>(
    `/api/visits/queue?${qs}`
  );
}

// Campus-wide pending/escalated standard visits across all gates.
export function fetchAllPending() {
  return request<{ items: VisitDTO[] }>("/api/visits/pending");
}

export function decideVisit(id: string, action: "approve" | "reject" | "escalate", onDutyGuard?: string) {
  return request<{ id: string; status: string }>(
    `/api/visits/${id}/decision`,
    { method: "PATCH", body: JSON.stringify({ action, onDutyGuard }) }
  );
}

export function exitVisit(referenceCode: string, exitGateId: string, onDutyGuard?: string) {
  return request<{ referenceCode: string; status: string }>(
    "/api/visits/exit",
    { method: "POST", body: JSON.stringify({ referenceCode, exitGateId, onDutyGuard }) }
  );
}


export function searchVisits(q: string) {
  return request<{ items: VisitDTO[] }>(
    `/api/visits/search?q=${encodeURIComponent(q)}`
  );
}

// VIP Passes
export function createVIPPass(body: SubmitVIPPassBody) {
  return request<VIPDTO>("/api/vip", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchMyVIPPasses() {
  return request<{ items: VIPDTO[] }>("/api/vip");
}

export function fetchVIPQueue() {
  return request<{ items: VIPDTO[] }>("/api/vip/queue");
}

export function decideVIPPass(id: string, action: "approve" | "reject") {
  return request<{ id: string; status: string }>(
    `/api/vip/${id}/decision`,
    { method: "PATCH", body: JSON.stringify({ action }) }
  );
}

export function verifyVIPPass(token: string) {
  return request<VerifyVIPResponse>(`/api/vip/verify?token=${encodeURIComponent(token)}`);
}

export function checkinVIPPass(token: string, gateId: string, onDutyGuard?: string) {
  return request<{ token: string; status: string }>("/api/vip/checkin", {
    method: "POST",
    body: JSON.stringify({ token, gateId, onDutyGuard }),
  });
}

export function exitVIPPass(token: string, gateId: string, onDutyGuard?: string) {
  return request<{ token: string; status: string }>("/api/vip/exit", {
    method: "POST",
    body: JSON.stringify({ token, gateId, onDutyGuard }),
  });
}

// Analytics & Escalations
export function fetchAnalyticsDashboard(date?: string) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  return request<AnalyticsDashboardResponse>(`/api/analytics/dashboard${qs}`);
}

export function fetchEscalatedVisits() {
  return request<{ items: VisitDTO[] }>("/api/visits/escalated");
}

// Forgot / reset password
export function requestPasswordReset(email: string) {
  return request<{ sent: boolean; devLink?: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, password: string) {
  return request<{ success: boolean }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

// OTP Verification (WhatsApp / SMS)
export function requestOtp(phone: string, channel: "whatsapp" | "sms" = "whatsapp") {
  return request<{ sent: boolean; channel?: string; devCode?: string }>("/api/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone, channel }),
  });
}

export function verifyOtp(phone: string, code: string) {
  return request<{ otpToken: string }>("/api/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

export function fetchVisitorByPhone(phone: string) {
  return request<{ name: string; visitCount: number; lastVisitAt: string | null; overstayCount: number; lastVehicleNumber: string | null; category: string | null; details: any | null; selfieUrl: string | null; }>(
    `/api/visitors?phone=${encodeURIComponent(phone)}`
  );
}

export interface OverstayAlertDTO {
  id: string;
  visitorName: string;
  visitorPhone: string;
  categoryLabel: string | null;
  vehicleNumber: string | null;
  enteredAt: string;
  gateName: string;
  elapsedMinutes: number;
  thresholdMinutes: number;
  overstayMinutes: number;
  repeatDefaulter: boolean;
}

export function fetchActiveOverstays() {
  return request<OverstayAlertDTO[]>("/api/admin/overstays");
}

export interface ActiveVisitorDTO {
  id: string;
  type: "STANDARD" | "VIP";
  name: string;
  phone: string;
  vehicleNumber: string | null;
  category: string;
  entryGateName: string;
  entryGateCode: string;
  enteredAt: string;
  referenceCode: string;
  minutesInside: number;
  overstaying: boolean;
  blacklisted: boolean;
}

export function fetchExpectedVIPPasses() {
  return request<{ items: VIPDTO[] }>("/api/vip/expected");
}

export function fetchActiveOnCampus() {
  return request<{ items: ActiveVisitorDTO[] }>("/api/visits/active");
}

// Unified guard master feed (normal + VIP, active + pending; server-sorted).
export interface FeedItem {
  key: string;
  kind: "NORMAL" | "VIP";
  state: "ACTIVE" | "PENDING" | "PAST";
  status: string;
  visitId: string | null;
  ref: string;
  name: string;
  phone: string;
  vehicleNumber: string | null;
  categoryLabel: string;
  category: string; // stable category key (or "VIP") — drives guard color coding
  selfieUrl: string | null;
  entryGateName: string | null;
  entryGateId: string | null;
  minutesInside: number | null;
  overstaying: boolean;
  blacklisted: boolean;
  awaitingHead: boolean;
  createdAt: string;
  fields: Array<{ label: string; value: string }>;
}

export function fetchGuardFeed() {
  return request<{ items: FeedItem[]; broadcast: { message: string | null; priority: string }; lockdown: { active: boolean; reason: string } }>("/api/guard/feed");
}

export function fetchGuardLookup(code: string) {
  return request<{ item: FeedItem }>(
    `/api/guard/lookup?code=${encodeURIComponent(code)}`
  );
}

// Phase 4 - Form configs DTO shapes
export interface FormFieldConfig {
  id?: string;
  categoryId?: string;
  name: string;
  label: string;
  type: "text" | "tel" | "select" | "number";
  required?: boolean;
  placeholder?: string | null;
  pattern?: string | null;
  maxLength?: number | null;
  sortOrder?: number;
  requiredWhenField?: string | null;
  requiredWhenValue?: string | null;
  options?: Array<{ value: string; label: string }> | string[];
}

export interface FormCategoryConfig {
  id?: string;
  key: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
  active?: boolean;
  fields?: FormFieldConfig[];
}

// Form Config Client Operations
export function fetchFormConfig() {
  return request<{ categories: FormCategoryConfig[] }>("/api/config/forms");
}

export function createFormCategory(body: Partial<FormCategoryConfig>) {
  return request<{ id: string; key: string }>("/api/admin/forms/categories", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateFormCategory(id: string, body: Partial<FormCategoryConfig>) {
  return request<any>(`/api/admin/forms/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteFormCategory(id: string) {
  return request<{ id: string; archived: boolean }>(`/api/admin/forms/categories/${id}`, {
    method: "DELETE",
  });
}

export function createFormField(body: Partial<FormFieldConfig>) {
  return request<{ id: string; name: string }>("/api/admin/forms/fields", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateFormField(id: string, body: Partial<FormFieldConfig>) {
  return request<any>(`/api/admin/forms/fields/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteFormField(id: string) {
  return request<{ id: string; archived: boolean }>(`/api/admin/forms/fields/${id}`, {
    method: "DELETE",
  });
}

// Settings DTO
export interface SystemSettingsDTO {
  id: string;
  overstayMinutes: number;
  defaulterThreshold: number;
  featureFlags: Record<string, boolean>;
  updatedAt: string;
  updatedById: string | null;
}

export function fetchSettings() {
  return request<SystemSettingsDTO>("/api/admin/settings");
}

export function updateSettings(body: Partial<SystemSettingsDTO>) {
  return request<SystemSettingsDTO>("/api/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// Blacklist DTO
export interface BlacklistDTO {
  id: string;
  phone: string;
  name: string | null;
  reason: string;
  active: boolean;
  expiresAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export function fetchBlacklist() {
  return request<{ items: BlacklistDTO[] }>("/api/admin/blacklist");
}

export function addBlacklist(body: { phone: string; name?: string; reason: string; expiresAt?: string }) {
  return request<BlacklistDTO>("/api/admin/blacklist", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateBlacklist(id: string, body: Partial<BlacklistDTO>) {
  return request<any>(`/api/admin/blacklist/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteBlacklist(id: string) {
  return request<{ id: string; deleted: boolean }>(`/api/admin/blacklist/${id}`, {
    method: "DELETE",
  });
}

// Defaulters DTO
export interface DefaulterDTO {
  id: string;
  phone: string;
  name: string;
  overstayCount: number;
  createdAt: string;
  updatedAt: string;
}

export function fetchDefaulters() {
  return request<{ items: DefaulterDTO[] }>("/api/admin/defaulters");
}

// HEAD overrides and direct creations
export function editVisit(id: string, body: any) {
  return request<any>(`/api/visits/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function editVIP(id: string, body: any) {
  return request<any>(`/api/vip/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function adminCreateVisit(body: any) {
  return request<any>("/api/admin/visits", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function adminCreateVIP(body: any) {
  return request<VIPDTO>("/api/admin/vip", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchAllVIPPasses(status?: string) {
  const url = status && status !== "ALL" ? `/api/admin/vip?status=${encodeURIComponent(status)}` : "/api/admin/vip";
  return request<{ items: VIPDTO[] }>(url);
}

// ── Lockdown mode ────────────────────────────────────────────────────────────
export function fetchLockdownStatus() {
  return request<{ lockdownActive: boolean; lockdownReason: string; lockdownAt: string | null }>("/api/admin/lockdown");
}

export function setLockdown(active: boolean, reason = "") {
  return request<{ lockdownActive: boolean }>("/api/admin/lockdown", {
    method: "POST",
    body: JSON.stringify({ active, reason }),
  });
}

// ── Guard broadcast ──────────────────────────────────────────────────────────
export function sendBroadcast(message: string, priority: "normal" | "urgent" = "normal", scheduledFor?: string) {
  return request<{ sent: boolean; message: string }>("/api/admin/broadcast", {
    method: "POST",
    body: JSON.stringify({ message, priority, scheduledFor }),
  });
}

export function clearBroadcast() {
  return request<{ cleared: boolean }>("/api/admin/broadcast", { method: "DELETE" });
}

// ── Global search ────────────────────────────────────────────────────────────
export interface SearchResult {
  visits: Array<{ id: string; referenceCode: string; name: string; phone: string; vehicleNumber: string | null; status: string; category: string; gate: string; createdAt: string }>;
  vips: Array<{ id: string; token: string; name: string; phone: string; purpose: string; status: string; createdAt: string }>;
}

export function adminSearch(q: string) {
  return request<SearchResult>(`/api/admin/search?q=${encodeURIComponent(q)}`);
}

// ── Bulk decisions ────────────────────────────────────────────────────────────
export async function bulkDecideVisits(ids: string[], action: "approve" | "reject") {
  return Promise.all(ids.map((id) => decideVisit(id, action)));
}

export async function bulkDecideVIPs(ids: string[], action: "approve" | "reject") {
  return Promise.all(ids.map((id) => decideVIPPass(id, action)));
}

// ── God Mode Analytics & Audits ──────────────────────────────────────────────

export function forceExitVisit(visitId: string, reason: string) {
  return request<{ success: boolean }>("/api/admin/force-exit", {
    method: "POST",
    body: JSON.stringify({ visitId, reason }),
  });
}

export function fetchAuditLogs(limit: number = 100) {
  return request<{ items: any[] }>(`/api/admin/audit?limit=${limit}`);
}

export function fetchHeadAnalytics(range: string = "7d") {
  return request<any>(`/api/admin/analytics/gates?range=${encodeURIComponent(range)}`);
}

// ── House Help & Domestic Staff APIs ─────────────────────────────────────────
export interface HouseHelpDTO {
  id: string;
  token: string;
  name: string;
  phone: string;
  idProofType: string | null;
  idProofNumber: string | null;
  idProofDocUrl: string | null;
  photoUrl: string | null;
  serviceType: string;
  status: string; // PENDING_APPROVAL, APPROVED, SUSPENDED, REJECTED
  quarterNumber?: string;
  validUntil?: string;
  isActive?: boolean;
  workShift?: string | null;
  registeredByName?: string;
  approvedByName?: string | null;
  employers?: Array<{
    staffName: string;
    quarterNumber: string;
    validUntil: string;
    isActive: boolean;
  }>;
  createdAt: string;
}

export function fetchStaffHouseHelps() {
  return request<{ items: HouseHelpDTO[] }>("/api/staff/house-helps");
}

export function createStaffHouseHelp(body: {
  phone: string;
  name?: string;
  serviceType?: string;
  idProofType?: string;
  idProofNumber?: string;
  idProofDocUrl?: string;
  photoUrl?: string;
  quarterNumber: string;
  validUntil: string;
  workShift?: string;
}) {
  return request<HouseHelpDTO>("/api/staff/house-helps", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateStaffHouseHelp(
  id: string,
  body: { validUntil?: string; isActive?: boolean; workShift?: string; quarterNumber?: string }
) {
  return request<HouseHelpDTO>(`/api/staff/house-helps/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteStaffHouseHelp(id: string) {
  return request<{ success: boolean; message: string }>(`/api/staff/house-helps/${id}`, {
    method: "DELETE",
  });
}

export function fetchAdminHouseHelps(status?: string) {
  const url = status && status !== "ALL" ? `/api/admin/house-helps?status=${encodeURIComponent(status)}` : "/api/admin/house-helps";
  return request<{ items: HouseHelpDTO[] }>(url);
}

export function decideHouseHelp(id: string, action: "approve" | "reject" | "suspend") {
  return request<{ id: string; status: string }>(`/api/admin/house-helps/${id}/decision`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export function lookupHouseHelpQR(token: string) {
  return request<{ item: HouseHelpDTO; isValid: boolean; reason?: string }>(`/api/guard/house-help/lookup?token=${encodeURIComponent(token)}`);
}

export function actionHouseHelp(body: { token: string; action: "CHECK_IN" | "CHECK_OUT"; gateId?: string; remarks?: string }) {
  return request<{ success: boolean; action: string; timestamp: string }>("/api/guard/house-help/action", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Staff Residence Incident & Misconduct APIs (Admin & Staff Only) ───────────
export interface IncidentDTO {
  id: string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "FLAGGED" | "RESOLVED" | "DISMISSED";
  staffId: string | null;
  staffName?: string | null;
  quarterNumber: string | null;
  reportedByName: string;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export function fetchIncidents(staffOnly?: boolean) {
  const url = staffOnly ? "/api/incidents?scope=my" : "/api/incidents";
  return request<{ items: IncidentDTO[] }>(url);
}

export function createIncident(body: {
  title: string;
  description: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  staffId?: string;
  quarterNumber?: string;
}) {
  return request<IncidentDTO>("/api/incidents", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function resolveIncident(id: string, body: { status: "RESOLVED" | "DISMISSED"; resolution: string }) {
  return request<IncidentDTO>(`/api/incidents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ── Staff/Guard account management (HEAD only) ───────────────────────────────
export interface StaffUserDTO {
  id: string;
  email: string;
  name: string;
  role: "STAFF" | "GUARD";
  isActive: boolean;
  createdAt: string;
  gates: { id: string; code: string; name: string }[];
}

export function fetchUsers() {
  return request<{ items: StaffUserDTO[] }>("/api/admin/users");
}

export function createUser(body: {
  email: string;
  name: string;
  role: "STAFF" | "GUARD";
  password?: string;
  gateIds?: string[];
}) {
  return request<StaffUserDTO>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateUser(
  id: string,
  body: Partial<{ name: string; role: "STAFF" | "GUARD"; isActive: boolean; gateIds: string[] }>
) {
  return request<StaffUserDTO>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deactivateUser(id: string) {
  return request<{ id: string; deactivated: boolean }>(`/api/admin/users/${id}`, {
    method: "DELETE",
  });
}

