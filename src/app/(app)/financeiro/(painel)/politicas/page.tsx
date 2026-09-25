import { configuracaoComissoes } from "@/server/financeiro/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { PoliticasComissao } from "../../PoliticasComissao";
import { AcessoNegado } from "@/components/AcessoNegado";
import { contextoDaAba } from "../../contexto";

// Aba "politicas" do /financeiro (E8: uma rota por aba). Guard da própria aba ANTES das consultas — o
// layout só decide a barra; uma rota pedida direto por quem não enxerga a aba não consulta nada.
export default async function PoliticasFinanceiroPage() {
  const ctx = await contextoDaAba("politicas");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const [politicas, preferencia] = await Promise.all([configuracaoComissoes(), consultarPreferenciaFusoEquipe()]);
  return politicas ? <PoliticasComissao dados={politicas} preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null} /> : null;
}
