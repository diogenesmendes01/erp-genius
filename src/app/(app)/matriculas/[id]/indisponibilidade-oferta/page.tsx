import Link from "next/link";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarRelatosIndisponibilidadeOferta } from "@/server/matricula/indisponibilidade-oferta-relato";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { RelatosIndisponibilidadeOferta } from "./RelatosIndisponibilidadeOferta";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const { id } = await params;
  const paginaInformada = Number((await searchParams).pagina ?? "1");
  const pagina = Number.isInteger(paginaInformada) && paginaInformada > 0 && paginaInformada <= 100_000 ? paginaInformada : 1;
  const [resultado, configuracao] = await Promise.all([
    consultarRelatosIndisponibilidadeOferta({ matriculaId: id, pagina }),
    prisma.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } }),
  ]);
  const fuso = FusoInstitucionalSchema.safeParse(configuracao?.fusoInstitucional);
  return <div className="space-y-4">
    <Link href={`/matriculas/${id}/disponibilidade-oferta`} className="block underline">Confirmações de oferta pela Gestão Pedagógica</Link>
    <Link href={`/matriculas/${id}/continuidade-mensal`} className="underline">Condições e prévia de continuidade mensal</Link>
    <h1 className="text-2xl">Indisponibilidade da oferta</h1>
    <p>Relate períodos em que a escola não oferece continuidade para esta matrícula. O relato precisa de confirmação independente e não cancela, altera ou apaga cobranças.</p>
    {!resultado.ok || !resultado.dado ? <p role="alert">{resultado.ok ? "Histórico indisponível." : resultado.erro}</p> : <RelatosIndisponibilidadeOferta matriculaId={id} dados={resultado.dado} fusoInstitucional={fuso.success ? fuso.data : null} />}
  </div>;
}
