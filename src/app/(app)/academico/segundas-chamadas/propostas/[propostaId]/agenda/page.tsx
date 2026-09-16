import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAgendasIniciaisSegundaChamada } from "@/server/avaliacoes/segunda-chamada-agenda-inicial";
import { Formulario } from "./Formulario";

const data = (valor: string, fuso: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: fuso,
}).format(new Date(valor));
const periodo = (inicio: string, fim: string, fuso: string) => `${data(inicio, fuso)} até ${data(fim, fuso)} (${fuso})`;
const dataCivil = (valor: string) => {
  const [ano, mes, dia] = valor.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
};
const periodoCalendario = (inicio: string, fim: string) => `${dataCivil(inicio)} até ${dataCivil(fim)}`;

export default async function AgendaInicial({ params, searchParams }: {
  params: Promise<{ propostaId: string }>;
  searchParams: Promise<{ antesId?: string }>;
}) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const { propostaId } = await params;
  const { antesId } = await searchParams;
  const r = await consultarAgendasIniciaisSegundaChamada({ propostaSegundaChamadaId: propostaId, ...(antesId ? { antesId } : {}) });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  return <section className="space-y-4">
    <Link className="underline" href="/academico">Acadêmico</Link>
    <h1 className="text-2xl font-medium">Agenda inicial da segunda chamada</h1>
    <p>{d.identificacao.aluno} · Matrícula {d.identificacao.matriculaCodigo ?? "sem código"} · {d.identificacao.turma} · {d.identificacao.nivel}</p>
    <p>O encontro e a reserva só são criados na aprovação independente da agenda concreta.</p>
    <Formulario propostaSegundaChamadaId={propostaId} professores={d.professores} podePropor={d.podePropor} />
    <h2 className="text-xl font-medium">Histórico de propostas</h2>
    {!d.itens.length && <p>Nenhuma agenda inicial foi preparada.</p>}
    {d.itens.map(item => <article key={item.id} className="space-y-2 rounded border p-4">
      <p>Versão {item.versao} · Proposta de {item.autorNome} em {data(item.criadaEm, item.fusoOrigem)} ({item.fusoOrigem}).</p>
      <p>Professor: {item.professorNome}.</p>
      <p>Horário proposto: {periodo(item.inicio, item.fim, item.fusoOrigem)}.</p>
      <p>Motivo: {item.motivo}</p><p>Evidência: {item.evidencia}</p>
      {item.calendario ? <>
        <p>Calendário conferido: versão {item.calendario.versao} · fuso institucional {item.calendario.fusoInstitucional}.</p>
        {item.calendario.periodos.length ? <ul className="list-disc pl-5">{item.calendario.periodos.map(p => <li key={`${p.nome}-${p.inicio}`}>Período não letivo: {p.nome}, de {periodoCalendario(p.inicio, p.fim)}.</li>)}</ul> : <p>Não há período não letivo afetado.</p>}
        {item.motivoExcecaoNaoLetiva && <p>Justificativa da exceção não letiva: {item.motivoExcecaoNaoLetiva}</p>}
      </> : <p>Proposta histórica sem referência de calendário; ela pode ser rejeitada, mas exige nova proposta para aprovação.</p>}
      {item.decisao ? <p role="status">{item.decisao.aprovada ? "Aprovada e aplicada" : "Rejeitada"} por {item.decisao.decisorNome}: {item.decisao.motivo}{item.decisao.autorizarDiaNaoLetivo ? " Exceção não letiva autorizada." : ""}</p> : <p role="status">Aguardando decisão independente.</p>}
      {item.decisao?.aprovada && <p>Aplicação: encontro, reserva e agenda registrados.</p>}
      {item.podeDecidir && item.entradaHash && <Formulario propostaSegundaChamadaId={propostaId} professores={[]} podePropor={false} proposta={{ id: item.id, entradaHash: item.entradaHash, podeDecidir: item.podeDecidir, podeAprovar: item.podeAprovar ?? !!item.calendario, impedimentoAprovacao: item.impedimentoAprovacao ?? null, calendario: item.calendario }} />}
    </article>)}
    {(antesId || d.proximoId) && <nav className="flex gap-4" aria-label="Paginação das agendas iniciais">
      {antesId && <Link className="underline" href={`/academico/segundas-chamadas/propostas/${encodeURIComponent(propostaId)}/agenda`}>Primeira página</Link>}
      {d.proximoId && <Link className="underline" href={`/academico/segundas-chamadas/propostas/${encodeURIComponent(propostaId)}/agenda?antesId=${encodeURIComponent(d.proximoId)}`}>Propostas anteriores</Link>}
    </nav>}
  </section>;
}
