import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { RetomadasPainel } from "../../RetomadasPainel";
import { AcessoNegado } from "@/components/AcessoNegado";
import { carregarFilasPendentes, contextoDaAba } from "../../contexto";

// Aba "retomadas" do /financeiro (E8: uma rota por aba). Guard da própria aba ANTES das consultas — o
// layout só decide a barra; uma rota pedida direto por quem não enxerga a aba não consulta nada.
export default async function RetomadasFinanceiroPage() {
  const ctx = await contextoDaAba("retomadas");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const [filas, preferencia] = await Promise.all([carregarFilasPendentes(ctx.permissoes), consultarPreferenciaFusoEquipe()]);
  return <RetomadasPainel propostas={filas.retomadas} erroConsulta={filas.erroRetomadas} preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null} />;
}
