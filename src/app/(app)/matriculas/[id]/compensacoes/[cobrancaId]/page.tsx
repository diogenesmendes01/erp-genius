import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCompensacoesCobertura } from "@/server/matricula/compensacao-cobertura-consulta";
import { CompensacaoCobertura } from "./CompensacaoCobertura";
import { VoltarPara } from "@/components/VoltarPara";

export default async function CompensacaoCoberturaPage({
  params,
}: {
  params: Promise<{ id: string; cobrancaId: string }>;
}) {
  await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const { id: matriculaId, cobrancaId } = await params;
  const resultado = await consultarCompensacoesCobertura({ matriculaId, cobrancaId });

  return <div className="space-y-4">
    <VoltarPara href={`/matriculas/${matriculaId}/indisponibilidade-oferta`} para="Relatos de indisponibilidade" />
    <h1 className="text-2xl">Direito a compensação de dias</h1>
    <p>Esta etapa reconhece dias de indisponibilidade na cobertura da mensalidade. Ela não recompõe aulas, não altera a cobertura e não emite ou ajusta cobranças.</p>
    {!resultado.ok || !resultado.dado ? <p role="alert">{resultado.ok ? "Consulta de compensação indisponível." : resultado.erro}</p> : <CompensacaoCobertura matriculaId={matriculaId} dados={resultado.dado} />}
  </div>;
}
