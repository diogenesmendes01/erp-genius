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
    /** Prazo do JWT da requisição, em ms desde a época (de `token.exp`); ver `prazoDoToken`. */
    expiraEm?: number | null;
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
