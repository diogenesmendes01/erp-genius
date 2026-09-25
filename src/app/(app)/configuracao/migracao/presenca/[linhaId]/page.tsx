import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPresencasHistoricasMigracao, listarAulasElegiveisPresencaHistoricaMigracao } from "@/server/migracao/presenca-historica";
import { PresencaHistorica } from "./PresencaHistorica";
import { VoltarPara } from "@/components/VoltarPara";

export default async function PresencaHistoricaPage({params}:{params:Promise<{linhaId:string}>}) {
  const usuario=await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA,Papel.GERENTE_PEDAGOGICO,Papel.ADMINISTRADOR); const {linhaId}=await params;
  const [aulas,propostas]=await Promise.all([listarAulasElegiveisPresencaHistoricaMigracao(linhaId),consultarPresencasHistoricasMigracao(linhaId)]);
  if(!aulas.ok)return <section className="max-w-4xl space-y-4"><VoltarPara href="/configuracao/migracao" /><h2 className="text-lg font-medium">Presença histórica da migração</h2><p role="alert" className="rounded border border-red-200 bg-red-50 p-3">Não foi possível consultar as aulas elegíveis: {aulas.erro}.</p></section>;
  if(!propostas.ok)return <section className="max-w-4xl space-y-4"><VoltarPara href="/configuracao/migracao" /><h2 className="text-lg font-medium">Presença histórica da migração</h2><p role="alert" className="rounded border border-red-200 bg-red-50 p-3">Não foi possível consultar as propostas: {propostas.erro}.</p></section>;
  const aulasLegiveis=(aulas.dado??[]).map(a=>({...a,ocorridaEm:a.ocorridaEm.toISOString()})); const historico=Array.isArray(propostas.dado)?propostas.dado:[];
  return <section className="max-w-4xl space-y-4"><VoltarPara href="/configuracao/migracao" /><h2 className="text-lg font-medium">Presença histórica da migração</h2><p className="text-sm text-gray-600">Secretaria, Gestão Pedagógica ou Administração propõem. Gestão Pedagógica ou Administração decide de forma independente. A divergência preserva o registro existente e se resolve pela correção de aula, no diário.</p><PresencaHistorica linhaId={linhaId} aulas={aulasLegiveis} propostas={historico as never[]} podePropor={usuario.papeis.includes(Papel.SECRETARIA_ACADEMICA)||usuario.papeis.includes(Papel.GERENTE_PEDAGOGICO)||usuario.papeis.includes(Papel.ADMINISTRADOR)} podeDecidir={usuario.papeis.includes(Papel.GERENTE_PEDAGOGICO)||usuario.papeis.includes(Papel.ADMINISTRADOR)} atorId={usuario.id}/></section>;
}
