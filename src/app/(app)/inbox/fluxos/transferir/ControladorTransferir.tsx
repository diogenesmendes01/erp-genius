"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Botao } from "@/components/Botao";
import { PopoverFluxo } from "../PopoverFluxo";
import { PopoverTransferir, type PropsPopoverTransferir } from "./PopoverTransferir";
import { useTransferirConversa } from "./useTransferirConversa";
import type { Resultado } from "@/server/_shared/resultado";
import type { OpcoesTransferir } from "./opcoes-transferir";
import type { ComandoTransferirInbox } from "./useTransferirConversa";
import type { AcaoConversa } from "../../MenuConversa";
interface Props {
  atendimentoId: string; identidade: string; responsavelAtualId: string | null; opcoes: OpcoesTransferir;
  destinos: PropsPopoverTransferir["destinos"];
  executar(comando: ComandoTransferirInbox): Promise<Resultado>;
  carregarPessoas(id: string): Promise<{ id: string; nome: string }[]>;
  aoConcluir(): void;
  renderizar(controles: { transferir: AcaoConversa | null; dialogo: ReactNode }): ReactNode;
}
/** Fronteira local; o coordenador da conversa fornece actions autorizadas, sem política paralela. */
export function ControladorTransferir(props: Props) {
  const { atendimentoId, identidade, responsavelAtualId, opcoes, destinos, executar, carregarPessoas, aoConcluir, renderizar } = props;
  const identidadeAtual = JSON.stringify([identidade, responsavelAtualId]);
  const controle = useTransferirConversa({ atendimentoId, identidade: identidadeAtual, opcoes, executar, aoConcluir });
  const chave = JSON.stringify([atendimentoId, identidadeAtual, opcoes, controle.aberturaId]);
  const [pessoas, setPessoas] = useState<{ chave: string; lista: { id: string; nome: string }[]; erro: string | null } | null>(null);
  const invalidada = controle.invalidada;
  const aberto = controle.aberto;
  useEffect(() => {
    if (!aberto || invalidada || !opcoes.pessoas) return;
    let viva = true;
    void carregarPessoas(atendimentoId).then(lista => {
      if (viva) setPessoas({ chave, lista, erro: null });
    }).catch(() => { if (viva) setPessoas({ chave, lista: [], erro: "Não foi possível carregar as pessoas. Feche e tente novamente." }); });
    return () => { viva = false; };
  }, [atendimentoId, carregarPessoas, chave, aberto, invalidada, opcoes.pessoas]);
  const dados = pessoas?.chave === chave ? pessoas : null;
  const dialogo = !aberto ? null : invalidada ? <PopoverFluxo titulo="Transferir" ancora={controle.ancora} aoFechar={controle.fechar} ocupado={controle.ocupado}>
    <p className="text-sm text-gray-600">A conversa ou suas permissões mudaram. Feche e abra novamente para transferir.</p>
    <div className="mt-3 flex justify-end"><Botao variante="secundario" disabled={controle.ocupado} onClick={controle.fechar}>Fechar</Botao></div>
  </PopoverFluxo> : <PopoverTransferir atendimentoId={atendimentoId} ancora={controle.ancora} opcoes={opcoes} pessoas={dados ? dados.lista.filter(p => p.id !== responsavelAtualId) : null} destinos={destinos} ocupado={controle.ocupado} erro={controle.erro ?? dados?.erro} aoFechar={controle.fechar} aoExecutar={entrada => void controle.confirmar(entrada)} />;
  return renderizar({ transferir: opcoes.visivel ? { rotulo: "Transferir", gatilhoRef: controle.gatilhoRef, aoEscolher: controle.abrir, ocupado: controle.ocupado } : null, dialogo });
}
