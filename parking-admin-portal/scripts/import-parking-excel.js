const path = require("path");
const xlsx = require("xlsx");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");
const argon2 = require("argon2");

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const EXCEL_PATH = path.join(process.cwd(), "data", "Car Parking details.xlsx");
const DB_NAME = process.env.MONGODB_DB_NAME || "parking_app";
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI not found in .env.local");
}

const SHEET_COLOR_MAP = {
  "Green Sticker S4": "green",
  "Red Sticker S4": "red",
  "Blue Sticker E4": "blue",
};

function cleanName(name) {
  if (!name) return "";
  return String(name)
    .replace(/\b(DR|DR\.|MS|MS\.|MR|MR\.|MRS|MRS\.|PROF|PROF\.)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseWord(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function normalizePlate(plate) {
  if (!plate) return "";
  return String(plate).toUpperCase().replace(/\s+/g, "").trim();
}

function generateEmail(name, usedEmails) {
  const parts = cleanName(name)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((p) => p.replace(/[^a-z]/g, ""));

  let base;
  if (parts.length >= 2) {
    base = `${parts[0]}.${parts[1]}`;
  } else if (parts.length === 1) {
    base = parts[0];
  } else {
    base = "user";
  }

  let email = `${base}@thapar.edu`;
  let counter = 2;

  while (usedEmails.has(email)) {
    email = `${base}${counter}@thapar.edu`;
    counter += 1;
  }

  usedEmails.add(email);
  return email;
}

function generatePassword(name) {
  const parts = cleanName(name)
    .split(" ")
    .filter(Boolean)
    .map((p) => p.replace(/[^a-zA-Z]/g, ""));

  const formatted = parts.map(titleCaseWord).join("") || "User";
  return `${formatted}@123`;
}

async function main() {
  const workbook = xlsx.readFile(EXCEL_PATH);
  const client = new MongoClient(MONGODB_URI);

  await client.connect();
  const db = client.db(DB_NAME);
  const usersCollection = db.collection("users");

  const groupedUsers = new Map();

  for (const sheetName of workbook.SheetNames) {
    const stickerColor = SHEET_COLOR_MAP[sheetName];
    if (!stickerColor) continue;

    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    for (const row of rows) {
      const rawName = row["NAME"];
      const rawPlate = row["VEH.NO."];

      const name = cleanName(rawName);
      const plateNumber = normalizePlate(rawPlate);

      if (!name || !plateNumber) continue;

      const key = name.toLowerCase();

      if (!groupedUsers.has(key)) {
        groupedUsers.set(key, {
          name,
          allowedCars: [],
        });
      }

      const user = groupedUsers.get(key);

      const exists = user.allowedCars.some(
        (car) =>
          car.plateNumber === plateNumber && car.stickerColor === stickerColor,
      );

      if (!exists) {
        user.allowedCars.push({
          plateNumber,
          stickerColor,
        });
      }
    }
  }

  const existingUsers = await usersCollection
    .find({}, { projection: { email: 1 } })
    .toArray();

  const usedEmails = new Set(
    existingUsers
      .map((u) => String(u.email || "").toLowerCase())
      .filter(Boolean),
  );

  let inserted = 0;
  let updated = 0;

  for (const [, userData] of groupedUsers) {
    const existing = await usersCollection.findOne({ name: userData.name });

    if (existing) {
      await usersCollection.updateOne(
        { _id: existing._id },
        {
          $set: {
            allowedCars: userData.allowedCars,
            parkingEligible: true,
            isActive: true,
            updatedAt: new Date(),
          },
        },
      );
      updated += 1;
    } else {
      const email = generateEmail(userData.name, usedEmails);
      const plainPassword = generatePassword(userData.name);
      const passwordHash = await argon2.hash(plainPassword);

      await usersCollection.insertOne({
        name: userData.name,
        email,
        passwordHash,
        role: "user",
        isActive: true,
        parkingEligible: true,
        eligibleFrom: null,
        eligibleTill: null,
        allowedCars: userData.allowedCars,
        failedLoginAttempts: 0,
        lockUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`${userData.name} -> ${email} | ${plainPassword}`);
      inserted += 1;
    }
  }

  console.log(`Import complete.`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);

  await client.close();
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
