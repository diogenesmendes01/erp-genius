"use client";
import { useEffect, useState, useId, type ReactNode } from "react";
import { observarPresencas } from "@/lib/presenca-inbox-cliente";
import type { FotoPresenca } from "@/server/inbox/presenca-leitura";
import { Botao } from "@/components/Botao";
import { PopoverFluxo } from "../PopoverFluxo";
import { PopoverTransferir, type PessoaTransferir, type PropsPopoverTransferir } from "./PopoverTransferir";
import { useTransferirConversa } from "./useTransferirConversa";
import type { Resultado } from "@/server/_shared/resultado";
import type { OpcoesTransferir } from "./opcoes-transferir";
import type { ComandoTransferirInbox } from "./useTransferirConversa";
import type { AcaoConversa } from "../../MenuConversa";
const semResumo = async () => false;
interface Props {
  atendimentoId: string; identidade: string; responsavelAtualId: string | null; opcoes: OpcoesTransferir;
  destinos: PropsPopoverTransferir["destinos"];
  executar(comando: ComandoTransferirInbox): Promise<Resultado>;
  carregarPessoas(id: string): Promise<PessoaTransferir[]>;
  carregarResumo?(id: string): Promise<boolean>;
  aoConcluir(mensagem: string): void;
  renderizar(controles: { transferir: AcaoConversa | null; dialogo: ReactNode }): ReactNode;
}
/** Fronteira local; o coordenador da conversa fornece actions autorizadas, sem política paralela. */
export function ControladorTransferir(props: Props) {
  const { atendimentoId, identidade, responsavelAtualId, opcoes, destinos, executar, carregarPessoas, carregarResumo = semResumo, aoConcluir, renderizar } = props;
  const identidadeAtual = JSON.stringify([identidade, responsavelAtualId]);
  const controle = useTransferirConversa({ atendimentoId, identidade: identidadeAtual, opcoes, executar, aoConcluir });
  const chave = JSON.stringify([atendimentoId, identidadeAtual, opcoes, controle.aberturaId]);
  const [pessoas, setPessoas] = useState<{ chave: string; lista: PessoaTransferir[]; temResumo: boolean; erro: string | null } | null>(null);
  const invalidada = controle.invalidada;
  const aberto = controle.aberto;
  const possuiSetores = opcoes.setores.length > 0;
  useEffect(() => {
    if (!aberto || invalidada || (!opcoes.pessoas && !possuiSetores)) return;
    let viva = true;
    void Promise.all([opcoes.pessoas ? carregarPessoas(atendimentoId) : Promise.resolve([]), possuiSetores ? carregarResumo(atendimentoId) : Promise.resolve(false)]).then(([lista, temResumo]) => {
      if (viva) setPessoas({ chave, lista, temResumo, erro: null });
    }).catch(() => { if (viva) setPessoas({ chave, lista: [], temResumo: false, erro: "Não foi possível carregar os dados da transferência. Feche e tente novamente." }); });
    return () => { viva = false; };
  }, [atendimentoId, carregarPessoas, carregarResumo, chave, aberto, invalidada, opcoes.pessoas, possuiSetores]);
  const tokenFoto = `${useId()}:${controle.aberturaId}`;
  const [foto, setFoto] = useState<{chave:string;dado:FotoPresenca|null}|null>(null);
  useEffect(()=>{
    if(!aberto||invalidada||!opcoes.pessoas)return;
    let viva=true;const sair=observarPresencas(atendimentoId,tokenFoto,dado=>{if(viva)setFoto({chave,dado});});
    return()=>{viva=false;sair();};
  },[aberto,invalidada,opcoes.pessoas,atendimentoId,tokenFoto,chave]);
  const presencas = foto?.chave===chave ? foto.dado : null;
  const dados = pessoas?.chave === chave ? pessoas : null;
  const dialogo = !aberto ? null : invalidada ? <PopoverFluxo titulo="Transferir" ancora={controle.ancora} aoFechar={controle.fechar} ocupado={controle.ocupado}>
    <p className="text-sm text-gray-600">A conversa ou suas permissões mudaram. Feche e abra novamente para transferir.</p>
    <div className="mt-3 flex justify-end"><Botao variante="secundario" disabled={controle.ocupado} onClick={controle.fechar}>Fechar</Botao></div>
  </PopoverFluxo> : <PopoverTransferir atendimentoId={atendimentoId} ancora={controle.ancora} opcoes={opcoes} pessoas={dados ? dados.lista.filter(p => p.id !== responsavelAtualId).map(p=>({...p,presenca:presencas?.pessoas.find(s=>s.usuarioId===p.id)?.status})) : null} destinos={destinos} temResumoAria={dados?.temResumo === true} ocupado={controle.ocupado} erro={controle.erro ?? dados?.erro} aoFechar={controle.fechar} aoExecutar={entrada => void controle.confirmar(entrada)} />;
  return renderizar({ transferir: opcoes.visivel ? { rotulo: "Transferir", gatilhoRef: controle.gatilhoRef, aoEscolher: controle.abrir, ocupado: controle.ocupado } : null, dialogo });
}
