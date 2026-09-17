import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPresencasHistoricasMigracao, listarAulasElegiveisPresencaHistoricaMigracao } from "@/server/migracao/presenca-historica";
import { PresencaHistorica } from "./PresencaHistorica";

export default async function PresencaHistoricaPage({params}:{params:Promise<{linhaId:string}>}) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA,Papel.GERENTE_PEDAGOGICO,Papel.ADMINISTRADOR); const {linhaId}=await params;
  const [aulas,propostas]=await Promise.all([listarAulasElegiveisPresencaHistoricaMigracao(linhaId),consultarPresencasHistoricasMigracao(linhaId)]);
  const historico = propostas.ok && Array.isArray(propostas.dado) ? propostas.dado : [];
  return <section className="max-w-4xl space-y-4"><Link className="text-brand-700 underline" href="/configuracao/migracao">Voltar aos lotes</Link><h2 className="text-lg font-medium">Presença histórica M01</h2><p className="text-sm text-gray-600">Selecione uma aula histórica já registrada. A aprovação acadêmica de outra pessoa apenas cria o registro ausente, vincula o igual ou encaminha divergência para correção Q23.</p><PresencaHistorica linhaId={linhaId} aulas={aulas.ok&&aulas.dado?aulas.dado.map(a=>({...a,ocorridaEm:a.ocorridaEm.toISOString()})):[]} propostas={historico}/></section>;
}
