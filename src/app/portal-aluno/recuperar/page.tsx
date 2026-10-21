"use client";

import type { FormEvent } from "react";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { VoltarPara } from "@/components/VoltarPara";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { MSG_RECUPERACAO_INCERTA } from "@/lib/mensagens";
import { pedirRecuperacaoPortalAluno } from "../requisicoes";

// Pedido de recuperação de acesso do portal (docs/42 /portal-aluno/recuperar #1, #3 e #4; docs/43 §6 item 8).
// Antes, o `finally` dizia "enviado" mesmo quando o pedido nem chegava ao servidor. Agora só a resposta aceita
// mostra a confirmação; recusa e falha de rede viram alerta e o formulário fica preenchido para repetir. A
// confirmação é a mesma para qualquer e-mail: nunca diz se há conta com aquele endereço.

const MSG_PEDIDO_REGISTRADO = "Pedido registrado. Se houver uma conta ativa para este endereço, a escola vai preparar a recuperação e mandar as instruções para ele. Não recebeu? Confira a caixa de spam ou procure a Secretaria para o procedimento assistido.";

export default function RecuperarPortalAlunoPage() {
  const acao = useAcaoCliente({ idempotente: false });

  async function solicitar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const email = String(new FormData(evento.currentTarget).get("email") ?? "").trim();
    const desfecho = await acao.executar(() => pedirRecuperacaoPortalAluno(email), MSG_PEDIDO_REGISTRADO);
    if (desfecho?.tipo === "incerto") acao.setErro(MSG_RECUPERACAO_INCERTA);
  }

  return <section className="mx-auto flex min-h-screen max-w-md items-center px-5"><div className="w-full rounded-xl border bg-surface p-7">
    <h1 className="text-2xl font-medium">Recuperar acesso</h1>
    {/* A região do resultado fica montada antes do envio (o leitor de tela anuncia a confirmação). */}
    {!acao.sucesso && <form onSubmit={solicitar} className="mt-5 space-y-4">
      <p className="text-sm text-gray-600">Informe seu e-mail individual. Por segurança, a resposta é a mesma havendo ou não uma conta com esse endereço.</p>
      <Campo rotulo="E-mail" obrigatorio id="recuperar-email">
        {(campo) => <input {...campo} required name="email" type="email" autoComplete="email" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />}
      </Campo>
      <Botao type="submit" tamanho="lg" className="w-full" disabled={acao.ocupado}>{acao.ocupado ? "Solicitando…" : "Solicitar recuperação"}</Botao>
    </form>}
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mt-4" />
    <VoltarPara href="/portal-aluno/entrar" />
  </div></section>;
}
