import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import {
  listarComissoes,
  listarInformesPagamento,
  configuracaoComissoes,
  podeConfigurarComissoes,
  kpisFinanceiro,
  dadosCambio,
  relatorioDescontosComissoes,
  carregarConfigFinanceiro,
} from "@/server/financeiro/consultas";
import { listarFilaCobranca } from "@/server/cobrancas/consultas";
import { listarAprovacoesPendentes } from "@/server/ajustes/consultas";
import { FinanceiroPainel, type AprovacaoRow } from "../FinanceiroPainel";
import { listarPropostasRetomada } from "@/server/retomada/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverAba } from "../abas";

// Guard server-side por papel ANTES de buscar dados sensíveis (issue #1).
// Papéis alinhados ao nav.ts; Administrador passa sempre (exigirPapelLeitura).
const PAPEIS_FINANCEIRO: Papel[] = [Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL];

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
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

  const podeConfigurarPoliticas = await podeConfigurarComissoes();
  const permissoes = { podeOperarCobranca, podeAprovar, podeGerenciarCambio, podeConfigurarPoliticas };
  // A aba vem da URL e só é aceita se o papel a enxerga (resolverAba); inválida ou proibida cai na padrão.
  const aba = resolverAba((await searchParams).aba, permissoes);

  // Só as consultas da aba ativa (E8, passo barato) — antes as 11 rodavam a cada visita e a cada
  // refresh, para mostrar uma aba só. As três filas pendentes (informes, retomadas, aprovações) seguem
  // sempre: são curtas e dão a contagem que aparece no rótulo da aba.
  const na = (...abas: (typeof aba)[]) => abas.includes(aba);
  const [fila, comissoes, kpis, aprovacoesRaw, cotacoes, relatorio, informes, politicas, retomadas, preferencia, configFinanceiro] = await Promise.all([
    podeOperarCobranca && na("cobrancas") ? listarFilaCobranca() : Promise.resolve({ itens: [], dashs: { aVencer: 0, emAtraso: 0, bloquear: 0, promessas: 0, recebidoHoje: [] }, regua: [] }),
    na("comissoes") ? listarComissoes() : Promise.resolve([]),
    podeOperarCobranca && na("geral") ? kpisFinanceiro() : Promise.resolve({ recebidoMes: [], emAtraso: [], aReceber: [], comissoesAPagar: [], novasMatriculas: 0 }),
    podeAprovar ? listarAprovacoesPendentes() : Promise.resolve([]),
    podeOperarCobranca && na("geral", "cambio") ? dadosCambio() : Promise.resolve([]),
    na("descontos") ? relatorioDescontosComissoes() : Promise.resolve(null),
    podeOperarCobranca ? listarInformesPagamento() : Promise.resolve([]),
    podeConfigurarPoliticas && na("politicas") ? configuracaoComissoes() : Promise.resolve(null),
    podeOperarCobranca ? listarPropostasRetomada() : Promise.resolve({ ok: true as const, dado: [] }),
    consultarPreferenciaFusoEquipe(),
    na("comissoes") ? carregarConfigFinanceiro() : Promise.resolve({ fechamentoComissaoAutomatico: false }),
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
      <Link className="underline" href="/financeiro/acertos-taxa">Conferir acertos de taxa por aditivo</Link>
      <Link className="underline" href="/financeiro/acertos-cobertura">Conferir correções de cobertura por aditivo</Link>
      <Link className="underline" href="/financeiro/desistencias">Conferir desistências de matrículas</Link>
      <Link className="underline" href="/financeiro/recebimentos">Registrar recebimento com destinações</Link>
      <Link className="underline" href="/financeiro/migracao">Conferir conciliação da migração</Link>
      <Link className="underline" href="/financeiro/continuidade">Acompanhar continuidade mensal</Link>
    </div>}
    <FinanceiroPainel
      aba={aba}
      podeConfigurarPoliticas={podeConfigurarPoliticas}
      configFinanceiro={configFinanceiro}
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
      preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null}
    />
    </>
  );
}
