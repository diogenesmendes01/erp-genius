"use client";

import { useEffect, useRef, useState } from "react";
import type { Papel, StatusAtendimentoWhatsApp } from "@prisma/client";
import { IconArrowLeft, IconLayoutSidebarRight } from "@tabler/icons-react";
import { Avatar } from "@/components/Avatar";
import { BalaoMensagem, type ComandoMensagem } from "@/components/conversa/BalaoMensagem";
import { Compositor, MOTIVO_SEM_ENVIO } from "@/components/conversa/Compositor";
import { VirtualList } from "@/components/conversa/VirtualList";
import type { RecursoMotor } from "@/components/conversa/recursos-canal";
import type { ConversaHook } from "@/components/conversa/useConversa";
import { SETOR_ATENDIMENTO_LABEL, STATUS_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";
import { enviarMidiaInbox, enviarTextoInbox } from "@/server/whatsapp/acoes";
import { respostasRapidasDoCompositor } from "@/server/crm-config/acoes-respostas";
import { registrarNotaAtendimento } from "@/server/whatsapp/acoes-conversa";
import { origemVisivelDaTransferencia } from "@/server/whatsapp/consultas-acoes-atendimento";
import type { Setor } from "@/server/whatsapp/setor";
import type { ItemTriagem, RevisaoEnvio } from "@/server/whatsapp/operacoes-atendimento";
import { AcoesAtendimento, type DestinoTransferencia } from "./AcoesAtendimento";
import { AcoesMensagem, type AcaoMensagem } from "./AcoesMensagem";
import { PainelTriagem } from "./PainelTriagem";

export interface PropsConversaAberta {
  item: ItemListaInbox | null;
  usuario: { id: string; papeis: Papel[] };
  fuso: string | null;
  conversa: ConversaHook;
  /** O podeEnviar da thread, vindo do painel do atendimento (`atendimentoVisivel` com envio); null enquanto carrega. */
  podeEnviar: boolean | null;
  /** O painel não carregou: "Tentar de novo" do compositor (C2 da revisão do #218). */
  falhaPermissao?: () => void;
  destinos?: DestinoTransferencia[];
  /** Triagem do número (a quem `listarTriagemWhatsApp` aceita) e revisão de envio incerto (administrador); nulos para os demais. */
  triagem?: ItemTriagem[] | null;
  revisoes?: RevisaoEnvio[] | null;
  aoVoltar(): void;
  aoAbrirPainel(): void;
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

export function ConversaAberta({ item, usuario, fuso, conversa, podeEnviar, falhaPermissao, destinos, triagem = null, revisoes = null, aoVoltar, aoAbrirPainel, aoMudar }: PropsConversaAberta) {
  const rolagem = useRef<HTMLDivElement>(null);
  const origemId = item?.atendimentoOrigemId ?? null;
  const [origem, setOrigem] = useState<{ de: string; setor: Setor | null }>({ de: "", setor: null });
  useEffect(() => {
    if (!origemId) return;
    let ativo = true;
    void origemVisivelDaTransferencia(origemId).then((o) => { if (ativo) setOrigem({ de: origemId, setor: o?.setor ?? null }); }).catch(() => undefined);
    return () => { ativo = false; };
  }, [origemId]);
  const transferido = origemId && origem.de === origemId ? textoOrigem(origem.setor) : null;
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

  return (
    <>
      <header className="space-y-2 border-b p-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Voltar para a lista" onClick={aoVoltar} className="min-[700px]:hidden"><IconArrowLeft size={20} aria-hidden /></button>
          {item && <Avatar nome={item.contatoNome} tamanho={32} />}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{item?.contatoNome ?? "Conversa"}</p>
            {item && (
              <p className="flex flex-wrap gap-x-2 text-xs text-gray-600">
                <span>{rotular(SETOR_ATENDIMENTO_LABEL, item.finalidade)}</span>
                <span>{item.numeroRotulo}</span>
                {!item.grupo && <span>{rotular(STATUS_ATENDIMENTO_LABEL, item.status)}</span>}
                {!item.grupo && <span>{item.responsavelNome ? `Responsável: ${item.responsavelNome}` : "Sem responsável"}</span>}
                {transferido && <span>{transferido}</span>}
              </p>
            )}
          </div>
          <button type="button" aria-label="Detalhes da conversa" onClick={aoAbrirPainel} className="min-[1100px]:hidden"><IconLayoutSidebarRight size={20} aria-hidden /></button>
        </div>
        {item && !item.grupo && (
          <AcoesAtendimento
            key={item.id}
            atendimento={{ id: item.id, finalidade: item.finalidade as Setor, responsavelId: item.responsavelId, status: item.status as StatusAtendimentoWhatsApp }}
            usuario={usuario}
            setoresDoNumero={item.setoresDoNumero}
            fixada={item.fixada}
            silenciada={item.silenciada}
            linhaComercial={item.linhaComercial}
            donoLinhaId={item.numeroDonoId}
            destinos={destinos}
            aoMudar={aoMudar}
            fuso={fuso}
          />
        )}
      </header>
      <div ref={rolagem} className="min-h-0 flex-1 overflow-y-auto p-3">
        {(triagem || revisoes) && <div className="mb-3"><PainelTriagem triagem={triagem} revisoes={revisoes} preferenciaFusoExibicao={fuso} /></div>}
        {conversa.temMaisAntes && <button type="button" onClick={() => void conversa.maisAntigas()} disabled={conversa.carregandoAntigas} className="mb-2 w-full text-sm text-brand-800">Mensagens anteriores</button>}
        {conversa.erro && <p role="alert" className="text-sm text-red-700">{conversa.erro}</p>}
        <VirtualList
          items={conversa.mensagens}
          getKey={(m) => m.id}
          estimatedHeight={72}
          scrollRef={rolagem}
          renderItem={(m) => (
            <BalaoMensagem m={m} fuso={fuso} comandos={comandosDaMensagem(m, capacidades, envioLiberado === true)} recursos={(r) => capacidades.includes(r)}
              aoComando={(c) => {
                if (c === "copiar" && m.corpo) void navigator.clipboard?.writeText(m.corpo);
                else if ((c === "reagir" || c === "encaminhar" || c === "editar" || c === "apagar") && item) setAcaoMensagem({ acao: c, m, atendimentoId: item.id, numeroId: item.numeroId });
              }} />
          )}
        />
      </div>
      {item ? (
        <Compositor
          atendimentoId={item.id}
          modo="responder"
          podeEnviar={envioLiberado}
          falhaPermissao={item.status === "ENCERRADO" ? undefined : falhaPermissao}
          capacidades={capacidades}
          aoEnviarTexto={(texto) => enviarTextoInbox({ conversaId: item.id, texto })}
          aoEnviarMidia={(url, legenda) => enviarMidiaInbox({ conversaId: item.id, url, legenda })}
          aoNota={(nota) => registrarNotaAtendimento({ atendimentoId: item.id, nota })}
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
}
