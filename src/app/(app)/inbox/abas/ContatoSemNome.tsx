"use client";

import { useEffect, useRef, useState } from "react";
import { IconUserX } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { editarNomeContatoWhatsApp } from "@/server/whatsapp/acoes";

export type PropsContatoSemNome = { atendimentoId: string; nomeAnterior: string | null; podeEditar: boolean; aoMudar(): void };
export function ContatoSemNome(props: PropsContatoSemNome) { return <NomeDoAtendimento key={props.atendimentoId} {...props} />; }
function NomeDoAtendimento({ atendimentoId, nomeAnterior, podeEditar, aoMudar }: PropsContatoSemNome) {
  const [nome, setNome] = useState(nomeAnterior ?? ""); const acao = useAcaoCliente({ idempotente: false });
  const vivo = useRef(false), revisao = useRef(0), baseAnterior = useRef(nomeAnterior);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  async function salvar(e: { preventDefault(): void }) {
    e.preventDefault(); if (!podeEditar || acao.ocupado) return;
    if (!nome.trim()) { acao.setErro("Digite o nome"); return; }
    const versao = revisao.current, enviado = nome;
    const d = await acao.executar(() => editarNomeContatoWhatsApp({ atendimentoId, nome: enviado, nomeAnterior: baseAnterior.current }));
    if (d?.tipo === "ok" && vivo.current && revisao.current === versao) { baseAnterior.current = enviado.trim(); aoMudar(); }
  }
  return <div className="mx-[18px] my-4 rounded border border-dashed border-gray-200 p-3 text-sm">
    <p className="flex items-start gap-2 text-gray-600"><IconUserX size={18} className="shrink-0" aria-hidden /><span>Contato sem nome, criado pelo telefone.{podeEditar && " Você pode preencher agora."}</span></p>
    {podeEditar && <form className="mt-3 space-y-2" onSubmit={e => void salvar(e)}>
      <input aria-label="Nome do contato" placeholder="Nome do contato" value={nome} maxLength={80} disabled={acao.ocupado} onChange={e => { if (acao.ocupado) return; revisao.current++; setNome(e.target.value); }} className="min-h-11 w-full rounded border border-gray-200 bg-surface px-3 py-2 text-sm" />
      <Botao type="submit" tamanho="sm" ocupado={acao.ocupado}>Salvar</Botao>
      <FeedbackAcao erro={acao.erro} />
    </form>}
  </div>;
}
