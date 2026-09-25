import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarJanelasAdmissao } from "@/server/matricula/janela-admissao-consulta";
import { JanelaFormulario, DecidirJanela } from "./JanelaFormulario";
import { VoltarPara } from "@/components/VoltarPara";

export default async function JanelaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const { id } = await params, filtros = await searchParams;
  const resultado = await consultarJanelasAdmissao({ turmaId: id, pagina: Number(filtros.pagina ?? 1) });
  if (!resultado.ok || !resultado.dado) return <div><VoltarPara href="/academico/admissoes" para="Turmas" /><p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p></div>;
  const r = resultado.dado;
  return <div className="space-y-5"><VoltarPara href="/academico/admissoes" para="Turmas" />
    <h1 className="text-2xl font-medium">Janela de admissão · {r.turma.codigo ?? r.turma.nome ?? "Turma sem código"}</h1>
    <p>Configurar a janela não confirma vaga nem ativa matrícula. Reservas e contratação ainda precisam da integração deste fluxo.</p>
    <section className="rounded border p-4"><h2 className="font-medium">Regra vigente</h2>
      {r.vigente ? <p>Versão {r.vigente.versao} · Último dia: {r.vigente.limiteEntrada}, incluído · {r.vigente.fusoAdmissao}</p> : <p>Nenhuma janela aprovada. Não presumir prazo de entrada.</p>}
    </section>
    {r.turma.status !== "CONCLUIDA" && r.fusoInstitucional ? <JanelaFormulario key={`${r.ultimaVersao}:${r.fusoInstitucional}`} turmaId={id} versaoAnterior={r.ultimaVersao} fusoConferido={r.fusoInstitucional} /> : <p>Preparação indisponível: confira o fuso institucional e se a turma está concluída.</p>}
    <h2 className="text-lg font-medium">Histórico de versões</h2>
    {!r.registros.length && <p>Nenhuma versão nesta página.</p>}
    {r.registros.map((v) => <section key={v.id} className="space-y-3 rounded border p-4">
      <h3 className="font-medium">Versão {v.versao} · {v.decisao ? v.decisao.aprovada ? "Aprovada" : "Rejeitada" : "Aguardando decisão"}</h3>
      <p>Limite incluído: {v.limiteEntrada} · {v.fusoAdmissao} · Preparada por {v.preparador.nome}</p><p className="whitespace-pre-wrap">{v.motivo}</p>
      {v.decisao ? <p>Decisão de {v.decisao.decisor.nome}: {v.decisao.motivo}</p> : v.podeDecidir ? <DecidirJanela propostaId={v.id} podeAprovar={v.podeAprovar} /> : <p>A decisão deve ser registrada por outra pessoa da Gerência Pedagógica/Administração.</p>}
    </section>)}
    <nav aria-label="Páginas das janelas" className="flex gap-4">{r.pagina > 1 && <Link href={`?pagina=${r.pagina - 1}`}>Anterior</Link>}{r.possuiMais && <Link href={`?pagina=${r.pagina + 1}`}>Próxima</Link>}</nav>
  </div>;
}
