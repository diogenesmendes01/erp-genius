import type { Papel } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      papeis?: Papel[];
    };
  }
  interface User {
    papeis?: Papel[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    papeis?: Papel[];
  }
}
