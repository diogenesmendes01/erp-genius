import { configuracaoComissoes } from "@/server/financeiro/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { PoliticasComissao } from "../../PoliticasComissao";
import { DiaPrevisaoComissao } from "../../DiaPrevisaoComissao";
import { AcessoNegado } from "@/components/AcessoNegado";
import { contextoDaAba } from "../../contexto";

// Aba "politicas" do /financeiro (E8: uma rota por aba). Guard da própria aba ANTES das consultas — o
// layout só decide a barra; uma rota pedida direto por quem não enxerga a aba não consulta nada.
export default async function PoliticasFinanceiroPage() {
  const ctx = await contextoDaAba("politicas");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const [politicas, preferencia, fusoEscola] = await Promise.all([configuracaoComissoes(), consultarPreferenciaFusoEquipe(), fusoDaEscola()]);
  if (!politicas) return null;
  // D11: o dia da previsão de pagamento fica junto da política, com a mesma alçada (comissao.configurar).
  return <div className="space-y-6">
    <DiaPrevisaoComissao dia={politicas.diaPrevisaoPagamento} />
    <PoliticasComissao dados={politicas} preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null} fusoEscola={fusoEscola} />
  </div>;
}
