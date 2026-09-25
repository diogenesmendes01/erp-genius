import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarIndisponibilidadesDocentes } from "@/server/agenda/indisponibilidade-consulta";
import { DecisaoAusencia } from "./DecisaoAusencia";
import { SolicitarAusencia } from "./SolicitarAusencia";
import { prisma } from "@/lib/prisma";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";

export default async function IndisponibilidadesPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.PROFESSOR, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const equipe = usuario.papeis.some((p) => ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p));
  const [professores, config, preferencia] = await Promise.all([
    prisma.usuario.findMany({ where: { ativo: true, papeis: { has: "PROFESSOR" }, ...(equipe ? {} : { id: usuario.id }) }, select: { id: true, nome: true }, orderBy: [{ nome: "asc" }, { id: "asc" }] }),
    prisma.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } }),
    consultarPreferenciaFusoEquipe(),
  ]);
  const { cursor } = await searchParams;
  const r = await consultarIndisponibilidadesDocentes({ cursor });
  return <div className="space-y-5">
    <VoltarPara href="/academico" />
    <header><h1 className="text-2xl font-medium">Indisponibilidades docentes</h1><p className="mt-1 text-sm text-gray-600">A aprovação registra a ausência. Aulas e reservas particulares afetadas precisam de solução aprovada e permanecem na agenda até lá.</p></header>
    <SolicitarAusencia professores={professores} fusoInicial={config?.fusoInstitucional ?? ""} />
    {!r.ok && <p role="alert" className="text-red-700">{r.erro}</p>}
    {r.ok && r.dado?.itens.length === 0 && <p>Nenhuma solicitação encontrada.</p>}
    {r.ok && r.dado?.itens.map((a) => {
      const exibicao = (v: string) => formatarInstanteExibicao(v, preferencia.ok ? preferencia.dado?.fusoExibicao : null, a.fusoOrigem);
      return <article key={a.id} className="space-y-3 rounded-lg border bg-[var(--surface)] p-4">
        <h2 className="font-medium">{a.professorNome} · {a.situacao === "PENDENTE" ? "Aguardando decisão" : a.situacao === "APROVADA" ? "Aprovada" : "Rejeitada"}</h2>
        <p>{exibicao(a.inicio).texto} — {exibicao(a.fim).texto} <span className="text-sm text-gray-500">({exibicao(a.inicio).fuso}; origem {a.fusoOrigem})</span></p>
        <p className="whitespace-pre-wrap text-sm">{a.motivo}</p>
        {a.decisao && <p className="text-sm">Decisão: {a.decisao.motivo}</p>}
        {a.situacao === "PENDENTE" && <div className="rounded bg-blue-50 p-3"><h3 className="font-medium">Impacto para conferir antes da decisão</h3>
          {a.encontrosParaConferencia.length ? <><p className="text-sm">Estas aulas precisarão de solução se a ausência for aprovada.</p><ul className="list-inside list-disc">{a.encontrosParaConferencia.map((e) => <li key={e.id}>{exibicao(e.inicio).texto} — {exibicao(e.fim).texto}</li>)}</ul></> : <EstadoVazio>Nenhuma aula prevista coincide atualmente com o período solicitado.</EstadoVazio>}
          {a.reservasParaConferencia.length > 0 && <><p className="text-sm">Estes horários particulares reservados também precisarão de solução.</p><ul className="list-inside list-disc">{a.reservasParaConferencia.map((r) => <li key={r.id}>{exibicao(r.inicio).texto} — {exibicao(r.fim).texto}</li>)}</ul></>}
        </div>}
        {a.reservasPendentes.length > 0 && <div className="rounded bg-amber-50 p-3"><h3 className="font-medium">Reservas particulares que ainda precisam de solução</h3><ul className="list-inside list-disc">{a.reservasPendentes.map((r) => <li key={r.id}>{exibicao(r.inicio).texto} — {exibicao(r.fim).texto}</li>)}</ul><p className="text-sm">A ausência não cancela a reserva nem escolhe outro professor.</p></div>}
        {a.encontrosPendentes.length > 0 && <div className="rounded bg-amber-50 p-3"><h3 className="font-medium">Aulas que ainda precisam de solução</h3><ul className="list-inside list-disc">{a.encontrosPendentes.map((e) => <li key={e.id}>{exibicao(e.inicio).texto} — {exibicao(e.fim).texto}</li>)}</ul></div>}
        {a.situacao === "APROVADA" && a.encontrosPendentes.length === 0 && a.reservasPendentes.length === 0 && <p className="text-sm text-gray-600">Nenhuma aula prevista ou reserva particular conflita atualmente com este período.</p>}
        {a.podeDecidir && <DecisaoAusencia id={a.id} impactoHash={a.impactoHash} />}
      </article>;
    })}
    {r.ok && r.dado?.proximoCursor && <Link className="text-brand-700 underline" href={`/academico/indisponibilidades?cursor=${encodeURIComponent(r.dado.proximoCursor)}`}>Próximas solicitações</Link>}
  </div>;
}
