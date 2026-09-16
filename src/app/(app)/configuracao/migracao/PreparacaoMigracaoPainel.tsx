"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { prepararLoteMigracao } from "@/server/migracao/acoes";

const exemplo = JSON.stringify([{ linhaOrigem: "alunos!2", tipoEntrada: "CADASTRO", aluno: { id: "aluno-001", nome: "Ana Lima", email: "ana@example.test", pais: "BR", fuso: "America/Sao_Paulo" }, dadosAdicionais: { observacao: "fotografia da origem" } }], null, 2);

export function PreparacaoMigracaoPainel() {
  const router = useRouter(); const [origem, setOrigem] = useState("OPERACIONAL_LETICIA"); const [chaveLote, setChaveLote] = useState(""); const [linhas, setLinhas] = useState(exemplo); const [mensagem, setMensagem] = useState(""); const [enviando, setEnviando] = useState(false);
  async function enviar() {
    setMensagem(""); let linhasLidas: unknown;
    try { linhasLidas = JSON.parse(linhas); } catch { setMensagem("As linhas precisam estar em JSON válido."); return; }
    setEnviando(true); const resultado = await prepararLoteMigracao({ origem, chaveLote, linhas: linhasLidas }); setEnviando(false);
    if (!resultado.ok) { setMensagem(resultado.erro); return; }
    setMensagem(resultado.dado?.revisaoNecessaria ? "A tentativa divergente foi preservada para revisão; a fotografia original não foi alterada." : resultado.dado?.repetido ? "O mesmo lote já estava preparado; nenhuma linha foi duplicada." : "Lote preparado. Revise as pendências antes de qualquer etapa futura."); router.refresh();
  }
  return <div className="space-y-3 rounded border p-4 text-sm"><p>Informe somente colunas de origem identificáveis: <code>linhaOrigem</code>, <code>tipoEntrada</code> e os blocos opcionais <code>aluno</code>, <code>turma</code>, <code>matricula</code> e <code>financeiro</code>. Campos desconhecidos ficam em <code>dadosAdicionais</code>; não são descartados nem aplicados.</p><div className="grid gap-3 sm:grid-cols-2"><label>Origem<input value={origem} onChange={(e) => setOrigem(e.target.value)} className="mt-1 block w-full rounded border p-2" /></label><label>Chave estável do lote<input value={chaveLote} onChange={(e) => setChaveLote(e.target.value)} placeholder="arquivo-2026-09-v1" className="mt-1 block w-full rounded border p-2" /></label></div><label className="block">Linhas de origem<textarea value={linhas} onChange={(e) => setLinhas(e.target.value)} rows={12} className="mt-1 block w-full rounded border p-2 font-mono text-xs" /></label><button disabled={enviando} onClick={enviar} className="rounded bg-brand-600 px-4 py-2 text-white disabled:opacity-50">{enviando ? "Preparando…" : "Preparar lote"}</button>{mensagem && <p role="status">{mensagem}</p>}</div>;
}
