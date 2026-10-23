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

// Aba "cobrancas" do /financeiro (E8: uma rota por aba). Guard da própria aba ANTES das consultas — o
// layout só decide a barra; uma rota pedida direto por quem não enxerga a aba não consulta nada.
// E4: cartão-indicador, busca, país e turma na URL (sobrevivem a F5/voltar e o link é compartilhável),
// lidos e validados aqui. Item 9 (docs/43 §6): a fila chega filtrada, ordenada e em TRECHOS, por cursor nos
// dois sentidos (`depois`/`antes`, decisão de 10/10/2026 para filas de trabalho); os contadores dos cartões
// e as opções dos selects continuam sobre a fila inteira.
export default async function CobrancasFinanceiroPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  const ctx = await contextoDaAba("cobrancas");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const parametros = await searchParams;
  const filtros = lerFiltrosFila(parametros);
  const nav = lerNavegacao(parametros);
  // Cursor fora do formato (link editado à mão): erro, sem consultar; a saída volta ao início com o mesmo recorte.
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
