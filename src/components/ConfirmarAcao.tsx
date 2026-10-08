"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Modal } from "@/components/Modal";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente, type DesfechoAcao } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";

// Confirmação de ação irreversível ou de efeito externo (docs/42-auditoria-frontend-ux.md, E1; docs/43
// §6 item 1). Um clique errado numa tabela densa mandava cobrança real ao aluno errado, fechava o mês de
// comissões ou cancelava fatura, sem volta pela tela. Aqui a ação só roda depois de uma decisão explícita:
// - casco do Modal como `alertdialog`: título com a pergunta, descrição (aria-describedby) com a
//   consequência — o que muda, para quem, quanto, e que não há desfazer;
// - foco inicial no botão seguro ("Voltar"); Escape e clique no fundo cancelam; o foco volta a quem abriu;
// - botão de confirmação sempre `perigo`, nomeado pela ação ("Confirmar envio para Ana");
// - `conferencia` (opcional) exige marcar "Confirmo os valores acima" antes de habilitar a confirmação;
// - a ação roda aqui, pelo executor único (useAcaoCliente): ocupado trava os dois botões, o Escape e o
//   fundo; erro e resultado incerto aparecem DENTRO do diálogo (FeedbackAcao), que continua aberto. No
//   sucesso o diálogo chama `aoConcluir` — quem abriu fecha a confirmação e anuncia o resultado na tela.
// Telas que usam: lista fechada em src/app/confirmacoes-mapa.ts (trava em src/app/confirmacoes.test.ts).

export type FalhaConfirmacao = Exclude<DesfechoAcao<unknown>, { tipo: "ok" }>;

export type PropsConfirmarAcao<T> = {
  /** A pergunta, nomeando o alvo: "Cancelar a fatura FAT-0031?". */
  titulo: string;
  /** A consequência: o que acontece, com quem, quanto — e que não se desfaz pela tela. */
  children: ReactNode;
  /** Complemento do botão de confirmação, que sai como "Confirmar {confirmacao}": "envio para Ana". */
  confirmacao: string;
  /** Texto da caixa que precisa ser marcada antes de confirmar (conferência dos valores). */
  conferencia?: string;
  /** A ação. Só é chamada no clique de confirmação. */
  acao: () => Promise<Resultado<T>>;
  /** A action recebe chave de idempotência estável? Decide a instrução do resultado incerto. */
  idempotente: boolean;
  /** Sucesso: quem abriu fecha o diálogo e anuncia o resultado na tela. */
  aoConcluir: (dado: T | undefined) => void;
  /** Erro de negócio ou resultado incerto (a mensagem já está no diálogo, que fica aberto). */
  aoFalhar?: (falha: FalhaConfirmacao) => void;
  /** Voltar, Escape ou clique no fundo — nada foi executado. */
  aoCancelar: () => void;
};

export function ConfirmarAcao<T>({ titulo, children, confirmacao, conferencia, acao, idempotente, aoConcluir, aoFalhar, aoCancelar }: PropsConfirmarAcao<T>) {
  const execucao = useAcaoCliente({ idempotente });
  const [conferido, setConferido] = useState(false);
  const voltar = useRef<HTMLButtonElement>(null);
  const descricaoId = useId();
  const ocupado = execucao.ocupado;
  const aguardaConferencia = conferencia !== undefined && !conferido;

  async function confirmar() {
    if (aguardaConferencia) return;
    const desfecho = await execucao.executar(acao);
    if (!desfecho) return; // clique repetido durante a execução: ignorado pela trava do executor
    if (desfecho.tipo === "ok") aoConcluir(desfecho.dado);
    else aoFalhar?.(desfecho);
  }

  function cancelar() {
    if (!ocupado) aoCancelar();
  }

  return (
    <Modal titulo={titulo} papel="alertdialog" descricaoId={descricaoId} focoInicial={voltar} aoFechar={cancelar} bloquearFechamento={ocupado}>
      <div id={descricaoId} className="space-y-2 text-sm text-gray-700">{children}</div>
      {conferencia !== undefined && (
        <label className="mt-3 flex items-start gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
            checked={conferido}
            disabled={ocupado}
            onChange={(e) => setConferido(e.target.checked)}
          />
          <span>{conferencia}</span>
        </label>
      )}
      <FeedbackAcao erro={execucao.erro} className="mt-3" />
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Botao ref={voltar} variante="secundario" disabled={ocupado} onClick={cancelar}>
          Voltar
        </Botao>
        <Botao variante="perigo" disabled={ocupado || aguardaConferencia} aria-busy={ocupado || undefined} onClick={confirmar}>
          {ocupado ? "Confirmando…" : <>Confirmar {confirmacao}</>}
        </Botao>
      </div>
    </Modal>
  );
}
