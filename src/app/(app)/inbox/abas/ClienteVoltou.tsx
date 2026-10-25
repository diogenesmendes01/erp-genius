"use client";

import { useEffect, useRef } from "react";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { rotular, SITUACAO_CLIENTE_VOLTOU_LABEL } from "@/lib/labels";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { vincularContatoWhatsApp } from "@/server/whatsapp/acoes";
import type { ClienteVoltouPainel } from "@/server/inbox/painel-detalhes";
import { hrefNovaOportunidade } from "./OutrasOportunidades";

type Props = {
  atendimentoId: string; nome: string; pessoaId: string | null;
  dado: ClienteVoltouPainel;
  podeCriar: boolean; aoMudar(): void;
};

/** Cada troca de identidade ou de alçada desmonta o executor e invalida seu ACK. */
export function ClienteVoltou(props: Props) {
  const chave = JSON.stringify([props.atendimentoId, props.pessoaId, props.dado.oportunidadeId, props.dado.contatoId, props.dado.podeVincular, props.podeCriar]);
  return <SessaoClienteVoltou key={chave} {...props} />;
}

function SessaoClienteVoltou({ atendimentoId, nome, pessoaId, dado, podeCriar, aoMudar }: Props) {
  const acao = useAcaoCliente({ idempotente: false });
  const viva = useRef(true);
  useEffect(() => { viva.current = true; return () => { viva.current = false; }; }, []);
  async function vincular() {
    if (!dado.podeVincular) return;
    const r = await acao.executar(() => vincularContatoWhatsApp({ contatoId: dado.contatoId, atendimentoId, alvo: { tipo: "lead", id: dado.oportunidadeId } }));
    if (viva.current && r?.tipo === "ok") aoMudar();
  }
  const primeiroNome = nome.trim().split(/\s+/)[0] || "Este contato";
  const tituloCurto = dado.titulo.split(" · ")[0];
  return <section aria-label="Cliente voltou" className="space-y-2 rounded-md border border-brand-200 bg-brand-50 p-3 text-sm">
    <p>{primeiroNome} já é cliente e voltou a escrever. A oportunidade {dado.titulo} foi {rotular(SITUACAO_CLIENTE_VOLTOU_LABEL, dado.situacao).toLocaleLowerCase("pt-BR")}.</p>
    <div className="flex flex-wrap items-center gap-2">
      {dado.podeVincular && <Botao variante="secundario" tamanho="md" disabled={acao.ocupado} onClick={vincular}>{acao.ocupado ? "Vinculando…" : `Vincular a ${tituloCurto}`}</Botao>}
      {podeCriar && pessoaId && <a href={hrefNovaOportunidade(pessoaId)} className="text-brand-700 underline">Nova oportunidade</a>}
    </div>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </section>;
}
