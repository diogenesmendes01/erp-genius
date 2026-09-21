import Link from "next/link";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarFechamentosHoras } from "@/server/matricula/fechamento-horas-consulta";
import { PrepararFechamento } from "./PrepararFechamento";
import { DecidirFechamento } from "./DecidirFechamento";
import { EmitirFechamento } from "./EmitirFechamento";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";

const Memoria = z.object({ periodo: z.object({ inicio: z.string(), fim: z.string(), fuso: z.string(), vencimento: z.string() }),
  apuracao: z.object({ moeda: z.string(), estado: z.enum(["AGUARDANDO_CONFERENCIA", "PROPOSTA_PARCIAL", "APURACAO_COMPLETA", "SEM_ITENS_A_FATURAR"]),
    totalApurado: z.string(), minutosApurados: z.number(),
    itens: z.array(z.object({ encontroId: z.string(), minutos: z.number(), valorHoraContratado: z.string(), valor: z.string(), origem: z.object({ inicio: z.string() }) })),
    pendencias: z.array(z.object({ encontroId: z.string(), motivo: z.string() })),
    origens: z.array(z.object({ encontroId: z.string(), inicio: z.string().optional(), fim: z.string().optional() })).optional(),
    preservados: z.array(z.object({ encontroId: z.string(), destinacao: z.discriminatedUnion("tipo", [
      z.object({ tipo: z.literal("FATURADA"), cobrancaId: z.string() }), z.object({ tipo: z.literal("ANTECIPACAO_CONFERIDA"), registroId: z.string() })]) })),
    semCobranca: z.array(z.object({ encontroId: z.string(), desfecho: z.string(), origem: z.object({ inicio: z.string() }) })) }) });
const estados = { AGUARDANDO_CONFERENCIA: "Aguardando conferência", PROPOSTA_PARCIAL: "Proposta parcial — requer aprovação",
  APURACAO_COMPLETA: "Apuração completa", SEM_ITENS_A_FATURAR: "Sem itens a faturar" };
