"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { aplicarCadastroPreparacaoMigracao } from "@/server/migracao/aplicacao-cadastro";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { SITUACAO_APLICACAO_CADASTRO_MIGRACAO_LABEL, rotular } from "@/lib/labels";

export function AplicarCadastroMigracao({ loteId }: { loteId: string }) {
  // Sem chave de idempotência: na falha de transporte, conferir antes de repetir (MSG_RESULTADO_INCERTO_SEM_CHAVE).
  const router = useRouter(); const acao = useAcaoCliente({ idempotente: false }); const [linhas, setLinhas] = useState<{ linhaOrigem: string; situacao: string; alunoId: string | null; detalhe: string | null }[]>([]); const [confirmacaoHash, setConfirmacaoHash] = useState<string | null>(null);
  async function executar(modo: "ENSAIO" | "APLICAR") {
    const d = await acao.executar(() => aplicarCadastroPreparacaoMigracao({ loteId, modo, ...(modo === "APLICAR" && confirmacaoHash ? { confirmacaoHash } : {}) }), (dado) => dado?.explicacao ?? null);
    if (d?.tipo !== "ok") return;
    if (!d.dado) { acao.setErro("Não foi possível processar o lote."); return; }
    setLinhas("resultados" in d.dado ? d.dado.resultados : []); if (modo === "ENSAIO") setConfirmacaoHash(d.dado.confirmacaoHash); else setConfirmacaoHash(null);
    router.refresh();
  }
  return <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm"><strong>Aplicação limitada a cadastros de alunos</strong><p className="mt-1">Ensaio e aplicação só usam linhas CADASTRO completas, sem pendências ou colisões. Turmas, matrículas, financeiro, consentimentos, presença e contas continuam sem aplicação.</p><div className="mt-2 flex gap-2"><button type="button" className={botaoClasses({ variante: "secundario", tamanho: "md" })} disabled={acao.ocupado} onClick={() => executar("ENSAIO")}>{acao.ocupado ? "Processando…" : "Ensaiar cadastros"}</button><button type="button" className={botaoClasses({ tamanho: "md" })} disabled={acao.ocupado || !confirmacaoHash} onClick={() => executar("APLICAR")}>{acao.ocupado ? "Processando…" : "Aplicar cadastros confirmados"}</button></div><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mt-2" />{!confirmacaoHash && <p className="mt-2 text-xs">A aplicação só libera depois de um ensaio desta fotografia.</p>}{linhas.length > 0 && <ul className="mt-2 space-y-1 text-xs">{linhas.map((linha) => <li key={linha.linhaOrigem}><strong>{linha.linhaOrigem}</strong>: {linha.situacao ? rotular(SITUACAO_APLICACAO_CADASTRO_MIGRACAO_LABEL, linha.situacao) : "sem evidência"}{linha.alunoId ? ` · destino ${linha.alunoId}` : ""}{linha.detalhe ? ` · ${linha.detalhe}` : ""}</li>)}</ul>}</div>;
}
