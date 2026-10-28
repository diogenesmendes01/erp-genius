"use client";
import { useId, useRef, type ChangeEvent } from "react";
import { Botao } from "@/components/Botao";
import { Modal } from "@/components/Modal";
import { textoSeloMensagemAgendada, type DecisaoMensagemAgendada, type MensagemAgendadaDaTarefa } from "@/lib/selo-mensagem-agendada";

export function OpcoesMensagemAgendada({ valor, aoMudar, desabilitado = false }: {
  valor: DecisaoMensagemAgendada | null;
  aoMudar(valor: DecisaoMensagemAgendada): void;
  desabilitado?: boolean;
}) {
  const nome = useId();
  return <fieldset className="space-y-2">
    <legend className="text-sm">O que fazer com a mensagem agendada?</legend>
    {([["cancelar", "Cancelar a mensagem agendada"], ["manter", "Manter o envio agendado"]] as const).map(([v, rotulo]) => (
      <label key={v} className="flex items-center gap-2 text-sm">
        <input type="radio" name={nome} value={v} checked={valor === v} disabled={desabilitado} onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.checked) aoMudar(v); }} />
        {rotulo}
      </label>
    ))}
  </fieldset>;
}

export function EscolhaMensagemAgendada({ mensagem, ocupado = false, aoEscolher, aoVoltar }: {
  mensagem: MensagemAgendadaDaTarefa;
  ocupado?: boolean;
  aoEscolher(decisao: DecisaoMensagemAgendada): void;
  aoVoltar(): void;
}) {
  const voltar = useRef<HTMLButtonElement>(null);
  return <Modal titulo="Mensagem agendada desta tarefa" papel="alertdialog" folha focoInicial={voltar} aoFechar={aoVoltar} bloquearFechamento={ocupado}>
    <p>Esta tarefa tem um envio ligado a ela. {textoSeloMensagemAgendada(mensagem.quando)}.</p>
    <p className="text-sm text-gray-600">Escolha se a mensagem agendada deve ser cancelada ou se o envio continua no horário marcado.</p>
    <div className="mt-4 flex flex-wrap justify-end gap-2">
      <Botao ref={voltar} variante="fantasma" disabled={ocupado} onClick={aoVoltar}>Voltar</Botao>
      <Botao variante="secundario" disabled={ocupado} onClick={() => aoEscolher("manter")}>Manter o envio agendado</Botao>
      <Botao variante="perigo" disabled={ocupado} onClick={() => aoEscolher("cancelar")}>Cancelar a mensagem agendada</Botao>
    </div>
  </Modal>;
}
