import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCorrecoesRelatoIndisponibilidadeOferta } from "@/server/matricula/indisponibilidade-oferta-correcao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { DecidirCorrecaoRelato, ProporCorrecaoRelato } from "./CorrecaoRelatoOferta";

const civil = (data: string) => { const [ano, mes, dia] = data.split("-"); return `${dia}/${mes}/${ano}`; };
const periodo = (p: { inicio: string; fim: string | null }) => `${civil(p.inicio)}${p.fim ? ` a ${civil(p.fim)}` : " em aberto"}`;

export default async function CorrecaoRelatoPage({ params, searchParams }: { params: Promise<{ id: string; registroId: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const { id: matriculaId, registroId } = await params;
  const informada = Number((await searchParams).pagina ?? "1"), pagina = Number.isInteger(informada) && informada > 0 && informada <= 100_000 ? informada : 1;
  const [resultado, preferencia] = await Promise.all([consultarCorrecoesRelatoIndisponibilidadeOferta({ registroId, pagina }), consultarPreferenciaFusoEquipe()]);
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;
  if (d.relato.matriculaId !== matriculaId) return <p role="alert">Relato de indisponibilidade não encontrado nesta matrícula.</p>;
  const fusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const instante = (iso: string) => { const e = formatarInstanteExibicao(iso, fusoExibicao, "UTC"); return `${e.texto} (${e.fuso})`; };
  const base = `/matriculas/${encodeURIComponent(matriculaId)}/indisponibilidade-oferta`;
  return <div className="space-y-4">
    <Link href={base} className="underline">Voltar aos relatos de indisponibilidade</Link>
    <h1 className="text-2xl">Correção do período do relato</h1>
    <p>Período vigente: {periodo(d.relato)}{d.relato.terminoAprovado ? `. Último dia aprovado pelo término: ${civil(d.relato.terminoAprovado)}` : ""}. Motivo, evidência e autoria do relato original permanecem preservados.</p>
    {!d.relato.confirmado && <p role="status">Somente relato confirmado como indisponível admite correção de período.</p>}
    {d.podePropor && <ProporCorrecaoRelato registroId={registroId} inicio={d.relato.inicio} fim={d.relato.fim} />}
    {d.podeDecidir && d.pendenteId && <DecidirCorrecaoRelato key={d.pendenteId} propostaId={d.pendenteId} />}
    {d.pendenteId && !d.podeDecidir && <p role="status">Há correção aguardando decisão de outra pessoa da Gestão Pedagógica ou da Administração.</p>}
    <section className="space-y-3"><h2 className="text-xl">Histórico de correções</h2>
      {!d.propostas.length && <p>Nenhuma correção registrada.</p>}
      {d.propostas.map((p) => <article key={p.id} className="space-y-1 rounded border p-3">
        <h3 className="font-medium">Versão {p.versao} · de {periodo(p.anterior)} para {periodo(p.novo)}</h3>
        <p>Proposta por {p.autorNome} em {instante(p.criadaEm)}.</p><p>Motivo: {p.motivo}</p><p>Evidência: {p.evidenciaTexto}</p>
        {p.decisao ? <><p role="status">{p.decisao.aprovada ? "Aprovada" : "Rejeitada"} em {instante(p.decisao.decididaEm)}.</p><p>Motivo da decisão: {p.decisao.motivo}</p></> : <p role="status">Aguardando decisão.</p>}
      </article>)}
      <nav className="flex gap-4">{pagina > 1 && <Link className="underline" href={`?pagina=${pagina - 1}`}>Mais recentes</Link>}{d.temProxima && <Link className="underline" href={`?pagina=${pagina + 1}`}>Anteriores</Link>}</nav>
    </section>
  </div>;
}
