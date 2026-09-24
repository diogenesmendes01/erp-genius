import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { carregarEnsaioComercial, carregarReguasComerciaisConfig, listarNumerosVendasResumo, listarTemplatesResumo } from "@/server/comercial/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { ReguasComerciaisPainel } from "../ReguaComercialPainel";
import { SECOES_WHATSAPP } from "../secoes";

// Régua comercial: administrador e gerente comercial (doc 27). Guard ANTES de qualquer consulta.
export default async function ReguasWhatsAppPage() {
  if (!(await exigirPapelLeitura(...SECOES_WHATSAPP.reguas.papeis))) return <AcessoNegado recurso="a régua comercial" />;
  const [reguas, numeros, templates, ensaio, preferencia] = await Promise.all([
    carregarReguasComerciaisConfig(),
    listarNumerosVendasResumo(),
    listarTemplatesResumo(),
    carregarEnsaioComercial(),
    consultarPreferenciaFusoEquipe(),
  ]);
  return (
    <ReguasComerciaisPainel
      reguas={reguas}
      numeros={numeros}
      templates={templates}
      ensaio={ensaio}
      preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null}
    />
  );
}
