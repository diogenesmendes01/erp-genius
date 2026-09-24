"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { aplicarCadastroPreparacaoMigracao } from "@/server/migracao/aplicacao-cadastro";
import { MensagemStatus } from "@/components/MensagemStatus";

export function AplicarCadastroMigracao({ loteId }: { loteId: string }) {
  const router = useRouter(); const [ocupado, setOcupado] = useState(false); const [resultado, setResultado] = useState<string | null>(null); const [linhas, setLinhas] = useState<{ linhaOrigem: string; situacao: string; alunoId: string | null; detalhe: string | null }[]>([]); const [confirmacaoHash, setConfirmacaoHash] = useState<string | null>(null);
  async function executar(modo: "ENSAIO" | "APLICAR") {
    setOcupado(true); setResultado(null);
    try {
      const r = await aplicarCadastroPreparacaoMigracao({ loteId, modo, ...(modo === "APLICAR" && confirmacaoHash ? { confirmacaoHash } : {}) });
      if (!r.ok || !r.dado) { setResultado(r.ok ? "Não foi possível processar o lote." : r.erro); return; }
      setResultado(r.dado.explicacao);
      setLinhas("resultados" in r.dado ? r.dado.resultados : []); if (modo === "ENSAIO") setConfirmacaoHash(r.dado.confirmacaoHash); else setConfirmacaoHash(null);
      router.refresh();
    } catch { setResultado("Não foi possível processar o lote."); } finally { setOcupado(false); }
  }
  return <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm"><strong>Aplicação limitada a cadastros de alunos</strong><p className="mt-1">Ensaio e aplicação só usam linhas CADASTRO completas, sem pendências ou colisões. Turmas, matrículas, financeiro, consentimentos, presença e contas continuam sem aplicação.</p><div className="mt-2 flex gap-2"><button type="button" className="rounded border px-3 py-1" disabled={ocupado} onClick={() => executar("ENSAIO")}>{ocupado ? "Processando…" : "Ensaiar cadastros"}</button><button type="button" className="rounded bg-brand-solid px-3 py-1 text-white" disabled={ocupado || !confirmacaoHash} onClick={() => executar("APLICAR")}>{ocupado ? "Processando…" : "Aplicar cadastros confirmados"}</button></div>{!confirmacaoHash && <p className="mt-2 text-xs">A aplicação só libera depois de um ensaio desta fotografia.</p>}<MensagemStatus texto={resultado} className="mt-2" />{linhas.length > 0 && <ul className="mt-2 space-y-1 text-xs">{linhas.map((linha) => <li key={linha.linhaOrigem}><strong>{linha.linhaOrigem}</strong>: {linha.situacao ?? "sem evidência"}{linha.alunoId ? ` · destino ${linha.alunoId}` : ""}{linha.detalhe ? ` · ${linha.detalhe}` : ""}</li>)}</ul>}</div>;
}
