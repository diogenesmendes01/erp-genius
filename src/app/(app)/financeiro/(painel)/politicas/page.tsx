import { configuracaoComissoes } from "@/server/financeiro/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { PoliticasComissao } from "../../PoliticasComissao";
import { DiaPrevisaoComissao } from "../../DiaPrevisaoComissao";
import { AcessoNegado } from "@/components/AcessoNegado";
import { contextoDaAba } from "../../contexto";

export default async function PoliticasFinanceiroPage() {
  const ctx = await contextoDaAba("politicas");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const [politicas, preferencia, fusoEscola] = await Promise.all([configuracaoComissoes(), consultarPreferenciaFusoEquipe(), fusoDaEscola()]);
  if (!politicas) return null;
  return <div className="space-y-6">
    <DiaPrevisaoComissao dia={politicas.diaPrevisaoPagamento} />
    <PoliticasComissao dados={politicas} preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null} fusoEscola={fusoEscola} />
  </div>;
}
