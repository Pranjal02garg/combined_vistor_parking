import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import argon2 from "argon2";
import { MongoClient, ObjectId } from "mongodb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const NEXT_DEV_LOCK_FILE = path.join(ROOT_DIR, ".next", "dev", "lock");

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnvFile(path.join(ROOT_DIR, ".env.local"));

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error(
    "MONGODB_URI is required in .env.local to run integration tests.",
  );
}

const PORT = process.env.MOBILE_API_TEST_PORT
  ? Number(process.env.MOBILE_API_TEST_PORT)
  : 4100 + Math.floor(Math.random() * 1000);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TEST_DB_NAME =
  process.env.MOBILE_API_TEST_DB_NAME ?? `parking_app_mobile_it_${Date.now()}`;

const TEST_USER_EMAIL = `mobile.it.${Date.now()}@example.com`;
const TEST_USER_PASSWORD = "SecurePass!2026";
const TEST_USER_NEW_PASSWORD = "SecurePass!2027";
const TEST_PLATE_NUMBER = "PB10AB1234";
const TEST_QR_PREFIX = process.env.MOBILE_QR_PREFIX ?? "PARKING_OPEN:";

let nextServer;
let serverLogs = "";
let mongoClient;
let testDb;

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function appendLogs(chunk) {
  serverLogs += chunk.toString();
  if (serverLogs.length > 12000) {
    serverLogs = serverLogs.slice(-12000);
  }
}

function readDevLockFile() {
  if (!fs.existsSync(NEXT_DEV_LOCK_FILE)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(NEXT_DEV_LOCK_FILE, "utf8").trim();
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.pid !== "number") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function ensureNoConflictingDevServer() {
  const devLock = readDevLockFile();
  if (!devLock) {
    return;
  }

  if (!isProcessAlive(devLock.pid)) {
    return;
  }

  const staleIntegrationServer = devLock.port === 4011;
  const forceKill = process.env.MOBILE_API_FORCE_KILL_LOCK === "1";

  if (process.platform === "win32" && (staleIntegrationServer || forceKill)) {
    await killWindowsProcessTree(devLock.pid);
    return;
  }

  throw new Error(
    `A Next dev server is already running (PID ${devLock.pid} at ${devLock.appUrl ?? "unknown"}). ` +
      "Stop it before running mobile integration tests, or set MOBILE_API_FORCE_KILL_LOCK=1.",
  );
}

async function startServer() {
  await ensureNoConflictingDevServer();

  const sanitizedEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      sanitizedEnv[key] = value;
    }
  }

  nextServer = spawn(
    `${npmCommand()} run dev -- --hostname 127.0.0.1 --port ${PORT}`,
    {
      shell: true,
      cwd: ROOT_DIR,
      env: {
        ...sanitizedEnv,
        APP_ORIGIN: BASE_URL,
        MONGODB_DB_NAME: TEST_DB_NAME,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  nextServer.stdout?.on("data", appendLogs);
  nextServer.stderr?.on("data", appendLogs);

  nextServer.on("exit", (code) => {
    if (code !== 0) {
      appendLogs(`\n[next-exit:${code}]\n`);
    }
  });

  await waitForServerReady();
}

async function killWindowsProcessTree(pid) {
  const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
    shell: false,
    stdio: "ignore",
  });

  try {
    await once(killer, "exit");
  } catch {
    // Ignore termination race conditions.
  }
}

async function stopServer() {
  if (!nextServer) {
    return;
  }

  const processRef = nextServer;

  if (processRef.exitCode !== null) {
    return;
  }

  if (process.platform === "win32" && processRef.pid) {
    await killWindowsProcessTree(processRef.pid);
  } else {
    processRef.kill("SIGTERM");
  }

  await Promise.race([
    once(processRef, "exit"),
    delay(5000).then(() => {
      if (processRef.exitCode === null && process.platform !== "win32") {
        processRef.kill("SIGKILL");
      }
    }),
  ]);
}

