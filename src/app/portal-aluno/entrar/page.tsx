"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";

const MSG_CREDENCIAIS = "E-mail ou senha incorretos.";
const MSG_RECUSADO = "Não foi possível entrar com esses dados. Confira o e-mail e a senha e tente de novo; se continuar, tente mais tarde.";
const MSG_ORIGEM = "Não foi possível confirmar de onde veio o acesso. Abra o portal pelo endereço oficial e tente de novo.";
const MSG_INDISPONIVEL = "O serviço está indisponível agora. Tente de novo em alguns minutos.";
// #536: só o código PORTAL_INDISPONIVEL do 503 do login aciona esta mensagem; o texto do corpo nunca é exibido nem comparado.
const MSG_PORTAL_INDISPONIVEL = "Portal temporariamente indisponível, procure a secretaria.";
const MSG_SEM_SERVIDOR = "Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.";

async function codigoDaResposta(resposta: Response): Promise<unknown> {
  try {
    const corpo: unknown = await resposta.json();
    return corpo && typeof corpo === "object" && "codigo" in corpo ? corpo.codigo : undefined;
  } catch { return undefined; }
}

export default function EntrarPortalAlunoPage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pendente, iniciarTransicao] = useTransition();

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null); setEnviando(true);
    const form = new FormData(evento.currentTarget);
    let resposta: Response;
    try {
      resposta = await fetch("/api/portal-aluno/sessao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), senha: form.get("senha") }),
      });
    } catch {
      setErro(MSG_SEM_SERVIDOR); setEnviando(false);
      return;
    }
    if (!resposta.ok) {
      setEnviando(false);
      if (resposta.status === 401) setErro(MSG_CREDENCIAIS);
      else if (resposta.status === 422) setErro(MSG_RECUSADO);
      else if (resposta.status === 403) setErro(MSG_ORIGEM);
      else if (resposta.status === 503 && await codigoDaResposta(resposta) === "PORTAL_INDISPONIVEL") setErro(MSG_PORTAL_INDISPONIVEL);
      else setErro(MSG_INDISPONIVEL);
      return;
    }
    iniciarTransicao(() => { router.replace("/portal-aluno"); router.refresh(); });
    setEnviando(false);
  }

  return <section className="mx-auto flex min-h-screen max-w-md items-center px-5"><div className="w-full rounded-xl border bg-surface p-7">
    <p className="text-sm text-brand-700">Genius Idiomas</p><h1 className="mt-1 text-2xl font-medium">Área de reposições</h1>
    <p className="mt-2 text-sm text-gray-600">Entre com o e-mail individual confirmado no seu convite.</p>
    <form onSubmit={entrar} className="mt-6 space-y-4">
      <label className="block text-sm">E-mail<input required name="email" type="email" autoComplete="email" className="mt-1 w-full rounded border px-3 py-2" /></label>
      <label className="block text-sm">Senha<input required name="senha" type="password" autoComplete="current-password" className="mt-1 w-full rounded border px-3 py-2" /></label>
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      <Botao type="submit" tamanho="lg" className="w-full" disabled={enviando || pendente}>{enviando || pendente ? "Entrando…" : "Entrar"}</Botao>
    </form>
    <Link href="/portal-aluno/recuperar" className="mt-5 block text-sm text-brand-700 underline">Não consigo acessar meu e-mail ou senha</Link>
  </div></section>;
}