const data = (s: string) => s.split("-").reverse().join("/");

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>;
  searchParams: Promise<{ aluno?: string; cursor?: string; versao?: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO);
  const { id } = await params, q = await searchParams;
  if (!q.aluno) return <p role="alert">Abra os fechamentos pela ficha financeira da matrícula.</p>;
  const [r, preferencia] = await Promise.all([
    consultarFechamentosHoras({ alunoId: q.aluno, matriculaId: id, cursor: q.cursor, rascunhoId: q.versao }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado, base = `/matriculas/${id}/fechamentos-horas?aluno=${encodeURIComponent(d.matricula.alunoId)}`;
  const preferenciaFusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const instanteAdministrativo = (valor: Date | string) => {
    const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
    return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
  };
  return <div className="space-y-4">
    <Link href={`/matriculas/${id}/ocorrencias-financeiras`} className="underline">Conferência das particulares</Link>
    <h1 className="text-2xl">Fechamentos por hora · {d.matricula.codigo ?? id}</h1>
    <p>Histórico dos rascunhos de apuração. Salvar uma versão não aprova condições, emite cobrança ou confirma pagamento.</p>
    {!q.versao && <PrepararFechamento alunoId={d.matricula.alunoId} matriculaId={id} />}
    {q.versao && <Link href={base} className="underline">Todas as versões</Link>}
    {!d.versoes.length && <p>Nenhum rascunho salvo nesta página.</p>}
    {d.versoes.map(v => {
      const m = v.memoria ? Memoria.safeParse(v.memoria) : null;
      const instanteEncontro = (valor: string) => {
        if (!m?.success) return "Encontro sem horário na memória antiga";
        const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, m.data.periodo.fuso);
        return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem ${m.data.periodo.fuso})`;
      };
      const encontro = (encontroId: string) => {
        const origem = m?.success ? m.data.apuracao.origens?.find(o => o.encontroId === encontroId) : null;
        return origem?.inicio ? instanteEncontro(origem.inicio) : "Encontro sem horário na memória antiga";
      };
      return <section key={v.id} className="space-y-3 rounded border p-4">
        <h2 className="text-lg font-semibold">Rascunho · versão {v.versao}</h2>
        <p>Preparado por {v.preparador.nome} em {instanteAdministrativo(v.criadoEm)}.</p>
        <p>{v.motivo}</p>
        <p>Contrato de origem: {v.documento.nome}. {v.documento.url ? <a href={v.documento.url} target="_blank" rel="noopener noreferrer" className="underline">Abrir contrato para conferência</a> : "Documento indisponível para abertura nesta tela; solicite conferência à Secretaria."}</p>
        {v.referenciaProposta && <><p className="whitespace-pre-wrap">Cláusula informada: {v.referenciaProposta.periodo.clausula}</p>
          <p>Escolha proposta: {v.referenciaProposta.escolha === "AGUARDAR" ? "aguardar conferências pendentes" : "emissão parcial sujeita à aprovação"}.</p></>}
        {v.decisao && <p>Decisão: {v.decisao.aprovada ? "proposta aprovada" : "proposta rejeitada"} por {v.decisao.decisor.nome}. {v.decisao.motivo} A decisão não comprova emissão.</p>}
        {v.emissao && <div className="rounded border p-3">
          <h3 className="font-semibold">Cobrança emitida · {v.emissao.cobranca.codigo ?? v.emissao.cobranca.id}</h3>
          <p>Emitida por {v.emissao.executor.nome} em {instanteAdministrativo(v.emissao.criadaEm)}.</p>
          <p>Valor original: {v.emissao.cobranca.moeda} {v.emissao.cobranca.valorOriginal}. Valor atual: {v.emissao.cobranca.valorNegociado}. Saldo: {v.emissao.cobranca.saldo ?? "a conferir"}.</p>
          <Link className="underline" href={`/alunos/${d.matricula.alunoId}/financeiro`}>Consultar cobrança e recebimentos na ficha financeira</Link>
        </div>}
        {!q.versao && <><p>Intervalo: {v.periodoInicio} até {v.periodoFimExclusivo} (limite final exclusivo).</p>
          <Link href={`${base}&versao=${encodeURIComponent(v.id)}`} className="underline">Consultar apuração desta versão</Link></>}
        {m && !m.success && <p role="alert">Memória incompatível com a apresentação. Encaminhe esta versão para conferência; nenhum valor foi recalculado.</p>}
        {m?.success && <>
          <p>Período: {data(m.data.periodo.inicio)} a {data(m.data.periodo.fim)} · Fuso: {m.data.periodo.fuso} · Vencimento: {data(m.data.periodo.vencimento)}</p>
          <p>Estado da apuração quando preparada: {estados[m.data.apuracao.estado]}</p>
          <p>Total apurado: {m.data.apuracao.moeda} {m.data.apuracao.totalApurado} · {m.data.apuracao.minutosApurados} minutos.</p>
          <div className="overflow-x-auto"><table className="w-full text-left"><caption className="text-left font-semibold">Encontros incluídos na apuração</caption>
            <thead><tr><th>Encontro</th><th>Minutos</th><th>Preço por hora</th><th>Valor ({m.data.apuracao.moeda})</th></tr></thead>
            <tbody>{m.data.apuracao.itens.map(i => <tr key={i.encontroId}><td>{instanteEncontro(i.origem.inicio)}</td><td>{i.minutos}</td><td>{i.valorHoraContratado}</td><td>{i.valor}</td></tr>)}</tbody>
          </table></div>
          {!m.data.apuracao.itens.length && <p>Nenhum encontro incluído para cobrança nesta versão.</p>}
          <h3 className="font-semibold">Pendências ({m.data.apuracao.pendencias.length})</h3>
          <ul>{m.data.apuracao.pendencias.map(p => <li key={p.encontroId}>{encontro(p.encontroId)}: {p.motivo}</li>)}</ul>
          <p>Encontros com destinação preservada: {m.data.apuracao.preservados.length}. Encontros sem cobrança: {m.data.apuracao.semCobranca.length}.</p>
          <ul className="space-y-2">{m.data.apuracao.preservados.map(p => {
            const cobrancaId = p.destinacao.tipo === "FATURADA" ? p.destinacao.cobrancaId : null;
            const anterior = cobrancaId ? d.cobrancasAnteriores.find(c => c.cobrancaId === cobrancaId) : null;
            return <li key={p.encontroId}>{encontro(p.encontroId)} · {p.destinacao.tipo === "FATURADA" ? "Já faturado em cobrança anterior" : "Destinação das horas antecipadas já conferida"}.
              {anterior && <> <Link className="underline" href={`${base}&versao=${encodeURIComponent(anterior.rascunhoId)}`}>Consultar fechamento da cobrança {anterior.codigo ?? anterior.cobrancaId}</Link></>}
            </li>;
          })}</ul>
          {m.data.apuracao.semCobranca.length > 0 && <ul>{m.data.apuracao.semCobranca.map(p => <li key={p.encontroId}>{instanteEncontro(p.origem.inicio)} · Sem cobrança: {p.desfecho === "CANCELAMENTO_ESCOLA" ? "cancelamento pela escola" : p.desfecho === "CANCELAMENTO_NO_PRAZO" ? "cancelamento do aluno dentro do prazo" : p.desfecho}.</li>)}</ul>}
        </>}
        {q.versao && v.podeDecidir && <DecidirFechamento alunoId={d.matricula.alunoId} matriculaId={id} rascunhoId={v.id} />}
        {q.versao && m?.success && v.decisao?.aprovada && !v.emissao && m.data.apuracao.itens.length > 0 && ["APURACAO_COMPLETA", "PROPOSTA_PARCIAL"].includes(m.data.apuracao.estado) &&
          <EmitirFechamento alunoId={d.matricula.alunoId} matriculaId={id} decisaoId={v.decisao.id} valor={m.data.apuracao.totalApurado} moeda={m.data.apuracao.moeda} />}
      </section>;
    })}
    {d.proximoCursor && <Link className="underline" href={`${base}&cursor=${encodeURIComponent(d.proximoCursor)}`}>Próxima página</Link>}
  </div>;
}
