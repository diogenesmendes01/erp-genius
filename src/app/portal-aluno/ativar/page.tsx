"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AtivarPortalAlunoPage() {
  const router = useRouter();
  const token = useRef(""); const [erro, setErro] = useState<string | null>(null); const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    const valor = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    token.current = valor;
    // O segredo vive no fragmento, que não alcança logs HTTP, e some da barra.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); setErro(null); setEnviando(true);
    const form = new FormData(evento.currentTarget);
    try {
      if (!token.current) throw new Error();
      const resposta = await fetch("/api/portal-aluno/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, senha: form.get("senha") }) });
      if (!resposta.ok) throw new Error();
      const corpo = await resposta.json() as { situacao?: string };
      if (corpo.situacao === "EMAIL_VALIDADO") { setErro("E-mail validado. Aguarde a decisão da Administração."); return; }
      router.replace("/portal-aluno"); router.refresh();
    } catch { setErro("Este link não está disponível. Solicite novo acesso à escola."); }
    finally { setEnviando(false); }
  }
  return <section className="mx-auto flex min-h-screen max-w-md items-center px-5"><div className="w-full rounded-xl border bg-surface p-7"><h1 className="text-2xl font-medium">Definir senha</h1><p className="mt-2 text-sm text-gray-600">Crie uma senha que só você conhece.</p><form onSubmit={confirmar} className="mt-5 space-y-4"><label className="block text-sm">Nova senha<input required minLength={12} maxLength={72} name="senha" type="password" autoComplete="new-password" className="mt-1 w-full rounded border px-3 py-2" /></label>{erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}<button disabled={enviando} className="w-full rounded bg-brand-solid px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{enviando ? "Confirmando…" : "Confirmar acesso"}</button></form></div></section>;
}
