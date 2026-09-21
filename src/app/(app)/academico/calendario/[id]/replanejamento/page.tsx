import { EditorRevisao } from "./EditorRevisao";
import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { preverReplanejamentoCalendario } from "@/server/agenda/replanejamento-consulta";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";

export default async function ReplanejamentoPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const { id } = await params;
  const [resultado, preferencia] = await Promise.all([
    preverReplanejamentoCalendario({ calendarioId: id }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!resultado.ok || !resultado.dado) return <div><Link href={`/academico/calendario/${id}`}>Voltar ao calendário</Link><p role="alert">{resultado.ok ? "Revisão indisponível." : resultado.erro}</p></div>;
  const r = resultado.dado;
  return <div className="space-y-5">
    <Link className="underline" href={`/academico/calendario/${id}`}>Voltar ao calendário</Link>
    <h1 className="text-2xl font-medium">Prévia de replanejamento</h1>
    <Link className="underline" href={`/academico/calendario/${id}/revisoes`}>Consultar registros anteriores</Link>
    <p>Estas datas são sugestões. Nenhuma alteração foi aplicada à agenda. Cada turma preserva seu fuso de origem; a apresentação usa sua preferência válida quando disponível.</p>
    <EditorRevisao key={`${r.estadoHash}:${r.versaoRascunho}`} inicial={r} preferenciaFusoExibicao={preferencia.ok ? preferencia.dado?.fusoExibicao : null} />
  </div>;
}
