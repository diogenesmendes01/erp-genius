import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import {
  listarComissoes,
  kpisFinanceiro,
  dadosCambio,
  relatorioDescontosComissoes,
} from "@/server/financeiro/consultas";
import { listarFilaCobranca } from "@/server/cobrancas/consultas";
import { listarAprovacoesPendentes } from "@/server/ajustes/consultas";
import { FinanceiroPainel, type AprovacaoRow } from "./FinanceiroPainel";

// Guard server-side por papel ANTES de buscar dados sensíveis (issue #1).
// Papéis alinhados ao nav.ts; Administrador passa sempre (exigirPapelLeitura).
const PAPEIS_FINANCEIRO: Papel[] = [Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL];

export default async function FinanceiroPage() {
  // Painel financeiro global (doc 07 / nav): Admin, Financeiro, Gerente Comercial.
  // Bloqueia ANTES de consultar dados sensíveis (cobranças, comissões, aprovações).
  const papeis = await exigirPapelLeitura(...PAPEIS_FINANCEIRO);
  if (!papeis) return <AcessoNegado recurso="o financeiro" />;

  const podeAprovar =
    papeis.includes(Papel.ADMINISTRADOR) ||
    papeis.includes(Papel.GERENTE_COMERCIAL);
  // Cadastrar cotação de câmbio (alimenta a consolidação) é de Admin/Financeiro.
  const podeGerenciarCambio =
    papeis.includes(Papel.ADMINISTRADOR) || papeis.includes(Papel.FINANCEIRO);
  // Operar cobrança (enviar/baixar/promessa) é de Financeiro/Admin (PAPEIS_BAIXA + Admin).
  // Gerente Comercial LÊ o painel mas não opera — os botões de ação ficam escondidos p/ ele.
  const podeOperarCobranca =
    papeis.includes(Papel.ADMINISTRADOR) || papeis.includes(Papel.FINANCEIRO);

  const [fila, comissoes, kpis, aprovacoesRaw, cotacoes, relatorio] = await Promise.all([
    listarFilaCobranca(),
    listarComissoes(),
    kpisFinanceiro(),
    listarAprovacoesPendentes(),
    dadosCambio(),
    relatorioDescontosComissoes(),
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
      fila={fila}
      comissoes={comissoes}
      kpis={kpis}
      aprovacoes={aprovacoes}
      podeAprovar={podeAprovar}
      podeOperarCobranca={podeOperarCobranca}
      cotacoes={cotacoes}
      relatorio={relatorio}
      podeGerenciarCambio={podeGerenciarCambio}
    />
  );
}
