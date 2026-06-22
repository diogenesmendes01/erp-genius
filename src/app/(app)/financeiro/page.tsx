import { Papel } from "@prisma/client";
import {
  listarCobrancasAbertas,
  listarComissoes,
  kpisFinanceiro,
} from "@/server/financeiro/consultas";
import { listarAprovacoesPendentes } from "@/server/ajustes/consultas";
import { exigirSessaoPagina } from "@/server/_shared";
import { FinanceiroPainel, type AprovacaoRow } from "./FinanceiroPainel";

export default async function FinanceiroPage() {
  // Painel financeiro global (doc 07 / nav): Admin, Financeiro, Gerente Comercial.
  // Bloqueia ANTES de consultar dados sensíveis (cobranças, comissões, aprovações).
  const usuario = await exigirSessaoPagina(
    Papel.FINANCEIRO,
    Papel.GERENTE_COMERCIAL,
  );
  const podeAprovar =
    usuario.papeis.includes(Papel.ADMINISTRADOR) ||
    usuario.papeis.includes(Papel.GERENTE_COMERCIAL);

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
