"use client";

import { useState } from "react";
import { Botao } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { Modal } from "@/components/Modal";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";
import { apagarMensagemWhatsApp, editarMensagemWhatsApp, reagirMensagemWhatsApp } from "@/server/whatsapp/motor/acoes-mensagem";

// Comandos do menu da mensagem que dependem do motor (Fase 4D, ligados no Inbox novo da 3F): reagir, editar e
// apagar. Quem abre (ConversaAberta) só oferece o comando com a capacidade do número (motor ativo e sessão
// CONECTADO) e, em editar/apagar, só nas mensagens próprias; cada Server Action confere tudo de novo (escopo de
// envio, autoria, janela de 15 min da edição, sessão do motor). "Apagar para todos" não volta: roda no
// ConfirmarAcao (lista fechada em src/app/confirmacoes-mapa.ts).

export type AcaoMensagem = "reagir" | "editar" | "apagar";

/** Reações rápidas do menu; o WhatsApp aceita qualquer emoji, e o servidor limita o tamanho. */
export const REACOES_RAPIDAS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export interface PropsAcoesMensagem {
  acao: AcaoMensagem;
  mensagem: Pick<MensagemThread, "id" | "corpo">;
  aoFechar(): void;
  /** A ação concluiu: a conversa recarrega as mensagens. */
  aoMudar(): void;
}

export function AcoesMensagem({ acao, mensagem, aoFechar, aoMudar }: PropsAcoesMensagem) {
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
  return acao === "editar"
    ? <EditarMensagem mensagem={mensagem} aoFechar={aoFechar} aoMudar={aoMudar} />
    : <ReagirMensagem mensagem={mensagem} aoFechar={aoFechar} aoMudar={aoMudar} />;
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
