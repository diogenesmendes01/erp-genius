"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function RecuperarPortalAlunoPage() {
  const [enviado, setEnviado] = useState(false); const [enviando, setEnviando] = useState(false);
  async function solicitar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); setEnviando(true);
    const form = new FormData(evento.currentTarget);
    try { await fetch("/api/portal-aluno/recuperacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email") }) }); }
    finally { setEnviando(false); setEnviado(true); }
  }
  return <section className="mx-auto flex min-h-screen max-w-md items-center px-5"><div className="w-full rounded-xl border bg-surface p-7">
    <h1 className="text-2xl font-medium">Recuperar acesso</h1>
    {enviado ? <p className="mt-4 text-sm text-gray-700">Se houver uma conta ativa para este endereço, a escola preparará a recuperação. Se você perdeu o e-mail, procure a Secretaria para o procedimento assistido.</p> : <form onSubmit={solicitar} className="mt-5 space-y-4">
      <p className="text-sm text-gray-600">Informe seu e-mail individual. A resposta não confirma se há conta.</p>
      <label className="block text-sm">E-mail<input required name="email" type="email" autoComplete="email" className="mt-1 w-full rounded border px-3 py-2" /></label>
      <button disabled={enviando} className="w-full rounded bg-brand-solid px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{enviando ? "Solicitando…" : "Solicitar recuperação"}</button>
    </form>}
    <Link href="/portal-aluno/entrar" className="mt-5 block text-sm text-brand-700 underline">Voltar ao acesso</Link>
  </div></section>;
}
