"use client";

import { useEffect, useRef, useState } from "react";
import { Botao } from "@/components/Botao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { rotular, SITUACAO_CLIENTE_VOLTOU_LABEL } from "@/lib/labels";
import { vincularLeadRetornoNoInbox } from "@/server/inbox/acoes-cliente-voltou";
import type { ClienteVoltouPainel } from "@/server/inbox/painel-detalhes";
import { hrefNovaOportunidade } from "./OutrasOportunidades";

type Props = {
  atendimentoId: string; nome: string; pessoaId: string | null;
  dado: ClienteVoltouPainel;
  podeCriar: boolean; aoMudar(): void;
};

export function ClienteVoltou(props: Props) {
  const chave = JSON.stringify([props.atendimentoId, props.pessoaId, props.dado.oportunidadeId, props.dado.contatoId, props.dado.podeVincular, props.podeCriar]);
  return <SessaoClienteVoltou key={chave} {...props} />;
}

function SessaoClienteVoltou({ atendimentoId, nome, pessoaId, dado, podeCriar, aoMudar }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const viva = useRef(true);
  useEffect(() => { viva.current = true; return () => { viva.current = false; }; }, []);
  const primeiroNome = nome.trim().split(/\s+/)[0] || "Este contato";
  const tituloCurto = dado.titulo.split(" · ")[0];
  return <section aria-label="Cliente voltou" className="space-y-2 rounded-md border border-brand-200 bg-brand-50 p-3 text-sm">
    <p>{primeiroNome} já é cliente e voltou a escrever. A oportunidade {dado.titulo} foi {rotular(SITUACAO_CLIENTE_VOLTOU_LABEL, dado.situacao).toLocaleLowerCase("pt-BR")}.</p>
    <div className="flex flex-wrap items-center gap-2">
      {dado.podeVincular && <Botao variante="secundario" tamanho="md" onClick={() => setConfirmando(true)}>Vincular a {tituloCurto}</Botao>}
      {podeCriar && pessoaId && <a href={hrefNovaOportunidade(pessoaId)} className="text-brand-700 underline">Nova oportunidade</a>}
    </div>
    {confirmando && dado.podeVincular && <ConfirmarAcao
      titulo={`Vincular esta conversa a ${dado.titulo}?`}
      confirmacao="vínculo"
      idempotente={false}
      acao={() => vincularLeadRetornoNoInbox({ contatoId: dado.contatoId, atendimentoId, alvo: { tipo: "lead", id: dado.oportunidadeId } })}
      aoConcluir={() => { if (!viva.current) return; setConfirmando(false); aoMudar(); }}
      aoCancelar={() => { if (viva.current) setConfirmando(false); }}
    >
      <p>Este contato e o atendimento selecionado passam a ficar ligados a <strong>{dado.titulo}</strong>. O histórico da conversa e as próximas mensagens deste número aparecem no cadastro.</p>
      <p>Para desfazer um vínculo errado, a administração ou o gerente do setor usa “Desvincular”, com motivo registrado.</p>
    </ConfirmarAcao>}
  </section>;
}
