import sharp from "sharp";
import { put } from "@vercel/blob";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Selfie ingestion pipeline. The Base64 the client sends is NEVER stored as-is:
// we decode it, verify it's a real JPEG, re-encode with sharp (which normalises
// orientation, strips EXIF/metadata, caps dimensions, and defuses polyglot/SVG
// payloads), then upload the clean bytes to object storage — the DB keeps only URL.
const MAX_DIM = 480;
const JPEG_QUALITY = 70;

const hasBlob = Boolean(
  process.env.BLOB_READ_WRITE_TOKEN &&
    !process.env.BLOB_READ_WRITE_TOKEN.includes("placeholder")
);

export async function uploadSelfie(dataUrl: string): Promise<string> {
  const base64 = dataUrl.split(",")[1] ?? "";
  const raw = Buffer.from(base64, "base64");

  // Magic-byte check — a JPEG always starts with FF D8 FF.
  if (raw.length < 3 || raw[0] !== 0xff || raw[1] !== 0xd8 || raw[2] !== 0xff) {
    throw new Error("Payload is not a JPEG image");
  }

  const clean = await sharp(raw)
    .rotate() // bake in EXIF orientation before we strip metadata
    .resize(MAX_DIM, MAX_DIM, { fit: "cover" })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  const key = `selfies/${randomBytes(16).toString("hex")}.jpg`;

  if (hasBlob) {
    const { url } = await put(key, clean, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: true, // extra non-guessability on top of the random key
    });
    return url;
  }

  // Dev fallback (no Blob token): write under public/uploads and serve locally.
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const file = `${randomBytes(16).toString("hex")}.jpg`;
  await writeFile(path.join(dir, file), clean);
  return `/uploads/${file}`;
}
