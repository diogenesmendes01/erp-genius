import Link from "next/link";
import { listarFilaCobranca } from "@/server/cobrancas/consultas";
import { hrefFila, lerFiltrosFila, navegacaoDaFilaValida } from "@/server/cobrancas/filtros-fila";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { cursorDaLeitura, lerNavegacao, MENSAGEM_CURSOR_INVALIDO, validarNavegacao } from "@/lib/cursor-fila";
import type { ParametrosUrl } from "@/lib/pagina-url";
import { FilaCobranca } from "../../FilaCobranca";
import { AcessoNegado } from "@/components/AcessoNegado";
import { contextoDaAba } from "../../contexto";

export default async function CobrancasFinanceiroPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  const ctx = await contextoDaAba("cobrancas");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const parametros = await searchParams;
  const filtros = lerFiltrosFila(parametros);
  const nav = lerNavegacao(parametros);
  const validacao = validarNavegacao(nav);
  if (!validacao.ok || !navegacaoDaFilaValida(nav)) {
    return (
      <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {validacao.ok ? MENSAGEM_CURSOR_INVALIDO : validacao.erro}{" "}
        <Link href={hrefFila(filtros)} className="underline">Ir para o início da fila</Link>
      </p>
    );
  }
  const [fila, preferencia, fusoEscola] = await Promise.all([listarFilaCobranca({ filtros, navegacao: validacao.nav }), consultarPreferenciaFusoEquipe(), fusoDaEscola()]);
  return (
    <FilaCobranca
      itens={fila.itens}
      totalFila={fila.totalFila}
      totalVisao={fila.totalVisao}
      filtros={filtros}
      opcoes={fila.opcoes}
      dashs={fila.dashs}
      regua={fila.regua}
      navegacao={{ anterior: fila.anterior, proxima: fila.proxima }}
      inicioDaFila={cursorDaLeitura(nav) !== null ? hrefFila(filtros) : null}
      podeOperar={ctx.permissoes.podeOperarCobranca}
      podeBloquear={ctx.permissoes.podeAprovar}
      preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null}
      fusoEscola={fusoEscola}
    />
  );
}
