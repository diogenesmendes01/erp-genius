"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { emitirFechamentoHoras } from "@/server/matricula/fechamento-horas-emissao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { formatarMoeda } from "@/lib/dinheiro";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";

// "Emitir cobrança aprovada" emite uma cobrança REAL (docs/42 L906): o botão só abre a confirmação, que
// exige marcar "Confirmo a emissão de {valor} para este período" — o mesmo rigor da tela irmã de decisão.
// A action roda no ConfirmarAcao (erro e resultado incerto ficam no diálogo); aqui fica o sucesso.
export function EmitirFechamento({ alunoId, matriculaId, decisaoId, valor, moeda }: {
  alunoId: string; matriculaId: string; decisaoId: string; valor: string; moeda: string;
}) {
  const router = useRouter();
  // Idempotente por natureza (#166): a emissão é uma por decisão; repetir devolve a mesma emissão e a mesma
  // cobrança, sem gravar nada (emitirFechamentoHorasTx).
  const resultado = useAcaoCliente({ idempotente: true });
  const [confirmando, setConfirmando] = useState(false);
  const total = formatarMoeda(valor, moeda);
  return <div className="space-y-2 rounded border p-4">
    <p>Emitir cobrança de {total} referente aos itens desta versão aprovada. O sistema verificará novamente as origens antes da emissão.</p>
    <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={() => { resultado.limpar(); setConfirmando(true); }}>Emitir cobrança aprovada</button>
    <FeedbackAcao erro={null} sucesso={resultado.sucesso} />
    {confirmando && <ConfirmarAcao
      titulo={`Emitir a cobrança de ${total}?`}
      confirmacao="emissão da cobrança"
      conferencia={`Confirmo a emissão de ${total} para este período.`}
      idempotente
      acao={() => emitirFechamentoHoras({ alunoId, matriculaId, decisaoId })}
      aoConcluir={() => {
        setConfirmando(false);
        resultado.setSucesso("Cobrança emitida. Consulte o registro abaixo; isso não confirma pagamento.");
        router.refresh();
      }}
      aoCancelar={() => setConfirmando(false)}
    >
      <p>Uma cobrança real de <strong>{total}</strong> é emitida para os itens desta versão aprovada do fechamento de horas.</p>
      <p>Antes de emitir, o servidor confere de novo as origens; se mudaram, nada é emitido e é preciso preparar nova versão. Emitida, a cobrança não é desfeita por esta tela.</p>
    </ConfirmarAcao>}
  </div>;
}
