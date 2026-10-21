import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarDisponibilidadesOferta } from "@/server/matricula/disponibilidade-oferta";
import { DisponibilidadeOferta } from "./DisponibilidadeOferta";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.FINANCEIRO);
  const { id } = await params;
  const resultado = await consultarDisponibilidadesOferta({ matriculaId: id });
  return <div className="space-y-4">
    <Link href={`/matriculas/${id}/indisponibilidade-oferta`} className="underline">Indisponibilidades da matrícula</Link>
    <h1 className="text-2xl">Confirmação de oferta de aulas</h1>
    <p>Informe o período e as evidências de oferta para conferência por outra pessoa da Gestão Pedagógica ou Administração. A aprovação não emite mensalidade nem resolve relatos de indisponibilidade.</p>
    {resultado.ok && resultado.dado ? <DisponibilidadeOferta matriculaId={id} inicial={resultado.dado} /> : <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>}
  </div>;
}
