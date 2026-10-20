"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";

const MSG_CREDENCIAIS = "E-mail ou senha incorretos.";
// 422: corpo recusado (e-mail ou senha fora do tamanho aceito) ou falha ao abrir a sessão — a rota não
// distingue os dois. A mensagem cobre ambos sem dizer se a conta existe: o 422 sai antes de qualquer
// leitura da conta, ou por erro do servidor, nunca pela existência do e-mail.
const MSG_RECUSADO = "Não foi possível entrar com esses dados. Confira o e-mail e a senha e tente de novo; se continuar, tente mais tarde.";
// 403: a requisição não saiu do endereço do portal (aba antiga, endereço alternativo, extensão do navegador).
const MSG_ORIGEM = "Não foi possível confirmar de onde veio o acesso. Abra o portal pelo endereço oficial e tente de novo.";
const MSG_INDISPONIVEL = "O serviço está indisponível agora. Tente de novo em alguns minutos.";
const MSG_SEM_SERVIDOR = "Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.";

export default function EntrarPortalAlunoPage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // A troca de rota roda numa transição: `pendente` fica true até a navegação terminar, inclusive quando
  // ela termina na própria tela (cookie não gravado → a área do aluno redireciona de volta para cá).
  const [pendente, iniciarTransicao] = useTransition();

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null); setEnviando(true);
    const form = new FormData(evento.currentTarget);
    // docs/42 /portal-aluno/entrar #2 (#172): credencial recusada, serviço fora e rede caída dizem coisas
    // diferentes; antes tudo virava "credenciais", e o aluno redigitava a senha durante uma instabilidade.
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
      else setErro(MSG_INDISPONIVEL);
      return;
    }
    // Aceito: o botão continua desativado durante a troca de rota (`pendente`), para um segundo clique não
    // abrir outra sessão. `enviando` é liberado logo depois de iniciar a transição: se a navegação voltar
    // para esta mesma tela (a instância é preservada), o botão volta a ficar ativo em vez de preso em "Entrando…".
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
