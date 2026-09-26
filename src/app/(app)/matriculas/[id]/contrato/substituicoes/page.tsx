import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarSubstituicoesContratuais } from "@/server/contratos/substituicao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { PrepararSubstituicao } from "./Formularios";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
const pagina = (v?: string) => { const n = Number(v ?? 1); return Number.isInteger(n) && n > 0 && n <= 100000 ? n : 1; };
export default async function SubstituicoesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string; conferencias?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const { id } = await params, s = await searchParams;
  const [r, preferencia] = await Promise.all([
    consultarSubstituicoesContratuais({ matriculaId: id, pagina: pagina(s.pagina), paginaConferencias: pagina(s.conferencias) }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado, base = `/matriculas/${encodeURIComponent(id)}/contrato/substituicoes`;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const data = (valor: Date | string) => `${formatarInstanteExibicao(valor, fusoExibicao, "UTC").texto} (${fusoExibicao}; origem UTC)`;
  return <div className="space-y-5">
    <VoltarPara href={`/matriculas/${encodeURIComponent(id)}/contrato`} para="Documentos" />
    <h1 className="text-2xl">Substituição contratual · {d.matricula.aluno}</h1>
    <p>Revise a substituição de um contrato enviado antes da conclusão de todas as assinaturas. Documentos, pagamentos e assinaturas anteriores permanecem no histórico.</p>
    <p role="status">Esta etapa registra a proposta e a decisão. O cancelamento no serviço de assinatura e o envio do novo documento ainda não estão disponíveis.</p>
    {d.podePreparar && d.fonte ? <>
      {d.conferencias.length ? <PrepararSubstituicao matriculaId={id} fonte={d.fonte} conferencias={d.conferencias.map(c => ({ id: c.id, artefatoId: c.artefatoId, revisaoHash: c.revisaoHash, rotulo: `${data(c.criadaEm)} · ${c.motivo}` }))} /> : <EstadoVazio>Nenhuma conferência de outro original nesta página. Prepare e confira o documento substituto nos documentos da matrícula.</EstadoVazio>}
      <nav className="flex gap-4" aria-label="Páginas das conferências">{d.paginaConferencias > 1 && <Link href={`${base}?conferencias=${d.paginaConferencias - 1}&pagina=${d.pagina}`}>Conferências mais recentes</Link>}<span>Página {d.paginaConferencias}</span>{d.maisConferencias && <Link href={`${base}?conferencias=${d.paginaConferencias + 1}&pagina=${d.pagina}`}>Conferências anteriores</Link>}</nav>
    </> : <p>{d.fonte?.assinaturaConcluida ? "O contrato já tem todas as assinaturas. Mudanças exigem aditivo." : "A preparação exige um processo com envio confirmado e ainda sem conclusão das assinaturas."}</p>}
    <section className="space-y-3"><h2 className="text-xl">Histórico de propostas</h2>
      {d.propostas.length ? <ul className="space-y-2">{d.propostas.map(p => <li key={p.id} className="rounded border p-3">
        <Link className="underline" href={`${base}/${encodeURIComponent(p.id)}`}>Proposta · versão {p.versao}</Link>
        <p>{p.preparadaPor.nome} · {data(p.criadaEm)}</p><p className="whitespace-pre-wrap">{p.motivo}</p>
        <p>{p.decisao ? `${p.decisao.aprovada ? "Aprovada" : "Rejeitada"} por ${p.decisao.decisor.nome}` : "Aguardando decisão administrativa"}</p>
      </li>)}</ul> : <EstadoVazio>Nenhuma proposta nesta página.</EstadoVazio>}
      <nav className="flex gap-4" aria-label="Páginas das propostas">{d.pagina > 1 && <Link href={`${base}?pagina=${d.pagina - 1}&conferencias=${d.paginaConferencias}`}>Propostas mais recentes</Link>}<span>Página {d.pagina}</span>{d.maisPropostas && <Link href={`${base}?pagina=${d.pagina + 1}&conferencias=${d.paginaConferencias}`}>Propostas anteriores</Link>}</nav>
    </section>
  </div>;
}
