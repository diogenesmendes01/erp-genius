import { dadosCambio } from "@/server/financeiro/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { CambioAba } from "../../FinanceiroPainel";
import { AcessoNegado } from "@/components/AcessoNegado";
import { contextoDaAba } from "../../contexto";

// Aba "cambio" do /financeiro (E8: uma rota por aba). Guard da própria aba ANTES das consultas — o
// layout só decide a barra; uma rota pedida direto por quem não enxerga a aba não consulta nada.
export default async function CambioFinanceiroPage() {
  const ctx = await contextoDaAba("cambio");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const [cotacoes, preferencia] = await Promise.all([dadosCambio(), consultarPreferenciaFusoEquipe()]);
  return <CambioAba cotacoes={cotacoes} preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null} />;
}
