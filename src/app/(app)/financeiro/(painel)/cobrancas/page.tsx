import { listarFilaCobranca } from "@/server/cobrancas/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { FilaCobranca } from "../../FilaCobranca";
import { AcessoNegado } from "@/components/AcessoNegado";
import { contextoDaAba } from "../../contexto";

// Aba "cobrancas" do /financeiro (E8: uma rota por aba). Guard da própria aba ANTES das consultas — o
// layout só decide a barra; uma rota pedida direto por quem não enxerga a aba não consulta nada.
export default async function CobrancasFinanceiroPage() {
  const ctx = await contextoDaAba("cobrancas");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const [fila, preferencia] = await Promise.all([listarFilaCobranca(), consultarPreferenciaFusoEquipe()]);
  return (
    <FilaCobranca
      itens={fila.itens}
      dashs={fila.dashs}
      regua={fila.regua}
      podeOperar={ctx.permissoes.podeOperarCobranca}
      podeBloquear={ctx.permissoes.podeAprovar}
      preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null}
    />
  );
}
