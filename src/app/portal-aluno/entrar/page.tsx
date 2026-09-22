"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function EntrarPortalAlunoPage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null); setEnviando(true);
    const form = new FormData(evento.currentTarget);
    try {
      const resposta = await fetch("/api/portal-aluno/sessao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), senha: form.get("senha") }),
      });
      if (!resposta.ok) throw new Error();
      router.replace("/portal-aluno"); router.refresh();
    } catch { setErro("Não foi possível entrar com essas credenciais."); }
    finally { setEnviando(false); }
  }

  return <section className="mx-auto flex min-h-screen max-w-md items-center px-5"><div className="w-full rounded-xl border bg-surface p-7">
    <p className="text-sm text-brand-700">Genius Idiomas</p><h1 className="mt-1 text-2xl font-medium">Área de reposições</h1>
    <p className="mt-2 text-sm text-gray-600">Entre com o e-mail individual confirmado no seu convite.</p>
    <form onSubmit={entrar} className="mt-6 space-y-4">
      <label className="block text-sm">E-mail<input required name="email" type="email" autoComplete="email" className="mt-1 w-full rounded border px-3 py-2" /></label>
      <label className="block text-sm">Senha<input required name="senha" type="password" autoComplete="current-password" className="mt-1 w-full rounded border px-3 py-2" /></label>
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      <button disabled={enviando} className="w-full rounded bg-brand-solid px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{enviando ? "Entrando…" : "Entrar"}</button>
    </form>
    <Link href="/portal-aluno/recuperar" className="mt-5 block text-sm text-brand-700 underline">Não consigo acessar meu e-mail ou senha</Link>
  </div></section>;
}
