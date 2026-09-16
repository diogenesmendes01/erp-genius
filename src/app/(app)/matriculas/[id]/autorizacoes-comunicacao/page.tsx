import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarTelaAutorizacoesComunicacaoAcademica } from "@/server/comunicacoes-agenda/autorizacoes";
import { AutorizacoesFormulario } from "./AutorizacoesFormulario";

export default async function AutorizacoesComunicacaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cursor?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const { id } = await params;
  const { cursor } = await searchParams;
  try {
    const tela = await consultarTelaAutorizacoesComunicacaoAcademica({ matriculaId: id, cursor });
    return <section className="space-y-5"><Link href="/secretaria" className="underline">Voltar à Secretaria</Link>
      <header><h1 className="text-2xl font-medium">Destinatários acadêmicos · {tela.matricula.codigo ?? "Matrícula em preparação"}</h1><p>{tela.matricula.alunoNome}</p><p className="text-sm text-gray-600">Ser responsável ou pagador não autoriza avisos. Registre evidência explícita para cada matrícula.</p></header>
      <AutorizacoesFormulario matriculaId={id} responsaveis={tela.responsaveis} historico={tela.historico.itens.map((item) => ({ ...item, vigenteEm: item.vigenteEm.toISOString(), revogadaEm: item.revogadaEm?.toISOString() ?? null }))} />{(cursor || tela.historico.proximoCursor) && <nav aria-label="Páginas do histórico" className="flex gap-4">{cursor && <Link className="underline" href={`/matriculas/${encodeURIComponent(id)}/autorizacoes-comunicacao`}>Início</Link>}{tela.historico.proximoCursor && <Link className="underline" href={`/matriculas/${encodeURIComponent(id)}/autorizacoes-comunicacao?cursor=${encodeURIComponent(tela.historico.proximoCursor)}`}>Próxima página</Link>}</nav>}
    </section>;
  } catch { return <p role="alert">Não foi possível consultar as autorizações desta matrícula.</p>; }
}