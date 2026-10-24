"use client";

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
import { VirtualList } from "@/components/conversa/VirtualList";
import type { RecursoMotor } from "@/components/conversa/recursos-canal";
import type { ConversaHook } from "@/components/conversa/useConversa";
import { SETOR_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";
import { enviarMidiaInbox, enviarTextoInbox } from "@/server/whatsapp/acoes";
import { respostasRapidasDoCompositor } from "@/server/crm-config/acoes-respostas";
import { registrarNotaAtendimento } from "@/server/whatsapp/acoes-conversa";
import { origemVisivelDaTransferencia } from "@/server/whatsapp/consultas-acoes-atendimento";
import type { Setor } from "@/server/whatsapp/setor";
import { useAcoesAtendimento, type DestinoTransferencia } from "./AcoesAtendimento";
import { useChavesPorAlvo } from "@/lib/chave-idempotencia";
import type { AcoesCabecalho } from "./MenuConversa";
import { useRevisoesRascunhos } from "@/components/conversa/rascunhos-conversa";
import { RodapeConversa } from "./RodapeConversa";
import { CabecalhoConversa } from "./CabecalhoConversa";
import { BuscaConversa } from "./BuscaConversa";
import { useBuscaConversa } from "./useBuscaConversa";
import { AcoesMensagem, type AcaoMensagem } from "./AcoesMensagem";
import type { CandidatoMencao } from "@/lib/mencoes-nota";

export interface PropsConversaAberta {
  item: ItemListaInbox | null;
  usuario: { id: string; papeis: Papel[] };
  fuso: string | null;
  /** Epoch capturado na página: mesmo instante no SSR/hidratação; cliente renova por revisão. */
  agoraInicial?: number;
  conversa: ConversaHook;
  /** O podeEnviar da thread, vindo do painel do atendimento (`atendimentoVisivel` com envio); null enquanto carrega. */
  podeEnviar: boolean | null;
  /** O painel não carregou: "Tentar de novo" do compositor (C2 da revisão do #218). */
  falhaPermissao?: () => void;
  destinos?: DestinoTransferencia[];
  aoVoltar(): void;
  aoAlternarPainel(): void;
  painelAberto?: boolean;
  painelAuto?: boolean;
  /** Uma ação do cabeçalho concluiu (a tela recarrega a lista). */
  aoMudar(): void;
}

/** "Transferido de Comercial": só quando o usuário também enxerga o atendimento de origem (escopo). */
export function textoOrigem(setor: Setor | null): string | null {
  return setor ? `Transferido de ${rotular(SETOR_ATENDIMENTO_LABEL, setor)}` : null;
}

/**
 * Comandos do menu da mensagem que esta tela já executa; os outros ficam fora do menu até serem ligados.
 * Reagir, encaminhar, editar e apagar vão pelo motor (Fase 4D) e ainda passam por `comandosDaMensagem`. Encaminhar
 * abre a escolha da conversa de destino (mesmo número, com envio) em AcoesMensagem.
 */
export const COMANDOS_MENSAGEM_LIGADOS: readonly ComandoMensagem[] = ["copiar", "reagir", "encaminhar", "editar", "apagar"];

const RECURSO_DO_COMANDO: Partial<Record<ComandoMensagem, RecursoMotor>> = { reagir: "reagir", encaminhar: "encaminhar", editar: "editar", apagar: "apagar" };

/**
 * Os comandos ligados que valem para esta mensagem. Os do motor exigem a capacidade do número (MOTOR ativo e
 * sessão CONECTADO), o podeEnviar da thread (as actions usam o escopo de envio) e mensagem não apagada; editar
 * e apagar, só a própria mensagem de saída (editar, só texto). O servidor confere tudo de novo.
 */
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

/**
 * O compositor só envia com o podeEnviar da thread (o servidor decide por `atendimentoVisivel` com envio: escopo de
 * envio, convite com envio, destinatário atual) e com o atendimento aberto. `podeExecutar("enviar")` não serve:
 * libera todo mundo (C6 do #217).
 */
export function podeEnviarNaConversa(item: Pick<ItemListaInbox, "status">, podeEnviar: boolean | null): boolean | null {
  return item.status === "ENCERRADO" ? false : podeEnviar;
}

export function ConversaAberta({ item, usuario, fuso, conversa, podeEnviar, falhaPermissao, destinos, aoVoltar, aoAlternarPainel, painelAberto, painelAuto, aoMudar, agoraInicial }: PropsConversaAberta) {
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
  const agora = useAgoraDaThread(conversa.mensagens, conversa.notas, item?.id ?? null, agoraInicial);
  const origemId = item?.atendimentoOrigemId ?? null;
  const [origem, setOrigem] = useState<{ de: string; setor: Setor | null }>({ de: "", setor: null });
  useEffect(() => {
    if (!origemId) return;
    let ativo = true;
    void origemVisivelDaTransferencia(origemId).then((o) => { if (ativo) setOrigem({ de: origemId, setor: o?.setor ?? null }); }).catch(() => undefined);
    return () => { ativo = false; };
  }, [origemId]);
  const transferidoDe = origemId && origem.de === origemId && origem.setor ? rotular(SETOR_ATENDIMENTO_LABEL, origem.setor) : null;
  const itens = useMemo(() => decorarThread(itensDaThread(conversa.mensagens, conversa.notas ?? [], conversa.temMaisAntes, conversa.temMaisDepois), { fuso, agora: new Date(agora), transferidoDe }), [conversa.mensagens, conversa.notas, conversa.temMaisAntes, conversa.temMaisDepois, fuso, agora, transferidoDe]);
  const { aberta: buscaAberta, termo, atual: achadoAtual, achados, posicao, campoRef, abrir: abrirBusca, fechar: fecharBusca, aoMudar: mudarBusca, navegar: navegarBusca } = useBuscaConversa(item?.id ?? null, conversa.mensagens, rolagem, itens);
  // A origem (atendimento e número) fica guardada no clique: o encaminhar não muda de conversa se a seleção mudar.
  const [acaoMensagem, setAcaoMensagem] = useState<{ acao: AcaoMensagem; m: MensagemThread; atendimentoId: string; numeroId: string } | null>(null);
  const [respostas, setRespostas] = useState<{ id: string; atalho: string; titulo: string; corpo: string }[]>([]);
  useEffect(() => {
    let ativo = true;
    void respostasRapidasDoCompositor().then((r) => { if (ativo) setRespostas(r); }).catch(() => undefined);
    return () => { ativo = false; };
  }, []);
  const capacidades = item?.capacidades ?? [];
  // null (carregando) só chega ao compositor; os comandos da mensagem exigem o envio confirmado.
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
          // O controle pode perder foco ao ficar ocupado/desmontar. Entrega antes da carga,
          // sem restaurar depois e tomar foco que o usuário moveu durante a espera.
          campoRef.current?.focus({preventScroll: true});
          void conversa.maisAntigas();
        }} />;

  const renderizarConversa = (acoes: AcoesCabecalho | null) => (
    <>
      {item && acoes ? <CabecalhoConversa atendimento={item} acoes={acoes} usuarioId={usuario.id} painelAberto={painelAberto === true} painelAuto={painelAuto === true} aoAlternarPainel={aoAlternarPainel} buscaAberta={buscaAberta} aoBuscar={abrirBusca} aoVoltar={aoVoltar} /> : (
        <header className="flex h-[68px] shrink-0 items-center gap-2.5 border-b border-gray-200 bg-surface px-3">
          <BotaoIcone tamanho={36} rotulo="Voltar para a lista" onClick={aoVoltar} className="min-[960px]:hidden"><IconChevronLeft size={20} /></BotaoIcone>
          <p className="min-w-0 flex-1 truncate">Conversa</p>
          <BotaoIcone tamanho={36} rotulo="Painel do contato" aria-controls="painel-contato" aria-pressed={painelAberto} onClick={aoAlternarPainel}><IconLayoutSidebarRight size={17} /></BotaoIcone>
        </header>
      )}
      {acoes?.feedback}{acoes?.dialogos}
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
          pinKeys={achadoAtual ? [achadoAtual] : []}
          getKey={(i) => i.id}
          isItemFocusable={(i) => i.tipo === "mensagem"}
          estimatedHeight={72}
          scrollRef={rolagem}
          renderItem={(i) => {
            if (i.tipo === "dia") return <SeparadorDia rotulo={i.rotulo} />;
            if (i.tipo === "evento") return <EventoSistema tom={i.tom} icone={<IconArrowsExchange size={13} />} texto={i.texto} hora={i.hora} />;
            if (i.tipo === "nota") return <BalaoMensagem m={notaComoMensagem(i.n)} nota={i.n} autor="nota" emSequencia={i.emSequencia} fuso={fuso} comandos={[]} recursos={() => false} aoComando={() => {}} />;
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
      </div>
      {item ? (
        <RodapeConversa
          atendimentoId={item.id}
          modo="compositor"
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
          variaveisResposta={{ nome: item.contatoNome, responsavel: item.responsavelNome }}
        />
      ) : <p className="border-t p-3 text-sm text-gray-600">{MOTIVO_SEM_ENVIO}</p>}
      {acaoMensagem && (
        <AcoesMensagem key={`${acaoMensagem.acao}:${acaoMensagem.m.id}`} acao={acaoMensagem.acao} mensagem={acaoMensagem.m}
          origem={{ atendimentoId: acaoMensagem.atendimentoId, numeroId: acaoMensagem.numeroId }}
          aoFechar={() => setAcaoMensagem(null)} aoMudar={() => void conversa.recarregar()} />
      )}
    </>
  );
  return item ? <CoordenadorAcoesConversa key={item.id} item={item} usuario={usuario} fuso={fuso} destinos={destinos} aoMudar={aoMudar} aoBuscar={abrirBusca}>{renderizarConversa}</CoordenadorAcoesConversa> : renderizarConversa(null);
}

/** Monta apenas para atendimento válido; a key no chamador encerra seus diálogos na seleção. */
function CoordenadorAcoesConversa({ item, usuario, fuso, destinos, aoMudar, aoBuscar, children }: { item: ItemListaInbox; aoBuscar(): void; children(acoes: AcoesCabecalho): ReactNode } & Pick<PropsConversaAberta, "usuario" | "fuso" | "destinos" | "aoMudar">) {
  const acoes = useAcoesAtendimento({
    atendimento: { id: item.id, finalidade: item.finalidade as Setor, responsavelId: item.responsavelId, status: item.status as StatusAtendimentoWhatsApp },
    usuario, grupo: item.grupo, setoresDoNumero: item.setoresDoNumero, fixada: item.fixada, silenciada: item.silenciada,
    linhaComercial: item.linhaComercial, donoLinhaId: item.numeroDonoId, destinos, aoMudar, fuso, aoBuscar,
  });
  return children(acoes);
}
