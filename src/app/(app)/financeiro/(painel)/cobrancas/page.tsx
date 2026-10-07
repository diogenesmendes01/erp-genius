import { listarFilaCobranca } from "@/server/cobrancas/consultas";
import { filtrarFila, lerFiltrosFila, opcoesDaFila } from "@/server/cobrancas/filtros-fila";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import type { ParametrosUrl } from "@/lib/pagina-url";
import { FilaCobranca } from "../../FilaCobranca";
import { AcessoNegado } from "@/components/AcessoNegado";
import { contextoDaAba } from "../../contexto";

// Aba "cobrancas" do /financeiro (E8: uma rota por aba). Guard da própria aba ANTES das consultas — o
// layout só decide a barra; uma rota pedida direto por quem não enxerga a aba não consulta nada.
// E4: cartão-indicador, busca, país e turma na URL (sobrevivem a F5/voltar e o link é compartilhável),
// lidos e validados aqui; a fila chega ao cliente já filtrada e ordenada. Os contadores dos cartões e
// as opções dos selects continuam sobre a fila inteira.
export default async function CobrancasFinanceiroPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  const ctx = await contextoDaAba("cobrancas");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const filtros = lerFiltrosFila(await searchParams);
  const [fila, preferencia] = await Promise.all([listarFilaCobranca(), consultarPreferenciaFusoEquipe()]);
  return (
    <FilaCobranca
      itens={filtrarFila(fila.itens, filtros)}
      totalFila={fila.itens.length}
      filtros={filtros}
      opcoes={opcoesDaFila(fila.itens, filtros)}
      dashs={fila.dashs}
      regua={fila.regua}
      podeOperar={ctx.permissoes.podeOperarCobranca}
      podeBloquear={ctx.permissoes.podeAprovar}
      preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null}
    />
  );
}
