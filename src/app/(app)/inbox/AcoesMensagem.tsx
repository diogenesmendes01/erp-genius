"use client";

import { useEffect, useState } from "react";
import { Botao } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { Modal } from "@/components/Modal";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { SETOR_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";
import { apagarMensagemWhatsApp, editarMensagemWhatsApp, encaminharMensagemWhatsApp, reagirMensagemWhatsApp } from "@/server/whatsapp/motor/acoes-mensagem";

// Comandos do menu da mensagem que dependem do motor (Fase 4D, ligados no Inbox novo da 3F): reagir, encaminhar,
// editar e apagar. Quem abre (ConversaAberta) só oferece o comando com a capacidade do número (motor ativo e sessão
// CONECTADO) e o envio liberado e, em editar/apagar, só nas mensagens próprias; cada Server Action confere tudo de
// novo (escopo de envio, autoria, janela de 15 min da edição, sessão do motor; no encaminhar, envio, opt-out e
// mesmo número no destino). "Apagar para todos" e o encaminhar (sai para outro contato) não voltam: rodam no
// ConfirmarAcao (lista fechada em src/app/confirmacoes-mapa.ts).

export type AcaoMensagem = "reagir" | "encaminhar" | "editar" | "apagar";

/** A conversa de onde a mensagem sai: o destino do encaminhar é outra conversa do mesmo número. */
export interface OrigemEncaminhar { atendimentoId: string; numeroId: string }

/** Reações rápidas do menu; o WhatsApp aceita qualquer emoji, e o servidor limita o tamanho. */
export const REACOES_RAPIDAS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export interface PropsAcoesMensagem {
  acao: AcaoMensagem;
  mensagem: Pick<MensagemThread, "id" | "corpo">;
  origem: OrigemEncaminhar;
  aoFechar(): void;
  /** A ação concluiu: a conversa recarrega as mensagens. */
  aoMudar(): void;
}

export function AcoesMensagem({ acao, mensagem, origem, aoFechar, aoMudar }: PropsAcoesMensagem) {
  if (acao === "apagar") {
    return (
      <ConfirmarAcao
        folha
        titulo="Apagar esta mensagem para todos?"
        confirmacao="apagar para todos"
        idempotente={false}
        acao={() => apagarMensagemWhatsApp({ mensagemId: mensagem.id })}
        aoConcluir={() => { aoFechar(); aoMudar(); }}
        aoCancelar={aoFechar}
      >
        <p>A mensagem some do WhatsApp do contato e fica marcada como apagada aqui. Não há como desfazer pela tela.</p>
      </ConfirmarAcao>
    );
  }
  if (acao === "encaminhar") return <EncaminharMensagem mensagem={mensagem} origem={origem} aoFechar={aoFechar} aoMudar={aoMudar} />;
  return acao === "editar"
    ? <EditarMensagem mensagem={mensagem} origem={origem} aoFechar={aoFechar} aoMudar={aoMudar} />
    : <ReagirMensagem mensagem={mensagem} origem={origem} aoFechar={aoFechar} aoMudar={aoMudar} />;
}

export const ERRO_LISTA_DESTINOS = "Não foi possível carregar as conversas. Tente de novo.";

/**
 * Destinos do encaminhar pela lista do Inbox novo (`GET /api/inbox/atendimentos`, com a busca): só o número da
 * origem e só onde o usuário pode enviar (`envio=1`: escopo de envio no servidor). Fora a própria origem, os
 * grupos e os contatos com opt-out, que a action recusaria. null quando a lista não carrega.
 */
export async function buscarDestinosEncaminhar(origem: OrigemEncaminhar, busca: string): Promise<ItemListaInbox[] | null> {
  const q = new URLSearchParams({ numeroId: origem.numeroId, envio: "1" });
  const termo = busca.trim();
  if (termo) q.set("busca", termo);
  try {
    const r = await fetch(`/api/inbox/atendimentos?${q.toString()}`, { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) return null;
    const { itens } = await r.json() as { itens: ItemListaInbox[] };
    return itens.filter((i) => i.id !== origem.atendimentoId && !i.grupo && !i.optOut);
  } catch { return null; }
}

export function EncaminharMensagem({ mensagem, origem, aoFechar, aoMudar }: Omit<PropsAcoesMensagem, "acao">) {
  const [termo, setTermo] = useState("");
  const [destinos, setDestinos] = useState<ItemListaInbox[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Encaminhar manda a mensagem a outro contato e não volta: escolher o destino só abre a confirmação.
  const [escolha, setEscolha] = useState<ItemListaInbox | null>(null);

  // Primeira carga (sem busca) fora do render; a resposta de um efeito descartado não é aplicada.
  useEffect(() => {
    let ativo = true;
    void buscarDestinosEncaminhar(origem, "").then((l) => {
      if (!ativo) return;
      if (l) setDestinos(l); else setErro(ERRO_LISTA_DESTINOS);
    });
    return () => { ativo = false; };
  }, [origem]);

  async function buscar(e: { preventDefault(): void }) {
    e.preventDefault();
    setOcupado(true);
    const l = await buscarDestinosEncaminhar(origem, termo);
    setOcupado(false);
    if (l) { setErro(null); setDestinos(l); } else setErro(ERRO_LISTA_DESTINOS);
  }

  if (escolha) {
    return (
      <ConfirmarAcao
        folha
        titulo={`Encaminhar esta mensagem para ${escolha.contatoNome}?`}
        confirmacao={`encaminhamento para ${escolha.contatoNome}`}
        idempotente={false}
        acao={() => encaminharMensagemWhatsApp({ mensagemId: mensagem.id, atendimentoDestinoId: escolha.id })}
        aoConcluir={() => { setEscolha(null); aoFechar(); aoMudar(); }}
        aoCancelar={() => setEscolha(null)}
      >
        <p>A mensagem sai pelo WhatsApp deste número para {escolha.contatoNome}, marcada como encaminhada. Não há como desfazer pela tela.</p>
      </ConfirmarAcao>
    );
  }
  return (
    <Modal titulo="Encaminhar mensagem" folha aoFechar={aoFechar} bloquearFechamento={ocupado}>
      <div className="space-y-3 text-sm">
        <p className="text-gray-600">Conversas deste mesmo número em que você pode enviar.</p>
        <form role="search" onSubmit={(e) => void buscar(e)} className="flex gap-2">
          <input value={termo} onChange={(e) => setTermo(e.target.value)} maxLength={100} aria-label="Buscar conversa de destino"
            placeholder="Nome ou telefone do contato" className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm" />
          <Botao type="submit" tamanho="sm" variante="secundario" ocupado={ocupado}>Buscar</Botao>
        </form>
        <FeedbackAcao erro={erro} sucesso={null} />
        {destinos && (destinos.length === 0
          ? <EstadoVazio>Nenhuma conversa deste número em que você possa enviar.</EstadoVazio>
          : <ul className="max-h-72 space-y-1 overflow-y-auto">{destinos.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <Botao tamanho="sm" variante="fantasma" onClick={() => setEscolha(d)}>Encaminhar para {d.contatoNome}</Botao>
                <span className="shrink-0 text-xs text-gray-600">{rotular(SETOR_ATENDIMENTO_LABEL, d.finalidade)}</span>
              </li>
            ))}</ul>)}
        <div className="flex justify-end">
          <Botao tamanho="sm" variante="fantasma" disabled={ocupado} onClick={aoFechar}>Fechar</Botao>
        </div>
      </div>
    </Modal>
  );
}

export function EditarMensagem({ mensagem, aoFechar, aoMudar }: Omit<PropsAcoesMensagem, "acao">) {
  const [texto, setTexto] = useState(mensagem.corpo ?? "");
  const editar = useAcaoCliente({ idempotente: true });
  async function salvar() {
    const d = await editar.executar(() => editarMensagemWhatsApp({ mensagemId: mensagem.id, texto }));
    if (d?.tipo === "ok") { aoFechar(); aoMudar(); }
  }
  return (
    <Modal titulo="Editar mensagem" folha aoFechar={aoFechar} bloquearFechamento={editar.ocupado}>
      <div className="space-y-3 text-sm">
        <label className="grid gap-1">Novo texto (até 15 minutos depois do envio)
          <CampoTexto value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={4096} rows={4} className="rounded border p-2" />
        </label>
        <FeedbackAcao erro={editar.erro} sucesso={null} />
        <div className="flex justify-end gap-2">
          <Botao tamanho="sm" variante="fantasma" disabled={editar.ocupado} onClick={aoFechar}>Cancelar</Botao>
          <Botao tamanho="sm" variante="primario" ocupado={editar.ocupado} disabled={!texto.trim() || texto.trim() === (mensagem.corpo ?? "").trim()} onClick={() => void salvar()}>Salvar edição</Botao>
        </div>
      </div>
    </Modal>
  );
}

export function ReagirMensagem({ mensagem, aoFechar, aoMudar }: Omit<PropsAcoesMensagem, "acao">) {
  const reagir = useAcaoCliente({ idempotente: true });
  async function enviar(emoji: string) {
    const d = await reagir.executar(() => reagirMensagemWhatsApp({ mensagemId: mensagem.id, emoji }));
    if (d?.tipo === "ok") { aoFechar(); aoMudar(); }
  }
  return (
    <Modal titulo="Reagir à mensagem" folha aoFechar={aoFechar} bloquearFechamento={reagir.ocupado}>
      <div className="space-y-3 text-sm">
        <div role="group" aria-label="Reações" className="flex flex-wrap gap-2">
          {REACOES_RAPIDAS.map((e) => (
            <Botao key={e} tamanho="sm" variante="secundario" aria-label={`Reagir com ${e}`} disabled={reagir.ocupado} onClick={() => void enviar(e)}>{e}</Botao>
          ))}
        </div>
        <FeedbackAcao erro={reagir.erro} sucesso={null} />
        <div className="flex justify-end gap-2">
          <Botao tamanho="sm" variante="perigo" disabled={reagir.ocupado} onClick={() => void enviar("")}>Remover minha reação</Botao>
          <Botao tamanho="sm" variante="fantasma" disabled={reagir.ocupado} onClick={aoFechar}>Fechar</Botao>
        </div>
      </div>
    </Modal>
  );
}
