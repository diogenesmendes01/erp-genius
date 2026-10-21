import Link from "next/link";
import { notFound } from "next/navigation";
import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { PeriodosCalendarioSchema } from "@/server/agenda/calendario-schema";
import { DecidirCalendario } from "./DecidirCalendario";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";

export default async function VersaoCalendarioPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const { id } = await params;
  const { versao, ultima, config, possuiAgenda } = await prisma.$transaction(async (tx) => ({
    versao: await tx.versaoCalendarioEscolar.findUnique({ where: { id }, include: { decisao: true, preparador: { select: { nome: true } } } }),
    ultima: await tx.versaoCalendarioEscolar.findFirst({ orderBy: { versao: "desc" }, select: { id: true } }),
    config: await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } }),
    possuiAgenda: await tx.encontroAgenda.count({ where: { status: "PREVISTO" } }) > 0,
  }), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  if (!versao) notFound();
  const periodos = PeriodosCalendarioSchema.parse(versao.periodos).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.nome.localeCompare(b.nome));
  const podeDecidir = !versao.decisao && usuario.id !== versao.preparadorId && usuario.papeis.some((p) => ["GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p));
  const atual = ultima?.id === id, fusoConfere = config?.fusoInstitucional === versao.fusoInstitucional;
  return <div className="space-y-5">
    <VoltarPara href="/academico/calendario" />
    <h1 className="text-2xl font-medium">Calendário · Versão {versao.versao}</h1>
    <p>{versao.decisao ? versao.decisao.aprovada ? "Publicada" : "Rejeitada" : "Aguardando decisão"} · {versao.fusoInstitucional}</p>
    <Link className="text-brand-700 underline" href={`/academico/calendario/novo?base=${encodeURIComponent(id)}`}>Usar esta versão como base de uma nova proposta</Link>
    <p>Preparado por {versao.preparador.nome}</p><p className="whitespace-pre-wrap">{versao.motivo}</p>
    <Link className="underline" href={`/academico/calendario/${id}/revisoes`}>Histórico das revisões de agenda</Link>
    <section className="space-y-2"><h2 className="font-medium">Períodos não letivos</h2>
      {!periodos.length && <EstadoVazio>Nenhum feriado, recesso ou férias nesta versão.</EstadoVazio>}
      <ul className="space-y-2">{periodos.map((p) => <li key={p.id} className="rounded border p-3"><strong>{p.nome}</strong> · {({ FERIADO: "Feriado", RECESSO: "Recesso", FERIAS: "Férias" })[p.tipo]}<p>{p.inicio} a {p.fim}, incluindo as duas datas</p></li>)}</ul>
    </section>
    {!versao.decisao && <Link className="text-brand-700 underline" href={`/academico/calendario/${id}/replanejamento`}>Conferir proposta de novas datas e conflitos</Link>}
    {!versao.decisao && <div className="space-y-2">
      {!atual && <p role="alert">Há uma versão mais recente. Confira a proposta atual antes de publicar.</p>}
      {!fusoConfere && <p role="alert">O fuso institucional mudou. Prepare uma nova versão.</p>}
      {possuiAgenda && <p role="alert">Existem aulas previstas publicadas. É necessária revisão conjunta dos impactos e das remarcações antes de aplicar este calendário.</p>}
    </div>}
    {versao.decisao && <p>Motivo da decisão: {versao.decisao.motivo}</p>}
    {podeDecidir ? <DecidirCalendario id={id} podePublicar={atual && fusoConfere && !possuiAgenda} /> : !versao.decisao && <p>Outra pessoa da Gerência Pedagógica/Administração deve decidir esta proposta.</p>}
  </div>;
}
