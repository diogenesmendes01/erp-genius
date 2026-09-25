import { CadastroContratualAplicado } from "../CadastroContratualAplicado";
import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAditivosContratuais } from "@/server/contratos/aditivos";
import { consultarPropostaAgendaAditivo } from "@/server/contratos/agenda-aditivo";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { PrepararAditivo } from "./Formularios";
import { VoltarPara } from "@/components/VoltarPara";
const pagina = (v?: string) => { const n = Number(v ?? 1); return Number.isInteger(n) && n > 0 && n <= 100000 ? n : 1; };
export default async function AditivosPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string; modelos?: string; agenda?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA); const { id } = await params, s = await searchParams;
  const [r, preferencia] = await Promise.all([
    consultarAditivosContratuais({ matriculaId: id, pagina: pagina(s.pagina), paginaModelos: pagina(s.modelos) }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado, base = `/matriculas/${encodeURIComponent(id)}/contrato/aditivos`, agendaId = typeof s.agenda === "string" ? s.agenda : "";
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const data = (valor: Date | string) => `${formatarInstanteExibicao(valor, fusoExibicao, "UTC").texto} (${fusoExibicao}; origem UTC)`;
  const agendaResultado = agendaId ? await consultarPropostaAgendaAditivo({ matriculaId: id, propostaAgendaId: agendaId }) : null;
  const agenda = agendaResultado?.ok ? agendaResultado.dado : null;
  return <div className="space-y-5"><VoltarPara href={`/matriculas/${encodeURIComponent(id)}/contrato`} para="Documentos" /><h1 className="text-2xl">Aditivos contratuais · {d.matricula.aluno}</h1>
    <p>Prepare alterações posteriores à assinatura completa e confira a prévia. A aprovação administrativa não aplica condições novas; assinatura, conferência e aplicação permanecem em etapas próprias.</p>
    {agendaResultado && (!agendaResultado.ok || !agenda) && <p role="alert">{agendaResultado.ok ? "Fotografia indisponível." : agendaResultado.erro}</p>}{d.fonte ? <><a className="underline" href={`/api/matriculas/${encodeURIComponent(id)}/originais/${encodeURIComponent(d.fonte.artefatoId)}/pdf`} target="_blank" rel="noopener noreferrer">Abrir PDF do original preservado</a>{d.fonte.ambiente === "SANDBOX" && <p role="status">Ambiente de teste: a conclusão preservada é identificada como SANDBOX.</p>}{d.modelos.length ? <PrepararAditivo matriculaId={id} fonte={d.fonte} modelos={d.modelos} agenda={agenda} /> : <p>Nenhum modelo de aditivo aprovado está disponível nesta página.</p>}<nav className="flex gap-4" aria-label="Páginas dos modelos">{d.paginaModelos > 1 && <Link href={`${base}?modelos=${d.paginaModelos - 1}&pagina=${d.pagina}`}>Modelos anteriores</Link>}<span>Página {d.paginaModelos}</span>{d.maisModelos && <Link href={`${base}?modelos=${d.paginaModelos + 1}&pagina=${d.pagina}`}>Mais modelos</Link>}</nav></> : <p role="status">{d.impedimento}</p>}
    <CadastroContratualAplicado cadastro={d.cadastroContratual} preferenciaFusoExibicao={fusoExibicao} />
    <section className="space-y-3"><h2 className="text-xl">Histórico de propostas</h2>{d.propostas.length ? <ul className="space-y-2">{d.propostas.map(p => <li key={p.id} className="rounded border p-3"><Link className="underline" href={`${base}/${encodeURIComponent(p.id)}`}>Proposta · versão {p.versao}</Link><p>{p.preparadaPor.nome} · {data(p.criadaEm)}</p><p className="whitespace-pre-wrap">{p.motivo}</p><p>{p.decisao ? `${p.decisao.aprovada ? "Aprovada" : "Rejeitada"} por ${p.decisao.decisor.nome}` : "Aguardando decisão administrativa"}</p></li>)}</ul> : <p>Nenhuma proposta nesta página.</p>}<nav className="flex gap-4" aria-label="Páginas das propostas">{d.pagina > 1 && <Link href={`${base}?pagina=${d.pagina - 1}&modelos=${d.paginaModelos}`}>Propostas mais recentes</Link>}<span>Página {d.pagina}</span>{d.maisPropostas && <Link href={`${base}?pagina=${d.pagina + 1}&modelos=${d.paginaModelos}`}>Propostas anteriores</Link>}</nav></section>
  </div>;
}
