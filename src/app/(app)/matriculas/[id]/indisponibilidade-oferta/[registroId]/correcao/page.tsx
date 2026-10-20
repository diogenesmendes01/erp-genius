import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCorrecoesRelatoIndisponibilidadeOferta } from "@/server/matricula/indisponibilidade-oferta-correcao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { AvisoFusoNaoConfigurado } from "@/components/AvisoFusoNaoConfigurado";
import { DecidirCorrecaoRelato, ProporCorrecaoRelato } from "./CorrecaoRelatoOferta";

const civil = (data: string) => { const [ano, mes, dia] = data.split("-"); return `${dia}/${mes}/${ano}`; };
const periodo = (p: { inicio: string; fim: string | null }) => `${civil(p.inicio)}${p.fim ? ` a ${civil(p.fim)}` : " em aberto"}`;

/** Q157: correção versionada do período de um relato confirmado de falta de oferta. */
export default async function CorrecaoRelatoPage({ params, searchParams }: { params: Promise<{ id: string; registroId: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const { id: matriculaId, registroId } = await params;
  const informada = Number((await searchParams).pagina ?? "1"), pagina = Number.isInteger(informada) && informada > 0 && informada <= 100_000 ? informada : 1;
  const [resultado, preferencia] = await Promise.all([consultarCorrecoesRelatoIndisponibilidadeOferta({ registroId, pagina }), consultarPreferenciaFusoEquipe()]);
  const base = `/matriculas/${encodeURIComponent(matriculaId)}/indisponibilidade-oferta`;
  const voltar = <VoltarPara href={base} para="Relatos de indisponibilidade" />;
  if (!resultado.ok || !resultado.dado) return <div className="space-y-4">{voltar}<p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p></div>;
  const d = resultado.dado;
  if (d.relato.matriculaId !== matriculaId) return <div className="space-y-4">{voltar}<p role="alert">Relato de indisponibilidade não encontrado nesta matrícula.</p></div>;
  const fusoPessoal = preferencia.ok ? preferencia.dado?.fusoExibicao : null;
  const instante = (iso: string) => formatarInstanteExibicao(iso, fusoPessoal, d.fusoInstitucional ?? "UTC").texto;
  const paginaAnterior = pagina > 1 ? pagina - 1 : null;

  return <div className="space-y-4">
    {voltar}
    <h1 className="text-2xl">Correção do período do relato</h1>
    {!d.fusoInstitucional && <AvisoFusoNaoConfigurado />}
    <p>Período vigente: {periodo(d.relato)}{d.relato.terminoAprovado ? `. Último dia aprovado pelo término: ${civil(d.relato.terminoAprovado)}` : ""}. Motivo, evidência e autoria do relato original permanecem preservados.</p>
    {!d.relato.confirmado && <p role="status">Somente relato confirmado como indisponível admite correção de período.</p>}
    {d.podePropor && <ProporCorrecaoRelato registroId={registroId} inicio={d.relato.inicio} fim={d.relato.fim} />}
    {d.podeDecidir && d.pendenteId && <DecidirCorrecaoRelato key={d.pendenteId} propostaId={d.pendenteId} />}
    {d.pendenteId && !d.podeDecidir && <p role="status">Há correção aguardando decisão de outra pessoa da Gestão Pedagógica ou da Administração.</p>}
    <section className="space-y-3">
      <h2 className="text-xl">Histórico de correções</h2>
      {!d.propostas.length && (pagina > 1
        ? <EstadoVazio acao={<Link className="underline" href="?pagina=1">Ir para a primeira página</Link>}>Nenhuma correção registrada nesta página.</EstadoVazio>
        : <EstadoVazio>Nenhuma correção registrada para este relato.</EstadoVazio>)}
      {d.propostas.map((p) => <article key={p.id} className="space-y-1 rounded border p-3">
        <h3 className="font-medium">Versão {p.versao} · de {periodo(p.anterior)} para {periodo(p.novo)}</h3>
        <p>Proposta por {p.autorNome} em {instante(p.criadaEm)}.</p>
        <p className="whitespace-pre-wrap">Motivo: {p.motivo}</p>
        <p className="whitespace-pre-wrap">Evidência: {p.evidenciaTexto}</p>
        {p.decisao
          ? <><p role="status">{p.decisao.aprovada ? "Aprovada" : "Rejeitada"} em {instante(p.decisao.decididaEm)}.</p><p className="whitespace-pre-wrap">Motivo da decisão: {p.decisao.motivo}</p></>
          : <p role="status">Aguardando decisão.</p>}
      </article>)}
      <nav className="flex gap-4">
        {paginaAnterior && <Link className="underline" href={`?pagina=${paginaAnterior}`}>Correções mais recentes</Link>}
        {d.temProxima && <Link className="underline" href={`?pagina=${pagina + 1}`}>Correções anteriores</Link>}
      </nav>
    </section>
  </div>;
}
