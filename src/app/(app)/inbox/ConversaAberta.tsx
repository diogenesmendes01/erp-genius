"use client";
import {intercalarFio,instanteDoItemFio} from "@/components/conversa/intercalar-fio";
import {CartaoTarefaDoInbox} from "./CartaoTarefaDoInbox";
import type {TarefaPainel} from "@/server/inbox/painel-tarefas";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Papel, StatusAtendimentoWhatsApp } from "@prisma/client";
import { IconChevronLeft, IconLayoutSidebarRight, IconArrowsExchange } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import { EsqueletoThread } from "@/components/Esqueleto";
import { BotaoIcone } from "@/components/BotaoIcone";
import { BalaoMensagem, type ComandoMensagem } from "@/components/conversa/BalaoMensagem";
import { itensDaThread, decorarThread, autorDoItem, notaComoMensagem } from "@/components/conversa/itens-thread";
import { useAgoraDaThread } from "@/components/conversa/agora-thread";
import { EventoSistema } from "@/components/conversa/EventoSistema";
import { SeparadorDia } from "@/components/conversa/SeparadorDia";
import { MOTIVO_SEM_ENVIO } from "@/components/conversa/Compositor";
import type { PublicarPortaRascunhoInsight } from "@/components/conversa/rascunho-insight";
import { VirtualList } from "@/components/conversa/VirtualList";
import type { RecursoMotor } from "@/components/conversa/recursos-canal";
import type { ConversaHook } from "@/components/conversa/useConversa";
import { SETOR_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { intercalarSugestoes } from "./aria/intercalar";
import { CartaoSugestaoAria } from "./aria/CartaoSugestaoAria";

import { ControladorTransferir } from "./fluxos/transferir/ControladorTransferir";
import { opcoesTransferir } from "./fluxos/transferir/opcoes-transferir";
import { carregarPessoasTransferir, carregarResumoTransferir, executarTransferenciaInbox } from "./fluxos/transferir/acoes-transferir";
import { ControladorDevolverAria, type ControlesDevolverAria } from "./aria/BotaoDevolverAria";
import { linhaEstadoAria, type LinhaEstadoAria } from "./aria/textos-aria";
import type { AriaDoAtendimento } from "@/server/whatsapp/consultas-inbox";
import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";
import { enviarMidiaInbox, enviarTextoInbox } from "@/server/whatsapp/acoes";
import { respostasRapidasDoCompositor } from "@/server/crm-config/acoes-respostas";
import { enviarPropostaNoAtendimento, registrarNotaAtendimento } from "@/server/whatsapp/acoes-conversa";
import { origemVisivelDaTransferencia, propostasDoAtendimento } from "@/server/whatsapp/consultas-acoes-atendimento";
import type { PropostaAnexavel } from "@/server/whatsapp/proposta-atendimento";
import type { Setor } from "@/server/whatsapp/setor";
import { useAcoesAtendimento, type DestinoTransferencia } from "./AcoesAtendimento";
import { useChavesPorAlvo } from "@/lib/chave-idempotencia";
import type { AcoesCabecalho } from "./MenuConversa";
import { useRevisoesRascunhos } from "@/components/conversa/rascunhos-conversa";
import { RodapeConversa } from "./RodapeConversa";
import { modoRodape, textoTravado } from "./aria/modo-rodape";
import { useAssumirParaResponder } from "./aria/useAssumirParaResponder";
import { useHandoffConversa, type LeituraPainelHandoff } from "./aria/useHandoffConversa";
import { CabecalhoConversa } from "./CabecalhoConversa";
import { BuscaConversa } from "./BuscaConversa";
import { useBuscaConversa } from "./useBuscaConversa";
import { AcoesMensagem, type AcaoMensagem } from "./AcoesMensagem";
import type { CandidatoMencao } from "@/lib/mencoes-nota";

import {useControladorAgendar} from "./fluxos/agendar/ControladorAgendar";
import type {IntencoesAgendamento} from "./fluxos/agendar/intencao-agendamento";
import type {PortaRascunhoAgendamento} from "@/components/conversa/porta-rascunho-agendamento";
import type {RespostaDoCompositor} from "@/components/conversa/respostas-rapidas";
import type {AgendadaNoFio} from "@/server/inbox/agendadas-leitura";
export interface ContextoCartoesNoFio{agora:Date;aoEditar?(agendada:AgendadaNoFio,origem?:HTMLElement):void}
export interface PropsConversaAberta {
  item: ItemListaInbox | null;
  tarefasNoFio?: TarefaPainel[];
  cartoesNoFio?(contexto:ContextoCartoesNoFio): ReactNode;
  aoCriarTarefa?: () => void;
  aoEditarTarefa?: (t:TarefaPainel) => void;
  pedidoNota?: number;
  versaoInsights?: number;
  podeUsarInsights?: boolean;
  aoPortaRascunhoInsight?: PublicarPortaRascunhoInsight;
  tarefaEmEdicaoId?: string | null;
  intencoesAgendamento?:IntencoesAgendamento;
  pedidoAgendamento?:string|null;
  aoPedidoAgendamentoConsumido?():void;
  podeLerAgendamento?:boolean;
  aria?: AriaDoAtendimento | null;
  leituraPainel?: LeituraPainelHandoff;
  bloquearDecisoesAria?: boolean;
  usuario: { id: string; papeis: Papel[]; nome?: string | null };
  fuso: string | null;
  agoraInicial?: number;
  conversa: ConversaHook;
  podeEnviar: boolean | null;
  falhaPermissao?: () => void;
  destinos?: DestinoTransferencia[];
  aoVoltar(): void;
  aoAlternarPainel(): void;
  painelAberto?: boolean;
  painelAuto?: boolean;
  aoMudar(): void;
  aoTransferirConcluido?(mensagem: string): void;
}

export function textoOrigem(setor: Setor | null): string | null {
  return setor ? `Transferido de ${rotular(SETOR_ATENDIMENTO_LABEL, setor)}` : null;
}

export const COMANDOS_MENSAGEM_LIGADOS: readonly ComandoMensagem[] = ["copiar", "reagir", "encaminhar", "editar", "apagar"];

const RECURSO_DO_COMANDO: Partial<Record<ComandoMensagem, RecursoMotor>> = { reagir: "reagir", encaminhar: "encaminhar", editar: "editar", apagar: "apagar" };

export function comandosDaMensagem(
  m: Pick<MensagemThread, "direcao" | "tipo" | "propria" | "apagada">, capacidades: readonly RecursoMotor[], podeEnviar: boolean,
): ComandoMensagem[] {
  return COMANDOS_MENSAGEM_LIGADOS.filter((c) => {
    const recurso = RECURSO_DO_COMANDO[c];
    if (!recurso) return true;
    if (!podeEnviar || m.apagada || !capacidades.includes(recurso)) return false;
    if (c === "editar") return m.propria === true && m.direcao === "SAIDA" && m.tipo === "TEXTO";
    if (c === "apagar") return m.propria === true && m.direcao === "SAIDA";
    return true;
  });
}

export function podeEnviarNaConversa(item: Pick<ItemListaInbox, "status">, podeEnviar: boolean | null): boolean | null {
  return item.status === "ENCERRADO" ? false : podeEnviar;
}

const TAREFAS_FIO_VAZIAS:TarefaPainel[]=[];
export function ConversaAberta({ item, tarefasNoFio=TAREFAS_FIO_VAZIAS, cartoesNoFio, aoCriarTarefa, aoEditarTarefa, pedidoNota, versaoInsights, podeUsarInsights=false, aoPortaRascunhoInsight, intencoesAgendamento, pedidoAgendamento, aoPedidoAgendamentoConsumido, podeLerAgendamento=false, tarefaEmEdicaoId, usuario, fuso, conversa, podeEnviar, falhaPermissao, destinos, aoVoltar, aoAlternarPainel, painelAberto, painelAuto, aoMudar, aoTransferirConcluido, agoraInicial, aria, leituraPainel, bloquearDecisoesAria = false }: PropsConversaAberta) {
  const [portaAgendamento,setPortaAgendamento]=useState<PortaRascunhoAgendamento|null>(null);
  const publicarPortaAgendamento=useCallback((p:PortaRascunhoAgendamento|null)=>setPortaAgendamento(p),[]);
  const tentativasNota = useChavesPorAlvo();
  const revisoesRascunhos = useRevisoesRascunhos();
  const rolagem = useRef<HTMLDivElement>(null);
  const atendimentoId = item?.id ?? null;
  const buscarMencoes = useCallback(async (busca: string, signal?: AbortSignal): Promise<CandidatoMencao[]> => {
    if (!atendimentoId) return [];
    const r = await fetch("/api/inbox/atendimentos/" + encodeURIComponent(atendimentoId) + "/mencoes?" + new URLSearchParams({ q: busca }), { credentials: "same-origin", cache: "no-store", signal });
    if (!r.ok) throw new Error("Não foi possível buscar pessoas.");
    return r.json();
  }, [atendimentoId]);
  const agora = useAgoraDaThread(conversa.mensagens, conversa.notas, item?.id ?? null, agoraInicial, tarefasNoFio);
  const origemId = item?.atendimentoOrigemId ?? null;
  const [origem, setOrigem] = useState<{ de: string; setor: Setor | null }>({ de: "", setor: null });
  useEffect(() => {
    if (!origemId) return;
    let ativo = true;
    void origemVisivelDaTransferencia(origemId).then((o) => { if (ativo) setOrigem({ de: origemId, setor: o?.setor ?? null }); }).catch(() => undefined);
    return () => { ativo = false; };
  }, [origemId]);
  const transferidoDe = origemId && origem.de === origemId && origem.setor ? rotular(SETOR_ATENDIMENTO_LABEL, origem.setor) : null;
  const janelaDesconhecida=!!(conversa.carregando||conversa.erro)&&!conversa.mensagens.length&&!(conversa.notas?.length);
  const itens=useMemo(()=>decorarThread(intercalarSugestoes(
    intercalarFio(itensDaThread(conversa.mensagens,conversa.notas??[],conversa.temMaisAntes,conversa.temMaisDepois),janelaDesconhecida?TAREFAS_FIO_VAZIAS:tarefasNoFio,{temMaisAntes:conversa.temMaisAntes,temMaisDepois:conversa.temMaisDepois}),
    instanteDoItemFio,aria?.cartoes??[],{inicioJanela:conversa.temMaisAntes?conversa.mensagens[0]?.criadoEm??null:null,fimJanela:conversa.temMaisDepois?conversa.mensagens.at(-1)?.criadoEm??null:null}),
    {fuso,agora:new Date(agora),transferidoDe}),[conversa.mensagens,conversa.notas,conversa.temMaisAntes,conversa.temMaisDepois,janelaDesconhecida,tarefasNoFio,aria?.cartoes,fuso,agora,transferidoDe]);
  const { aberta: buscaAberta, termo, atual: achadoAtual, achados, posicao, campoRef, abrir: abrirBusca, fechar: fecharBusca, aoMudar: mudarBusca, navegar: navegarBusca } = useBuscaConversa(item?.id ?? null, conversa.mensagens, rolagem, itens);
  const [acaoMensagem, setAcaoMensagem] = useState<{ acao: AcaoMensagem; m: MensagemThread; atendimentoId: string; numeroId: string } | null>(null);
  const [respostas, setRespostas] = useState<{ id: string; atalho: string; titulo: string; corpo: string }[]>([]);
  useEffect(() => {
    let ativo = true;
    void respostasRapidasDoCompositor().then((r) => { if (ativo) setRespostas(r); }).catch(() => undefined);
    return () => { ativo = false; };
  }, []);
  const propostasId = item && !item.grupo && item.finalidade === "COMERCIAL" ? item.id : null;
  const vinculoAtual = item?.vinculo ?? null;
  const [propostas, setPropostas] = useState<{ de: string; oportunidadeId: string | null; itens: PropostaAnexavel[] } | null>(null);
  useEffect(() => {
    if (!propostasId) return;
    let ativo = true;
    void propostasDoAtendimento(propostasId).then((r) => { if (ativo) setPropostas({ de: propostasId, oportunidadeId: r.oportunidadeId, itens: r.propostas }); }).catch(() => undefined);
    return () => { ativo = false; };
  }, [propostasId, vinculoAtual]);
  const propostasDaConversa = propostasId && propostas?.de === propostasId ? { oportunidadeId: propostas.oportunidadeId, itens: propostas.itens, fuso } : undefined;
  const capacidades = item?.capacidades ?? [];
  const envioLiberado = item ? podeEnviarNaConversa(item, podeEnviar) : false;
  const ocupada = conversa.carregando || conversa.carregandoAntigas || conversa.carregandoNovas;
  const cargaInicial = conversa.carregando && !conversa.mensagens.length && !(conversa.notas?.length);
  function focarAntesDaCarga() {
    if (buscaAberta && campoRef.current) campoRef.current.focus({ preventScroll: true });
    else rolagem.current?.closest<HTMLElement>('section[aria-label="Conversa"]')?.focus({ preventScroll: true });
  }

  const barraBusca = buscaAberta && <BuscaConversa termo={termo} aoMudar={mudarBusca} total={achados.length} posicao={posicao} campoRef={campoRef}
        aoAnterior={() => navegarBusca(-1)} aoProximo={() => navegarBusca(1)} aoFechar={fecharBusca}
        temMaisAntes={conversa.temMaisAntes} temMaisDepois={conversa.temMaisDepois} carregandoAntigas={conversa.carregandoAntigas} aoCarregarAntigas={() => {
          if (conversa.carregandoAntigas || !conversa.temMaisAntes) return;
          campoRef.current?.focus({preventScroll: true});
          void conversa.maisAntigas();
        }} />;

  const linhaAria = item && !item.grupo && item.status !== "ENCERRADO" ? linhaEstadoAria(item.estadoAria, { atendidoPorVoce: item.atendidoPorVoce, responsavelNome: item.responsavelNome, podeDecidir: aria?.podeDecidir === true, pausada: aria?.pausada === true, motivo: aria?.motivo ?? null }) : null;
  const renderizarConversa = (acoes: AcoesCabecalho | null, devolver?: ControlesDevolverAria, handoff?: ReturnType<typeof useHandoffConversa>, tomada?: ReturnType<typeof useAssumirParaResponder>) => (
    <>
      {item && acoes ? <CabecalhoConversa atendimento={item} acoes={acoes} linhaAria={linhaAria} acoesAria={devolver?.botao} usuarioId={usuario.id} painelAberto={painelAberto === true} painelAuto={painelAuto === true} aoAlternarPainel={aoAlternarPainel} buscaAberta={buscaAberta} aoBuscar={abrirBusca} aoVoltar={aoVoltar} /> : (
        <header className="flex h-[68px] shrink-0 items-center gap-2.5 border-b border-gray-200 bg-surface px-3">
          <BotaoIcone tamanho={36} rotulo="Voltar para a lista" onClick={aoVoltar} className="min-[960px]:hidden"><IconChevronLeft size={20} /></BotaoIcone>
          <p className="min-w-0 flex-1 truncate">Conversa</p>
          <BotaoIcone tamanho={36} rotulo="Painel do contato" aria-controls="painel-contato" aria-pressed={painelAberto} onClick={aoAlternarPainel}><IconLayoutSidebarRight size={17} /></BotaoIcone>
        </header>
      )}
      {devolver?.feedback}
      {acoes?.feedback}{acoes?.dialogos}
      {handoff?.faixa}
      {tomada?.feedback}
      {barraBusca}
      <div ref={rolagem} aria-busy={ocupada ? true : undefined} className="min-h-0 flex-1 overflow-y-auto px-[7%] pb-2.5 pt-[18px] max-[699px]:px-2.5 max-[699px]:pb-2 max-[699px]:pt-3">
        {conversa.temMaisAntes && <Botao variante="fantasma" tamanho="sm" ocupado={ocupada} className="mx-auto mb-2 block bg-surface text-gray-600" onClick={() => {
          if (ocupada) return;
          focarAntesDaCarga(); void conversa.maisAntigas();
        }}>Mensagens anteriores</Botao>}
        {conversa.erro && <div role="alert" className="mx-auto my-2 flex max-w-full flex-wrap items-center justify-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
          <p>Não foi possível carregar as mensagens.</p>
          <Botao variante="fantasma" tamanho="sm" ocupado={ocupada} onClick={() => {
            if (ocupada) return;
            focarAntesDaCarga(); void conversa.recarregar();
          }}>Tentar de novo</Botao>
        </div>}
        {cargaInicial && <EsqueletoThread rotulo="mensagens" />}
        <VirtualList stableMount
          items={itens}
          pinKeys={[...(achadoAtual?[achadoAtual]:[]),...(tarefaEmEdicaoId?["tarefa:"+tarefaEmEdicaoId]:[])]}
          getKey={(i) => i.id}
          isItemFocusable={(i) => i.tipo === "mensagem" || i.tipo === "sugestao-aria" || i.tipo === "tarefa"}
          estimatedHeight={72}
          scrollRef={rolagem}
          renderItem={(i) => {
            if (i.tipo === "dia") return <SeparadorDia rotulo={i.rotulo} />;
            if (i.tipo === "evento") return <EventoSistema tom={i.tom} icone={<IconArrowsExchange size={13} />} texto={i.texto} hora={i.hora} />;
            if (i.tipo === "nota") return <BalaoMensagem m={notaComoMensagem(i.n)} nota={i.n} autor="nota" emSequencia={i.emSequencia} fuso={fuso} comandos={[]} recursos={() => false} aoComando={() => {}} />;
            if (i.tipo === "tarefa") return <CartaoTarefaDoInbox atendimentoId={item?.id??""} t={i.t} bloqueado={bloquearDecisoesAria} fuso={fuso} usuarioNome={usuario.nome??null} aoEditar={aoEditarTarefa} aoMudar={aoMudar}/>;
            if (i.tipo === "sugestao-aria") return <CartaoSugestaoAria s={i.s} atendimentoId={item!.id} bloqueado={bloquearDecisoesAria} usuarioId={usuario.id} fuso={fuso} aoDecidir={aoMudar} />;
            const m = i.m;
            return (
              <BalaoMensagem m={m} destacada={achadoAtual === m.id} autor={autorDoItem(i)} emSequencia={i.emSequencia} fuso={fuso} comandos={comandosDaMensagem(m, capacidades, envioLiberado === true)} recursos={(r) => capacidades.includes(r)}
                aoComando={(c) => {
                  if (c === "copiar" && m.corpo) void navigator.clipboard?.writeText(m.corpo);
                  else if ((c === "reagir" || c === "encaminhar" || c === "editar" || c === "apagar") && item) setAcaoMensagem({ acao: c, m, atendimentoId: item.id, numeroId: item.numeroId });
                }} />
            );
          }}
        />
        {cartoesNoFio && item && !conversa.temMaisDepois && !janelaDesconhecida && <div data-slot="cartoesNoFio">{cartoesNoFio({ agora: new Date(agora), aoEditar: acoes?.abrirEditarAgendada })}</div>}
      </div>
      {item ? (
        <RodapeConversa
          controleResposta={handoff?.controleResposta}
          aoCampoResponder={(campo) => { handoff?.aoCampoResponder(campo); tomada?.aoCampoResponder(campo); }}
          atendimentoId={item.id}
          modo={!item.grupo && item.status !== "ENCERRADO" ? modoRodape(item.estadoAria, false) : "compositor"}
          travado={item.estadoAria === "ia" || item.estadoAria === "aprovacao" || item.estadoAria === "handoff" ? { texto: textoTravado(item.estadoAria), aoNota() {}, aoAssumir: tomada?.aoAssumir, ocupado: tomada?.ocupado } : undefined}
          aoCriarTarefa={aoCriarTarefa}
          pedidoNota={pedidoNota}
          aoPortaRascunhoInsight={!item.grupo?aoPortaRascunhoInsight:undefined}
          aoPortaRascunhoAgendamento={intencoesAgendamento&&!item.grupo?publicarPortaAgendamento:undefined}
          podeAnotar={!item.grupo}
          tentativasNota={tentativasNota}
          revisoesRascunhos={revisoesRascunhos}
          aoAgendar={acoes?.abrirAgendar ?? undefined}
          podeEnviar={envioLiberado}
          falhaPermissao={item.status === "ENCERRADO" ? undefined : falhaPermissao}
          capacidades={capacidades}
          aoEnviarTexto={(texto) => enviarTextoInbox({ conversaId: item.id, texto })}
          aoEnviarMidia={(url, legenda) => enviarMidiaInbox({ conversaId: item.id, url, legenda })}
          aoNota={(nota, chaveIdempotencia, mencoes) => registrarNotaAtendimento({ atendimentoId: item.id, nota, chaveIdempotencia, ...(mencoes === undefined ? {} : { mencoes }) })}
          buscarMencoes={buscarMencoes}
          respostas={respostas}
          propostas={propostasDaConversa}
          aoEnviarProposta={propostasDaConversa ? (documentoId, chaveIdempotencia) => enviarPropostaNoAtendimento({ atendimentoId: item.id, documentoId, chaveIdempotencia }) : undefined}
          variaveisResposta={{ nome: item.contatoNome, responsavel: item.responsavelNome }}
        />
      ) : <p className="border-t p-3 text-sm text-gray-600">{MOTIVO_SEM_ENVIO}</p>}
      {handoff?.modal}
      {acaoMensagem && (
        <AcoesMensagem key={`${acaoMensagem.acao}:${acaoMensagem.m.id}`} acao={acaoMensagem.acao} mensagem={acaoMensagem.m}
          origem={{ atendimentoId: acaoMensagem.atendimentoId, numeroId: acaoMensagem.numeroId }}
          aoFechar={() => setAcaoMensagem(null)} aoMudar={() => void conversa.recarregar()} />
      )}
    </>
  );
  return item ? <CoordenadorAcoesConversa key={item.id} item={item} intencoesAgendamento={intencoesAgendamento} pedidoAgendamento={pedidoAgendamento} aoPedidoAgendamentoConsumido={aoPedidoAgendamentoConsumido} podeLerAgendamento={podeLerAgendamento} portaAgendamento={portaAgendamento} respostas={respostas} versaoInsights={versaoInsights} podeUsarInsights={podeUsarInsights} aoCriarTarefa={aoCriarTarefa} aria={aria} leituraPainel={leituraPainel} podeEnviar={envioLiberado} agora={new Date(agora)} linhaAria={linhaAria} usuario={usuario} fuso={fuso} destinos={destinos} aoMudar={aoMudar} aoTransferirConcluido={aoTransferirConcluido} aoBuscar={abrirBusca} renderizar={renderizarConversa} /> : renderizarConversa(null);
}

function CoordenadorAcoesConversa({ item,intencoesAgendamento,pedidoAgendamento,aoPedidoAgendamentoConsumido,podeLerAgendamento,portaAgendamento,respostas, versaoInsights, podeUsarInsights=false, aoCriarTarefa, aria, leituraPainel, podeEnviar, agora, linhaAria, usuario, fuso, destinos = [], aoMudar, aoTransferirConcluido, aoBuscar, renderizar }: { item: ItemListaInbox;portaAgendamento:PortaRascunhoAgendamento|null;respostas:readonly RespostaDoCompositor[]; aria?: AriaDoAtendimento | null; leituraPainel?: LeituraPainelHandoff; podeEnviar: boolean | null; agora: Date; linhaAria: LinhaEstadoAria | null; aoBuscar(): void; renderizar(acoes: AcoesCabecalho, devolver?: ControlesDevolverAria, handoff?: ReturnType<typeof useHandoffConversa>, tomada?: ReturnType<typeof useAssumirParaResponder>): ReactNode } & Pick<PropsConversaAberta, "usuario" | "fuso" | "destinos" | "aoMudar" | "aoTransferirConcluido" | "aoCriarTarefa" | "versaoInsights" | "podeUsarInsights" | "intencoesAgendamento" | "pedidoAgendamento" | "aoPedidoAgendamentoConsumido" | "podeLerAgendamento">) {
  const handoff = useHandoffConversa({ item, usuarioId: usuario.id, handoff: aria?.handoff, respostaDisponivel: !item.grupo && item.status !== "ENCERRADO" && modoRodape(item.estadoAria, false) === "compositor", podeAssumirAria: aria?.podeAssumirAria === true, podeEnviar, leitura: leituraPainel, fuso, agora, aoMudar });
  const tomada = useAssumirParaResponder({ atendimentoId: item.id, usuarioId: usuario.id, responsavelId: item.responsavelId, estadoAria: !item.grupo && item.status !== "ENCERRADO" ? item.estadoAria : null, podeAssumirAria: aria?.podeAssumirAria === true && !item.grupo && item.status !== "ENCERRADO", podeEnviar, leitura: leituraPainel, aoMudar, controleResposta: handoff.controleResposta });
  const agendamento=useControladorAgendar({atendimentoId:item.id,nomeContato:item.contatoNome??"Contato",fuso:fuso??"UTC",usuarioId:usuario.id,responsavelId:item.responsavelId,estadoAria:item.estadoAria,aberto:item.status!=="ENCERRADO",grupo:item.grupo,podeEnviar,podeLer:podeLerAgendamento===true,
    leituraPronta:leituraPainel?leituraPainel.solicitada===leituraPainel.finalizada&&leituraPainel.resultado!=="pendente":podeEnviar!==null,versao:versaoInsights??0,intencoes:intencoesAgendamento,porta:portaAgendamento,respostas,variaveisResposta:{nome:item.contatoNome,responsavel:item.responsavelNome},pedidoAbrir:pedidoAgendamento,aoPedidoConsumido:aoPedidoAgendamentoConsumido,
    aoPrepararRascunho:()=>handoff.controleResposta.current?.selecionarResponder(),insightsAplicaveis:podeUsarInsights&&item.finalidade==="COMERCIAL"&&!item.grupo,versaoInsights,aoConcluir:()=>aoMudar()});
  const acoes = useAcoesAtendimento({
    versaoInsights,
    podeUsarInsights,
    aoAgendar:intencoesAgendamento?agendamento.abrir:undefined,
    contextoAria: ["ia", "aprovacao", "handoff"].includes(item.estadoAria ?? "") || !!aria?.handoff,
    podeAssumirAria: aria?.podeAssumirAria === true,
    atendimento: { id: item.id, finalidade: item.finalidade as Setor, responsavelId: item.responsavelId, status: item.status as StatusAtendimentoWhatsApp },
    usuario, grupo: item.grupo, setoresDoNumero: item.setoresDoNumero, fixada: item.fixada, silenciada: item.silenciada,
    linhaComercial: item.linhaComercial, donoLinhaId: item.numeroDonoId, destinos, aoMudar, fuso, aoBuscar, aoCriarTarefa,
  });
  const opcoes = opcoesTransferir({ usuario, grupo: item.grupo, atendimento: { finalidade: item.finalidade as Setor, responsavelId: item.responsavelId, encerrado: item.status === "ENCERRADO", linhaComercial: item.linhaComercial, donoLinhaId: item.numeroDonoId }, setoresDoNumero: item.setoresDoNumero, ariaPodeDevolver: aria?.podeDevolver === true });
  const identidadeTransferir = JSON.stringify([usuario.id, usuario.papeis, item.finalidade, item.numeroId, item.contatoId, item.numeroDonoId, item.linhaComercial, item.status === "ENCERRADO"]);
  return <ControladorTransferir atendimentoId={item.id} identidade={identidadeTransferir} responsavelAtualId={item.responsavelId} opcoes={opcoes} destinos={destinos} executar={executarTransferenciaInbox} carregarPessoas={carregarPessoasTransferir} carregarResumo={carregarResumoTransferir} aoConcluir={mensagem => { aoTransferirConcluido?.(mensagem); aoMudar(); }} renderizar={({ transferir, dialogo }) => <ControladorDevolverAria permitido={aria?.podeDevolver === true && !item.grupo && item.status !== "ENCERRADO"} atendimentoId={item.id} dica={linhaAria?.dica ?? null} aoMudar={aoMudar}>{(devolver) => renderizar({ ...acoes, transferir, refDoMenu:intencoesAgendamento?agendamento.refDoMenu:undefined, abrirEditarAgendada:intencoesAgendamento?agendamento.abrirEditar:undefined, feedback:<>{acoes.feedback}{agendamento.feedback}</>, menu: acoes.menu.filter(i => i.id !== "atribuir" && i.id !== "devolver"), dialogos: <>{acoes.dialogos}{dialogo}{agendamento.dialogo}</> }, devolver, handoff, tomada)}</ControladorDevolverAria>} />;
}
