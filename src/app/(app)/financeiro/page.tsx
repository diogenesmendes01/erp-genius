import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import {
  listarComissoes,
  listarInformesPagamento,
  configuracaoComissoes,
  kpisFinanceiro,
  dadosCambio,
  relatorioDescontosComissoes,
} from "@/server/financeiro/consultas";
import { listarFilaCobranca } from "@/server/cobrancas/consultas";
import { listarAprovacoesPendentes } from "@/server/ajustes/consultas";
import { FinanceiroPainel, type AprovacaoRow } from "./FinanceiroPainel";
import { listarPropostasRetomada } from "@/server/retomada/consultas";

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

  const [fila, comissoes, kpis, aprovacoesRaw, cotacoes, relatorio, informes, politicas, retomadas] = await Promise.all([
    podeOperarCobranca ? listarFilaCobranca() : Promise.resolve({ itens: [], dashs: { aVencer: 0, emAtraso: 0, bloquear: 0, promessas: 0, recebidoHoje: [] }, regua: [] }),
    listarComissoes(),
    podeOperarCobranca ? kpisFinanceiro() : Promise.resolve({ recebidoMes: [], emAtraso: [], aReceber: [], comissoesAPagar: [], novasMatriculas: 0 }),
    listarAprovacoesPendentes(),
    podeOperarCobranca ? dadosCambio() : Promise.resolve([]),
    relatorioDescontosComissoes(),
    podeOperarCobranca ? listarInformesPagamento() : Promise.resolve([]),
    configuracaoComissoes(),
    podeOperarCobranca ? listarPropostasRetomada() : Promise.resolve({ ok: true as const, dado: [] }),
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
    <>
    {podeOperarCobranca && <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
      <Link className="underline" href="/financeiro/desistencias">Conferir desistências de matrículas</Link>
      <Link className="underline" href="/financeiro/continuidade">Acompanhar continuidade mensal</Link>
    </div>}
    <FinanceiroPainel
      fila={fila}
      informes={informes}
      politicas={politicas}
      retomadas={retomadas.ok ? retomadas.dado ?? [] : []}
      erroRetomadas={retomadas.ok ? null : retomadas.erro}
      comissoes={comissoes}
      kpis={kpis}
      aprovacoes={aprovacoes}
      podeAprovar={podeAprovar}
      podeOperarCobranca={podeOperarCobranca}
      cotacoes={cotacoes}
      relatorio={relatorio}
      podeGerenciarCambio={podeGerenciarCambio}
    />
    </>
  );
}
