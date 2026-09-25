import { formatarMoeda } from "@/lib/dinheiro";
import Link from "next/link";
import { consultarCondicoesEntrada } from "@/server/secretaria/condicoes-entrada";
import { CondicoesFormulario } from "./CondicoesFormulario";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { formatarDataCivil } from "@/lib/data-civil";
import { VoltarPara } from "@/components/VoltarPara";
export default async function CondicoesPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO);
  const { id } = await params, r = await consultarCondicoesEntrada(id);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado, p = d.registro;
  return <div className="space-y-4"><VoltarPara href="/secretaria" /><h1 className="text-2xl">Condições de entrada · {d.codigo ?? "Em preparação"}</h1>
    <p>Estas condições preparam a contratação. Registrar não emite cobranças nem confirma recebimento ou assinatura.</p>
    <Link href={`/matriculas/${id}/pagador`} className="underline">Conferir pagador</Link>
    {d.regime === "HORA_PARTICULAR" && <Link href={`/matriculas/${id}/condicoes-horas`} className="block underline">Condições por hora do contrato confirmado</Link>}
    {d.regime === "MENSALIDADE" && <Link href={`/matriculas/${id}/continuidade-mensal`} className="block underline">Condições de continuidade mensal do contrato confirmado</Link>}
    {p && <section className="space-y-2 rounded border p-4"><h2>Versão {p.versao} · {p.preparador.nome}</h2><p>Vencimento da taxa: {p.dados.taxaVencimento}</p>
      {p.dados.aulas.regime === "MENSALIDADE" ? <><p>Primeiro vencimento: {p.dados.aulas.primeiroVencimento} · Dia contratual: {p.dados.aulas.diaVencimentoContratado}</p><p>Cobertura: {formatarDataCivil(p.dados.coberturaCalculada?.inicio)} a {formatarDataCivil(p.dados.coberturaCalculada?.fim)}</p></> : <p>Vencimento do adiantamento: {p.dados.aulas.vencimentoAdiantamento ?? "Sem adiantamento"}</p>}
      <p>Motivo: {p.motivo}</p></section>}
    {p && <section className="space-y-2"><h2 className="text-xl">Prévia das cobranças iniciais</h2><p>Previsão conforme as condições registradas. Nenhuma cobrança é criada por esta consulta.</p>
      {d.pendenciaPrevia ? <p role="alert">{d.pendenciaPrevia}</p> : <ul>{d.previaCobrancas.map((c) => <li key={c.tipo}>{c.tipo === "MATRICULA" ? "Taxa de matrícula" : c.tipo === "MENSALIDADE" ? "Primeira mensalidade" : "Adiantamento por hora"} · {formatarMoeda(Number(c.valor), c.moeda)} · Vencimento {formatarDataCivil(c.vencimento)} · {c.etapa === "ATIVACAO" ? "Emitir na ativação" : "Emitir após conferência da Secretaria"}{c.cobertura ? ` · Cobertura ${formatarDataCivil(c.cobertura.inicio)} a ${formatarDataCivil(c.cobertura.fim)}` : ""}{c.minutos ? ` · ${c.minutos} minutos` : ""}</li>)}</ul>}
    </section>}
    {d.pagadorAlterado && <p role="alert">O pagador mudou após este registro. Confira e registre uma nova versão das condições.</p>}
    {d.impedimento && <p role="status">{d.impedimento}</p>}
    {d.podeEditar && d.pagador && d.regime && <CondicoesFormulario key={`${p?.id ?? "novo"}:${d.pagador.id}`} matriculaId={id} pagadorId={d.pagador.id} versao={p?.versao ?? 0} regime={d.regime} temAdiantamento={d.temAdiantamento} />}
  </div>;
}