async function waitForServerReady() {
  const startedAt = Date.now();
  const timeoutMs = 120000;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/api/mobile/auth/me`, {
        headers: { Authorization: "Bearer bootstrap" },
      });
      if (response.status > 0) {
        return;
      }
    } catch {
      // Ignore until the server starts listening.
    }

    if (nextServer?.exitCode !== null) {
      throw new Error(
        `Next server exited before becoming ready.\n${serverLogs}`,
      );
    }

    await delay(1000);
  }

  throw new Error(
    `Timed out waiting for Next server readiness.\n${serverLogs}`,
  );
}

async function setupDb() {
  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  testDb = mongoClient.db(TEST_DB_NAME);
  await testDb.dropDatabase();

  const passwordHash = await argon2.hash(TEST_USER_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const now = new Date();
  await testDb.collection("users").insertOne({
    _id: new ObjectId(),
    name: "Integration Faculty",
    department: "CSE",
    faculty_id: "FAC-IT-001",
    phone: null,
    alternateContact: null,
    email: TEST_USER_EMAIL,
    passwordHash,
    role: "user",
    isActive: true,
    parkingEligible: true,
    eligibleFrom: null,
    eligibleTill: null,
    allowedCars: [],
    failedLoginAttempts: 0,
    lockUntil: null,
    createdAt: now,
    updatedAt: now,
  });
}

async function teardownDb() {
  if (!mongoClient) {
    return;
  }
  try {
    await testDb.dropDatabase();
  } finally {
    await mongoClient.close();
  }
}

async function apiRequest(pathname, options = {}) {
  const { method = "GET", token, body, headers = {} } = options;

  const requestHeaders = {
    ...headers,
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  return { response, status: response.status, data };
}

let sharedToken;

test.before(async () => {
  await startServer();
  await setupDb();
});

test.after(async () => {
  await stopServer();
  await teardownDb();
});

test("mobile login returns token and mobile user payload", async () => {
  const result = await apiRequest("/api/mobile/auth/login", {
    method: "POST",
    body: {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    },
  });

  assert.equal(result.status, 200);
  assert.ok(result.data?.token, "Expected login token in response");
  assert.equal(result.data?.user?.email, TEST_USER_EMAIL);
  assert.equal(result.data?.user?.allowed, true);
  assert.equal(typeof result.data?.session?.expiresAt, "string");

  sharedToken = result.data.token;
});

test("mobile me accepts bearer token", async () => {
  assert.ok(sharedToken, "Token should be set by login test");

  const result = await apiRequest("/api/mobile/auth/me", {
    token: sharedToken,
  });

  assert.equal(result.status, 200);
  assert.equal(result.data?.user?.email, TEST_USER_EMAIL);
  assert.equal(typeof result.data?.session?.expiresAt, "string");
});

test("mobile profile patch allows whitelisted fields and rejects unknown fields", async () => {
  assert.ok(sharedToken, "Token should be set by login test");

  const rejectResult = await apiRequest("/api/mobile/auth/profile", {
    method: "PATCH",
    token: sharedToken,
    body: { role: "admin" },
  });

  assert.equal(rejectResult.status, 400);
  assert.equal(rejectResult.data?.error, "INVALID_PAYLOAD");

  const patchResult = await apiRequest("/api/mobile/auth/profile", {
    method: "PATCH",
    token: sharedToken,
    body: {
      name: "Updated Integration Faculty",
      department: "ECE",
    },
  });

  assert.equal(patchResult.status, 200);
  assert.equal(patchResult.data?.user?.name, "Updated Integration Faculty");
  assert.equal(patchResult.data?.user?.department, "ECE");
});

test("mobile cars add/list/delete works", async () => {
  assert.ok(sharedToken, "Token should be set by login test");

  const addResult = await apiRequest("/api/mobile/cars", {
    method: "POST",
    token: sharedToken,
    body: {
      plateNumber: TEST_PLATE_NUMBER,
      stickerColor: "green",
    },
  });

  assert.equal(addResult.status, 201);
  assert.equal(addResult.data?.car?.plateNumber, TEST_PLATE_NUMBER);

  const listAfterAdd = await apiRequest("/api/mobile/cars", {
    token: sharedToken,
  });

  assert.equal(listAfterAdd.status, 200);
  assert.equal(
    listAfterAdd.data?.cars?.some(
      (car) => car.plateNumber === TEST_PLATE_NUMBER,
    ),
    true,
  );

  const deleteResult = await apiRequest("/api/mobile/cars", {
    method: "DELETE",
    token: sharedToken,
    body: {
      plateNumber: TEST_PLATE_NUMBER,
    },
  });

  assert.equal(deleteResult.status, 200);

  const listAfterDelete = await apiRequest("/api/mobile/cars", {
    token: sharedToken,
  });

  assert.equal(listAfterDelete.status, 200);
  assert.equal(
    listAfterDelete.data?.cars?.some(
      (car) => car.plateNumber === TEST_PLATE_NUMBER,
    ),
    false,
  );
});

test("mobile barrier endpoint validates payload and grants access", async () => {
  assert.ok(sharedToken, "Token should be set by login test");

  const invalidPayload = await apiRequest("/api/mobile/barrier/open", {
    method: "POST",
    token: sharedToken,
    body: {
      qrPayload: "INVALID_PAYLOAD",
    },
  });

  assert.equal(invalidPayload.status, 400);
  assert.equal(invalidPayload.data?.error, "INVALID_PAYLOAD");

  const validPayload = await apiRequest("/api/mobile/barrier/open", {
    method: "POST",
    token: sharedToken,
    body: {
      qrPayload: `${TEST_QR_PREFIX}GATE-A`,
    },
  });

  assert.equal(validPayload.status, 200);
  assert.equal(validPayload.data?.success, true);
  assert.equal(validPayload.data?.barrierId, "GATE-A");
});

test("mobile change-password enforces current password and rotates credentials", async () => {
  assert.ok(sharedToken, "Token should be set by login test");

  const wrongCurrent = await apiRequest("/api/mobile/auth/change-password", {
    method: "POST",
    token: sharedToken,
    body: {
      currentPassword: "WrongPass!2026",
      newPassword: "AnotherPass!2027",
    },
  });

  assert.equal(wrongCurrent.status, 401);
  assert.equal(wrongCurrent.data?.error, "INVALID_CREDENTIALS");

  const changed = await apiRequest("/api/mobile/auth/change-password", {
    method: "POST",
    token: sharedToken,
    body: {
      currentPassword: TEST_USER_PASSWORD,
      newPassword: TEST_USER_NEW_PASSWORD,
    },
  });

  assert.equal(changed.status, 200);

  const oldPasswordLogin = await apiRequest("/api/mobile/auth/login", {
    method: "POST",
    body: {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    },
  });

  assert.equal(oldPasswordLogin.status, 401);

  const newPasswordLogin = await apiRequest("/api/mobile/auth/login", {
    method: "POST",
    body: {
      email: TEST_USER_EMAIL,
      password: TEST_USER_NEW_PASSWORD,
    },
  });

  assert.equal(newPasswordLogin.status, 200);
  assert.ok(newPasswordLogin.data?.token);
});

test("mobile logout invalidates current token", async () => {
  const loginResult = await apiRequest("/api/mobile/auth/login", {
    method: "POST",
    body: {
      email: TEST_USER_EMAIL,
      password: TEST_USER_NEW_PASSWORD,
    },
  });

  assert.equal(loginResult.status, 200);
  const token = loginResult.data?.token;
  assert.ok(token, "Expected token from login before logout");

  const logoutResult = await apiRequest("/api/mobile/auth/logout", {
    method: "POST",
    token,
  });

  assert.equal(logoutResult.status, 200);

  const meAfterLogout = await apiRequest("/api/mobile/auth/me", {
    token,
  });

  assert.equal(meAfterLogout.status, 401);
  assert.equal(meAfterLogout.data?.error, "INVALID_TOKEN");
});
