import { Papel } from "@prisma/client";
import { exigirPapelLeitura, papeisTem } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import {
  carregarConfigComercial,
  carregarReguasComerciaisConfig,
  carregarEnsaioComercial,
  carregarSaudacoesSimuladas,
  listarNumerosVendasResumo,
  listarTemplatesResumo,
  listarVendedores,
} from "@/server/comercial/consultas";
import {
  carregarPoliticaConfig,
  listarNumerosConfig,
  listarTemplatesConfig,
} from "@/server/whatsapp/consultas";
import { NumerosPainel } from "./NumerosPainel";
import { TemplatesPainel } from "./TemplatesPainel";
import { PoliticaPainel } from "./PoliticaPainel";
import { metricasCopiloto } from "@/server/ia/consultas";
import { ComercialPainel } from "./ComercialPainel";
import { ReguasComerciaisPainel } from "./ReguaComercialPainel";

// CONFIG DO CANAL WHATSAPP (docs 26/30 · fase comercial doc 27).
// - Canal (número/QR, templates, política da régua): exclusivo do ADMINISTRADOR (D21).
// - Comercial (auto-lead + saudação, C1): também do GERENTE COMERCIAL — dono da automação
//   comercial (doc 08 §governança). Por isso a página aceita os dois papéis, mas SÓ carrega
//   e renderiza os painéis administrativos para o admin (review PR #53 P2: não ampliar o
//   guard inteiro — isso exporia número/sessão/templates/política ao gerente).

export default async function WhatsAppConfigPage() {
  const papeis = await exigirPapelLeitura(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
  if (!papeis) return <AcessoNegado recurso="a configuração do WhatsApp" />;
  const ehAdmin = papeisTem(papeis, Papel.ADMINISTRADOR);

  // Dados administrativos só são buscados para o admin (o gerente comercial vê só o comercial).
  const [admin, configComercial, saudacoesSimuladas, reguaComercial, numerosResumo, templatesResumo, ensaioComercial, metricasIA] =
    await Promise.all([
      ehAdmin
        ? Promise.all([listarNumerosConfig(), listarTemplatesConfig(), carregarPoliticaConfig(), listarVendedores()])
        : Promise.resolve(null),
      carregarConfigComercial(),
      carregarSaudacoesSimuladas(),
      carregarReguasComerciaisConfig(),
      listarNumerosVendasResumo(),
      listarTemplatesResumo(),
      carregarEnsaioComercial(),
      metricasCopiloto(),
    ]);

  return (
    <div className="space-y-10">
      {admin && (
        <>
          <NumerosPainel numeros={admin[0]} vendedores={admin[3]} />
          <TemplatesPainel templates={admin[1]} />
          <PoliticaPainel politica={admin[2]} numeros={admin[0]} templates={admin[1]} />
        </>
      )}
      <ComercialPainel config={configComercial} simuladas={saudacoesSimuladas} metricasCopiloto={metricasIA} />
      <ReguasComerciaisPainel reguas={reguaComercial} numeros={numerosResumo} templates={templatesResumo} ensaio={ensaioComercial} />
    </div>
  );
}
