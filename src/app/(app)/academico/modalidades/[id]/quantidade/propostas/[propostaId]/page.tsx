import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPropostaQuantidadeAulasModalidade } from "@/server/agenda/modalidade-quantidade-consulta";
import { DecidirQuantidadeAulas } from "./DecidirQuantidadeAulas";
export default async function PropostaQuantidadePage({ params }: { params: Promise<{ id: string; propostaId: string }> }) {
 await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO); const { id, propostaId } = await params;
 const r = await consultarPropostaQuantidadeAulasModalidade({ propostaId });
 if (!r.ok || !r.dado || r.dado.modalidadeId !== id) return <main><Link href={`/academico/modalidades/${id}/quantidade`}>Voltar à modalidade</Link><p role="alert">{r.ok ? "Proposta indisponível." : r.erro}</p></main>;
 const p = r.dado;
 return <main className="space-y-5"><Link className="underline" href={`/academico/modalidades/${id}/quantidade`}>Voltar à modalidade</Link><h1 className="text-2xl font-medium">Revisão de quantidade · {p.modalidade.nome}</h1><p>Versão {p.versao} · {p.quantidadeAnterior} → {p.quantidadeNova} · {p.situacao}</p><p>Preparada por {p.preparador.nome}: {p.motivo}</p><ul className="space-y-2">{p.impactos.map((i) => <li className="rounded border p-2" key={i.id}>{i.turma.codigo ?? i.turmaId} · {i.quantidadeAnterior} → {i.quantidadeNova} · {i.alcance}{Array.isArray(i.excecoesQ37) && i.excecoesQ37.length ? " · exceção Q37 registrada" : ""}</li>)}</ul>{!p.decisao ? <DecidirQuantidadeAulas propostaId={p.id} /> : <p>{p.decisao.aprovada ? `Aplicada por ${p.decisao.decisor.nome} em ${p.aplicadaEm ?? "andamento"}.` : `Rejeitada por ${p.decisao.decisor.nome}.`}</p>}</main>;
}
