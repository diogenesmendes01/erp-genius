import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const senha = credentials?.senha as string | undefined;
        if (!email || !senha) return null;

        const user = await prisma.usuario.findUnique({ where: { email } });
        if (!user || !user.ativo) return null;

        const ok = await bcrypt.compare(senha, user.senhaHash);
        if (!ok) return null;

        await prisma.usuario.update({
          where: { id: user.id },
          data: { ultimoAcesso: new Date() },
        });

        return {
          id: user.id,
          name: user.nome,
          email: user.email,
          papeis: user.papeis,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.papeis = (user as { papeis?: string[] }).papeis ?? [];
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { papeis?: string[] }).papeis =
          (token.papeis as string[]) ?? [];
      }
      return session;
    },
  },
});
