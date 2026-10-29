"use client";

import { useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Modal } from "@/components/Modal";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { CLASSE_CAIXA } from "@/components/ui/checkbox";
import { CLASSE_INPUT } from "@/components/ui/input";
import { useAcaoCliente, type DesfechoAcao } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";

export type FalhaConfirmacao = Exclude<DesfechoAcao<unknown>, { tipo: "ok" }>;

export type PropsConfirmarAcao<T> = {
  titulo: string;
  children: ReactNode;
  confirmacao: string;
  conferencia?: string;
  digitacao?: { rotulo: string; esperado: string };
  podeConfirmar?: boolean;
  acao: () => Promise<Resultado<T>>;
  idempotente: boolean;
  aoConcluir: (dado: T | undefined) => void;
  aoFalhar?: (falha: FalhaConfirmacao) => void;
  aoCancelar: () => void;
  folha?: boolean;
};

export function ConfirmarAcao<T>({ titulo, children, confirmacao, conferencia, digitacao, acao, idempotente, aoConcluir, aoFalhar, aoCancelar, folha, podeConfirmar = true }: PropsConfirmarAcao<T>) {
  const execucao = useAcaoCliente({ idempotente });
  const [conferido, setConferido] = useState(false);
  const [digitado, setDigitado] = useState("");
  const voltar = useRef<HTMLButtonElement>(null);
  const descricaoId = useId();
  const ocupado = execucao.ocupado;
  const aguardaConferencia = conferencia !== undefined && !conferido;
  const aguardaDigitacao = digitacao !== undefined && digitado.trim() !== digitacao.esperado.trim();
  const aguarda = aguardaConferencia || aguardaDigitacao || !podeConfirmar;

  async function confirmar() {
    if (aguarda) return;
    const desfecho = await execucao.executar(acao);
    if (!desfecho) return;
    if (desfecho.tipo === "ok") aoConcluir(desfecho.dado);
    else aoFalhar?.(desfecho);
  }

  function cancelar() {
    if (!ocupado) aoCancelar();
  }

  return (
    <AlertDialog open onOpenChange={(aberto) => { if (!aberto) cancelar(); }}>
    <Modal titulo={titulo} folha={folha} papel="alertdialog" descricaoId={descricaoId} focoInicial={voltar} aoFechar={cancelar} bloquearFechamento={ocupado}>
      <div id={descricaoId} className="space-y-2 text-sm text-gray-700">{children}</div>
      {conferencia !== undefined && (
        <label className="mt-3 flex items-start gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            className={CLASSE_CAIXA}
            checked={conferido}
            disabled={ocupado}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setConferido(e.target.checked)}
          />
          <span>{conferencia}</span>
        </label>
      )}
      {digitacao !== undefined && (
        <label className="mt-3 grid gap-1 text-sm text-gray-800">
          <span>{digitacao.rotulo}</span>
          <input
            type="text"
            className={CLASSE_INPUT}
            value={digitado}
            disabled={ocupado}
            autoComplete="off"
            spellCheck={false}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDigitado(e.target.value)}
          />
        </label>
      )}
      <FeedbackAcao erro={execucao.erro} className="mt-3" />
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Botao ref={voltar} variante="secundario" disabled={ocupado} onClick={cancelar}>
          Voltar
        </Botao>
        <Botao variante="perigo" disabled={ocupado || aguarda} aria-busy={ocupado || undefined} onClick={confirmar}>
          {ocupado ? "Confirmando\u2026" : <>Confirmar {confirmacao}</>}
        </Botao>
      </div>
    </Modal>
    </AlertDialog>
  );
}
