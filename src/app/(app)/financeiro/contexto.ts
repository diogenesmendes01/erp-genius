import { cache } from "react";
import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { listarInformesPagamento, podeConfigurarComissoes } from "@/server/financeiro/consultas";
import { listarAprovacoesPendentes } from "@/server/ajustes/consultas";
import { listarPropostasRetomada } from "@/server/retomada/consultas";
import { abasVisiveis, type AbaFinanceiro, type PermissoesFinanceiro } from "./abas";
import type { AprovacaoRow } from "./FinanceiroPainel";

// /financeiro por rota (docs/42-auditoria-frontend-ux.md, E8): o layout (barra de abas com contagens)
// e cada página de aba pedem o mesmo contexto — papéis, permissões e as três filas pendentes. Uma vez
// por requisição. `cache` vem do React embutido no Next; no Vitest (React 18.3) a função roda sem memo.
const memo: <F extends (...args: never[]) => unknown>(f: F) => F = typeof cache === "function" ? cache : (f) => f;

// Painel financeiro global (doc 07 / nav): Admin, Financeiro, Gerente Comercial.
const PAPEIS_FINANCEIRO: Papel[] = [Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL];

export type ContextoFinanceiro = { papeis: Papel[]; permissoes: PermissoesFinanceiro };

/** Papéis e permissões do financeiro; null sem acesso. Guard ANTES de qualquer dado sensível (issue #1). */
export const carregarContextoFinanceiro = memo(async (): Promise<ContextoFinanceiro | null> => {
  const papeis = await exigirPapelLeitura(...PAPEIS_FINANCEIRO);
  if (!papeis) return null;
  const tem = (p: Papel) => papeis.includes(p);
  return {
    papeis,
    permissoes: {
      // Operar cobrança (enviar/baixar/promessa) é de Financeiro/Admin; o Gerente Comercial lê o painel.
      podeOperarCobranca: tem(Papel.ADMINISTRADOR) || tem(Papel.FINANCEIRO),
      podeAprovar: tem(Papel.ADMINISTRADOR) || tem(Papel.GERENTE_COMERCIAL),
      // Cadastrar cotação de câmbio (alimenta a consolidação) é de Admin/Financeiro.
      podeGerenciarCambio: tem(Papel.ADMINISTRADOR) || tem(Papel.FINANCEIRO),
      podeConfigurarPoliticas: await podeConfigurarComissoes(),
    },
  };
});

/** Contexto só se o papel enxerga a aba — cada página repete o guard (layout não protege rota filha sozinho). */
export async function contextoDaAba(aba: AbaFinanceiro): Promise<ContextoFinanceiro | null> {
  const ctx = await carregarContextoFinanceiro();
  return ctx && abasVisiveis(ctx.permissoes).includes(aba) ? ctx : null;
}

/** As três filas pendentes: dão a contagem da barra e são o conteúdo das abas respectivas. */
export const carregarFilasPendentes = memo(async (p: PermissoesFinanceiro) => {
  const [informes, retomadas, aprovacoesRaw] = await Promise.all([
    p.podeOperarCobranca ? listarInformesPagamento() : Promise.resolve([]),
    p.podeOperarCobranca ? listarPropostasRetomada() : Promise.resolve({ ok: true as const, dado: [] }),
    p.podeAprovar ? listarAprovacoesPendentes() : Promise.resolve([]),
  ]);
  const aprovacoes: AprovacaoRow[] = aprovacoesRaw.map((a) => {
    const d = (a.payload ?? {}) as Record<string, unknown>;
    return {
      id: a.id,
      solicitante: a.solicitante.nome,
      tipo: a.tipo,
      motivo: a.motivo ?? "",
      vigencia: a.vigencia,
      impactoMensal: a.impactoMensal ?? 0,
      alunoNome: typeof d.alunoNome === "string" ? d.alunoNome : "—",
      valorDe: typeof d.valorDe === "number" ? d.valorDe : 0,
      valorPara: typeof d.valorPara === "number" ? d.valorPara : 0,
      descontoValor: typeof d.descontoValor === "number" ? d.descontoValor : 0,
      moeda: typeof d.moeda === "string" ? d.moeda : "",
    };
  });
  return {
    informes,
    retomadas: retomadas.ok ? retomadas.dado ?? [] : [],
    erroRetomadas: retomadas.ok ? null : retomadas.erro,
    aprovacoes,
  };
});
