import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginBloqueado, registrarFalhaLogin, limparFalhasLogin } from "@/lib/rate-limit-login";

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
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const senha = credentials?.senha as string | undefined;
        if (!email || !senha) return null;

        // Rate-limit por e-mail (ver lib/rate-limit-login): bloqueado responde igual a
        // credencial inválida, sem tocar o banco.
        if (loginBloqueado(email)) return null;

        const user = await prisma.usuario.findUnique({ where: { email } });
        if (!user || !user.ativo) {
          registrarFalhaLogin(email);
          return null;
        }

        const ok = await bcrypt.compare(senha, user.senhaHash);
        if (!ok) {
          registrarFalhaLogin(email);
          return null;
        }

        limparFalhasLogin(email);
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
      if (user) {
        token.sub = user.id ?? token.sub;
        token.papeis = (user as { papeis?: string[] }).papeis ?? [];
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
        (session.user as { papeis?: string[] }).papeis =
          (token.papeis as string[]) ?? [];
      }
      return session;
    },
  },
});
