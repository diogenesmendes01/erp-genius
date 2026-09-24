import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { carregarConfigComercial, carregarSaudacoesSimuladas, listarNumerosVendasResumo } from "@/server/comercial/consultas";
import { metricasCopiloto } from "@/server/ia/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { ComercialPainel } from "../ComercialPainel";
import { SECOES_WHATSAPP } from "../secoes";

// Automação comercial (auto-lead + saudação, C1): administrador e gerente comercial (doc 08 §governança).
// Guard ANTES de qualquer consulta (inclusive a preferência de fuso).
export default async function ComercialWhatsAppPage() {
  if (!(await exigirPapelLeitura(...SECOES_WHATSAPP.comercial.papeis))) return <AcessoNegado recurso="a configuração comercial do WhatsApp" />;
  const [config, simuladas, numerosResumo, preferencia, metricas] = await Promise.all([
    carregarConfigComercial(),
    carregarSaudacoesSimuladas(),
    listarNumerosVendasResumo(),
    consultarPreferenciaFusoEquipe(),
    metricasCopiloto(),
  ]);
  return (
    <ComercialPainel
      config={config}
      simuladas={simuladas}
      preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null}
      metricasCopiloto={metricas}
      numerosVendas={numerosResumo.filter((n) => n.finalidade === "VENDAS").map((n) => ({ id: n.id, rotulo: n.rotulo }))}
    />
  );
}
