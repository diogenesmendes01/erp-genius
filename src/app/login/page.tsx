"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { IconSchool } from "@tabler/icons-react";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});
type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Form) {
    setErro(null);
    const res = await signIn("credentials", { ...data, redirect: false });
    if (res?.error) {
      setErro("E-mail ou senha incorretos.");
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-surface p-8">
        <div className="mb-6 flex items-center gap-2 text-lg font-medium">
          <IconSchool className="h-6 w-6 text-brand-600" />
          ERP Genius
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <label htmlFor="login-email" className="mb-1 block text-sm text-gray-600">E-mail</label>
            <input
              {...register("email")}
              id="login-email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "login-email-erro" : undefined}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            {/* Sempre montado e visível: região aria-live precisa existir antes do texto mudar (display:none a tira da árvore).
                Vazio, só a margem sai (empty:mt-0) — sem espaço sobrando e sem esconder a região. */}
            <p id="login-email-erro" aria-live="polite" className="mt-1 text-xs text-red-600 empty:mt-0">{errors.email?.message}</p>
          </div>

          <div>
            <label htmlFor="login-senha" className="mb-1 block text-sm text-gray-600">Senha</label>
            <input
              {...register("senha")}
              id="login-senha"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.senha ? true : undefined}
              aria-describedby={errors.senha ? "login-senha-erro" : undefined}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <p id="login-senha-erro" aria-live="polite" className="mt-1 text-xs text-red-600 empty:mt-0">{errors.senha?.message}</p>
          </div>

          {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 rounded-md bg-brand-solid px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
          >
            {isSubmitting ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
