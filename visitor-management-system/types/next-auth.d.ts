import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
    gateIds: string[];
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      gateIds: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    gateIds?: string[];
  }
}
