import { z } from "zod";

const mongoEnvSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required."),
  MONGODB_DB_NAME: z.string().min(1).default("parking_app"),
});

const originSchema = z.string().url();

type MongoEnv = z.infer<typeof mongoEnvSchema>;

let cachedMongoEnv: MongoEnv | null = null;
let cachedOrigin: string | undefined;

export function getMongoEnv(): MongoEnv {
  if (cachedMongoEnv) {
    return cachedMongoEnv;
  }

  const parsedEnv = mongoEnvSchema.safeParse({
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
  });

  if (!parsedEnv.success) {
    const issues = parsedEnv.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment variables: ${issues}`);
  }

  cachedMongoEnv = parsedEnv.data;
  return cachedMongoEnv;
}

export function getAppOrigin(): string | undefined {
  if (cachedOrigin !== undefined) {
    return cachedOrigin;
  }

  const rawOrigin = process.env.APP_ORIGIN;
  if (!rawOrigin) {
    cachedOrigin = undefined;
    return cachedOrigin;
  }

  const parsedOrigin = originSchema.safeParse(rawOrigin);
  if (!parsedOrigin.success) {
    throw new Error("APP_ORIGIN must be a valid URL when provided.");
  }

  cachedOrigin = parsedOrigin.data;
  return cachedOrigin;
}
