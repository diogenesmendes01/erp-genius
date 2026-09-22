import Link from "next/link";
import { Papel } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarTerminosIndisponibilidadeOferta } from "@/server/matricula/indisponibilidade-oferta-termino";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { TerminoIndisponibilidadeOferta } from "./TerminoIndisponibilidadeOferta";

export default async function TerminoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; registroId: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const { id: matriculaId, registroId } = await params;
  const paginaInformada = Number((await searchParams).pagina ?? "1");
  const pagina = Number.isInteger(paginaInformada) && paginaInformada > 0 && paginaInformada <= 100_000 ? paginaInformada : 1;

  const registro = await prisma.registroIndisponibilidadeOfertaMatricula.findFirst({
    where: { id: registroId, matriculaId },
    select: { id: true, inicio: true },
  });
  if (!registro) notFound();

  const [resultado, configuracao, preferencia] = await Promise.all([
    consultarTerminosIndisponibilidadeOferta({ registroId, pagina }),
    prisma.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } }),
    consultarPreferenciaFusoEquipe(),
  ]);
  const fusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const fuso = FusoInstitucionalSchema.safeParse(configuracao?.fusoInstitucional);

  return <div className="space-y-4">
    <Link href={`/matriculas/${matriculaId}/indisponibilidade-oferta`} className="underline">Voltar aos relatos de indisponibilidade</Link>
    <h1 className="text-2xl">Término da indisponibilidade</h1>
    <p>Registre o último dia em que a oferta esteve indisponível. Esta data não representa uma data de retorno e não altera cobranças.</p>
    {!resultado.ok || !resultado.dado ? <p role="alert">{resultado.ok ? "Histórico de términos indisponível." : resultado.erro}</p> : <TerminoIndisponibilidadeOferta registroId={registro.id} inicio={registro.inicio.toISOString().slice(0, 10)} dados={resultado.dado} fusoInstitucional={fuso.success ? fuso.data : null} fusoExibicao={fusoExibicao} />}
  </div>;
}
