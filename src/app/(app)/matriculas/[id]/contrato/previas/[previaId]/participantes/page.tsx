import Link from "next/link";
import { notFound } from "next/navigation";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPreviaContratual } from "@/server/contratos/previas";
import { consultarFormularioParticipantes, consultarConferenciasParticipantes } from "@/server/contratos/participantes";
import { ConferirParticipantesSchema, IdentidadeSignatarioSchema } from "@/server/contratos/participantes-schema";
import { RegraAssinaturaSchema } from "@/server/contratos/modelo-schema";
import { PAPEIS_MODELO } from "@/app/(app)/configuracao/contratos/labels";
import { FormularioParticipantes } from "./Formulario";
import { EvidenciaParticipantes } from "./Evidencia";
const Historico = z.object({ maioridade: ConferirParticipantesSchema.innerType().shape.maioridade,
  participantes: z.array(z.object({ papel: RegraAssinaturaSchema.shape.papel, identidade: IdentidadeSignatarioSchema,
    representacao: z.object({ descricao: z.string(), evidenciaDocumentoId: z.string() }).optional() })),
  documentos: z.array(z.object({ id: z.string(), nome: z.string() })),
});

export default async function ParticipantesPage({ params, searchParams }: { params: Promise<{ id: string; previaId: string }>; searchParams: Promise<{ maioridade?: string; pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const { id, previaId } = await params, q = await searchParams;
  const previa = await consultarPreviaContratual(previaId);
  if (!previa.ok || !previa.dado) return <p role="alert">{previa.ok ? "Prévia indisponível." : previa.erro}</p>;
  if (previa.dado.matriculaId !== id) notFound();
  const maioridade = q.maioridade === "MAIOR" || q.maioridade === "MENOR" ? q.maioridade : null;
  const n = Number(q.pagina ?? 1), pagina = Number.isInteger(n) && n > 0 && n <= 100000 ? n : 1;
  const formulario = await consultarFormularioParticipantes({ previaId, maioridade });
  const historico = await consultarConferenciasParticipantes({ previaId, pagina });
  const base = `/matriculas/${id}/contrato/previas/${previaId}`;
  return <div className="space-y-5">
    <Link className="underline" href={base}>Voltar ao conteúdo da prévia</Link><h1 className="text-2xl">Conferir participantes do contrato</h1>
    <p>Identifique as pessoas exigidas pelo modelo e registre a representação aplicável. Esta conferência não envia convites nem comprova assinatura.</p>
    <nav className="flex gap-4"><Link className="underline" href={`/matriculas/${id}/pagador`}>Conferir cadastro do pagador</Link><Link className="underline" href="/secretaria">Cadastro e documentos na Secretaria</Link></nav>
    <form className="flex flex-wrap items-end gap-3" method="get"><label>Classificação de maioridade conferida<select name="maioridade" defaultValue={maioridade ?? ""} className="block rounded border p-2"><option value="">Ainda não conferida / não exigida pelas regras</option><option value="MAIOR">Maior de idade</option><option value="MENOR">Menor de idade</option></select></label><button className="rounded border p-2">Atualizar papéis exigidos</button></form>
    {formulario.ok && formulario.dado ? <>
      <EvidenciaParticipantes matriculaId={id} />
      <FormularioParticipantes key={`${formulario.dado.versaoEsperada}:${maioridade ?? "pendente"}`} dados={formulario.dado} />
    </> : <p role="status">{formulario.ok ? "Conferência indisponível." : formulario.erro}</p>}
    <section className="space-y-3"><h2 className="text-xl">Histórico das conferências</h2>
      {!historico.ok ? <p role="alert">{historico.erro}</p> : historico.dado && <>
        {!historico.dado.registros.length && <p>Nenhuma conferência registrada nesta página.</p>}
        {historico.dado.registros.map((r) => {
          const conteudo = Historico.safeParse(r.snapshot);
          return <details className="rounded border p-3" key={r.id}><summary>Versão {r.versao} · {r.autor.nome} · {r.criadaEm.toISOString().replace("T", " ").slice(0, 19)} UTC</summary><div className="mt-3 space-y-3"><p className="whitespace-pre-wrap">{r.motivo}</p>
            {conteudo.success ? <>
              {conteudo.data.maioridade && <p>Maioridade: {conteudo.data.maioridade.classificacao === "MAIOR" ? "maior" : "menor"} · Critério: {conteudo.data.maioridade.criterio} · Evidência: {conteudo.data.documentos.find((d) => d.id === conteudo.data.maioridade?.evidenciaDocumentoId)?.nome ?? "Identificada no registro"}</p>}
              {conteudo.data.participantes.map((p) => <div key={p.papel} className="border-t pt-2"><h3 className="font-medium">{PAPEIS_MODELO[p.papel]}</h3><p>{p.identidade.nome} · {p.identidade.email} · {p.identidade.documento}</p>{p.representacao && <p>Representação: {p.representacao.descricao} · Evidência: {conteudo.data.documentos.find((d) => d.id === p.representacao?.evidenciaDocumentoId)?.nome ?? "Identificada no registro"}</p>}</div>)}
            </> : <p role="alert">Estrutura histórica precisa de conferência.</p>}
          </div></details>;
        })}
        <nav className="flex gap-4" aria-label="Páginas das conferências">{pagina > 1 && <Link href={`?pagina=${pagina - 1}&maioridade=${maioridade ?? ""}`}>Mais recentes</Link>}<span>Página {pagina}</span>{historico.dado.temProxima && <Link href={`?pagina=${pagina + 1}&maioridade=${maioridade ?? ""}`}>Anteriores</Link>}</nav>
      </>}
    </section>
  </div>;
}
