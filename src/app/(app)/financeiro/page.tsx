import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import {
  listarCobrancasAbertas,
  listarComissoes,
  kpisFinanceiro,
} from "@/server/financeiro/consultas";
import { listarAprovacoesPendentes } from "@/server/ajustes/consultas";
import { FinanceiroPainel, type AprovacaoRow } from "./FinanceiroPainel";

// Guard server-side por papel ANTES de buscar dados sensíveis (issue #1).
// Papéis alinhados ao nav.ts; Administrador passa sempre (exigirPapelLeitura).
const PAPEIS_FINANCEIRO: Papel[] = [Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL];

export default async function FinanceiroPage() {
  const papeis = await exigirPapelLeitura(...PAPEIS_FINANCEIRO);
  if (!papeis) return <AcessoNegado recurso="o financeiro" />;

  const podeAprovar =
    papeis.includes(Papel.ADMINISTRADOR) || papeis.includes(Papel.GERENTE_COMERCIAL);

  const [cobrancas, comissoes, kpis, aprovacoesRaw] = await Promise.all([
    listarCobrancasAbertas(),
    listarComissoes(),
    kpisFinanceiro(),
    listarAprovacoesPendentes(),
  ]);

  const aprovacoes: AprovacaoRow[] = aprovacoesRaw.map((a) => {
    const p = (a.payload ?? {}) as Record<string, unknown>;
    return {
      id: a.id,
      solicitante: a.solicitante.nome,
      tipo: a.tipo,
      motivo: a.motivo ?? "",
      vigencia: a.vigencia,
      impactoMensal: a.impactoMensal ?? 0,
      alunoNome: typeof p.alunoNome === "string" ? p.alunoNome : "—",
      valorDe: typeof p.valorDe === "number" ? p.valorDe : 0,
      valorPara: typeof p.valorPara === "number" ? p.valorPara : 0,
      descontoValor: typeof p.descontoValor === "number" ? p.descontoValor : 0,
      moeda: typeof p.moeda === "string" ? p.moeda : "",
    };
  });

  return (
    <FinanceiroPainel
      cobrancas={cobrancas}
      comissoes={comissoes}
      kpis={kpis}
      aprovacoes={aprovacoes}
      podeAprovar={podeAprovar}
    />
  );
}
