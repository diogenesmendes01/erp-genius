"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { prepararImpactosTaxaAditivo } from "@/server/contratos/aditivo-taxa-impactos";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { formatarMoeda } from "@/lib/dinheiro";
import { formatarDataCivil } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";

type Cobranca = { id: string; codigo: string | null; moeda: string; valorNegociado: string; vencimento: string };

export function ImpactosTaxaFormulario({ matriculaId, propostaId, conclusaoId, revisaoHash, cobrancas }: { matriculaId: string; propostaId: string; conclusaoId: string; revisaoHash: string; cobrancas: Cobranca[] }) {
  const router = useRouter();
  const [decisoes, setDecisoes] = useState<Record<string, "AFETADA" | "PRESERVADA">>(() => Object.fromEntries(cobrancas.map(c => [c.id, "AFETADA"])));
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  // Chave estável entre tentativas da mesma entrada: na falha de transporte, reenviar confere o mesmo conjunto.
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  const linhas = cobrancas.map(c => ({ cobrancaId: c.id, decisao: decisoes[c.id] ?? "AFETADA", justificativa: (justificativas[c.id] ?? "").trim() }));
  const podePreparar = linhas.length > 0 && linhas.every(l => l.justificativa.length >= 5);

  async function preparar() {
    if (acao.ocupado || !podePreparar) return;
    const dados = { matriculaId, propostaId, conclusaoId, revisaoHash, linhas };
    const entrada = JSON.stringify(dados);
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current.chave;
    const d = await acao.executar(() => prepararImpactosTaxaAditivo({ ...dados, chaveIdempotencia }),
      "Conjunto preparado. O Financeiro deve vincular os acertos das taxas afetadas antes da aprovação independente.");
    if (d?.tipo !== "ok") return;
    tentativa.current = null; router.refresh();
  }

  return <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Impactos de todas as taxas</h2>
    <p>Classifique cada cobrança de taxa. Cobranças preservadas também exigem justificativa; a assinatura não altera valores sozinha.</p>
    {!cobrancas.length ? <EstadoVazio role="status">Nenhuma cobrança de taxa foi encontrada para esta matrícula.</EstadoVazio> : <fieldset disabled={acao.ocupado} className="space-y-3">{cobrancas.map(c => <article className="space-y-2 rounded border p-3" key={c.id}>
      <p className="font-medium">{c.codigo ?? "Taxa sem código"} · {formatarMoeda(c.valorNegociado, c.moeda)} · vencimento {formatarDataCivil(c.vencimento.slice(0, 10))}</p>
      <label className="block">Tratamento<select className="ml-2 rounded border p-1" value={decisoes[c.id] ?? "AFETADA"} onChange={e => setDecisoes(atual => ({ ...atual, [c.id]: e.target.value as "AFETADA" | "PRESERVADA" }))}><option value="AFETADA">Afetada pelo aditivo</option><option value="PRESERVADA">Preservada</option></select></label>
      <label className="block">Justificativa<CampoTexto className="mt-1 block w-full rounded border p-2" minLength={5} maxLength={2000} value={justificativas[c.id] ?? ""} onChange={e => setJustificativas(atual => ({ ...atual, [c.id]: e.target.value }))} /></label>
    </article>)}</fieldset>}
    <button type="button" className={botaoClasses({ tamanho: "lg" })} disabled={!podePreparar || acao.ocupado} onClick={preparar}>{acao.ocupado ? "Preparando…" : "Preparar conjunto de impactos"}</button>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </section>;
}
