import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAvisosAlteracaoAgenda } from "@/server/comunicacoes-agenda/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { ReconferirPendencia } from "./ReconferirPendencia";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { PaginacaoFila, type CursorDoLink } from "@/components/PaginacaoFila";
import { CANAL_AVISO_ALTERACAO_AGENDA_LABEL, SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL, MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL, rotular } from "@/lib/labels";
import { hrefLista, type ParametrosUrl } from "@/lib/pagina-url";
import { cursorDaLeitura, lerNavegacao } from "@/lib/cursor-fila";
export default async function AvisosAgendaPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const q = await searchParams, navAvisos = lerNavegacao(q), navPendencias = lerNavegacao(q, "Pendencias");
  // Duas filas, cada uma com o próprio cursor nos dois sentidos; o link de uma mantém o ponto da outra.
  const avisosAtuais = { depois: navAvisos.depois, antes: navAvisos.antes };
  const pendenciasAtuais = { depoisPendencias: navPendencias.depois, antesPendencias: navPendencias.antes };
  const hrefAvisos = (cursor: CursorDoLink) => hrefLista("/secretaria/avisos-agenda", { ...cursor, ...pendenciasAtuais });
  const hrefPendencias = (cursor: CursorDoLink) => hrefLista("/secretaria/avisos-agenda", { ...avisosAtuais, ...("antes" in cursor ? { antesPendencias: cursor.antes } : { depoisPendencias: cursor.depois }) });
  const [resultado, preferencia] = await Promise.all([
    consultarAvisosAlteracaoAgenda({ ...avisosAtuais, ...pendenciasAtuais }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!resultado.ok || !resultado.dado) return <section><h1 className="text-2xl font-medium">Avisos de alterações na agenda</h1><p role="alert">Não foi possível consultar a fila.</p></section>;
  const d = resultado.dado;
  const preferenciaFusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const instanteAdministrativo = (valor: Date) => {
    const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
    return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
  };
  return <section className="space-y-5"><header><VoltarPara href="/secretaria" /><h1 className="text-2xl font-medium">Avisos de alterações na agenda</h1><p className="text-sm text-gray-600">Aceito pelo provedor não confirma entrega. A fila não faz novo envio automático após resultado incerto.</p></header><section className="space-y-2"><h2 className="text-lg font-medium">Avisos</h2><ul className="space-y-2">{d.itens.map(i => <li key={i.id} className="rounded border p-3"><strong>{i.alunoNome}</strong><p>{rotular(CANAL_AVISO_ALTERACAO_AGENDA_LABEL, i.canal)} · {rotular(SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL, i.situacao)}</p><p className="text-xs text-gray-500">Atualizado: {instanteAdministrativo(i.atualizadoEm)}</p></li>)}</ul>{!d.itens.length && (cursorDaLeitura(navAvisos) !== null ? <EstadoVazio role="status" acao={<Link className="underline" href={hrefLista("/secretaria/avisos-agenda", pendenciasAtuais)}>Ir para o início dos avisos</Link>}>Nenhum aviso a partir deste ponto da fila: o link ficou antigo ou a fila terminou.</EstadoVazio> : <EstadoVazio role="status">Nenhum aviso de alteração na agenda.</EstadoVazio>)}<PaginacaoFila anterior={d.anterior} proxima={d.proxima} href={hrefAvisos} rotulo="Navegação da fila de avisos" /></section><section className="space-y-2"><h2 className="text-lg font-medium">Pendências operacionais</h2><p className="text-sm text-gray-600">Uma pendência não confirma envio nem autoriza nova tentativa.</p><ul className="space-y-2">{d.pendencias.map(p => <li key={p.id} className="rounded border p-3"><strong>{p.matriculaCodigo ?? "Matrícula"} · {p.alunoNome}</strong><p>{rotular(MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL, p.motivo)} · {p.situacao === "PENDENTE" ? "Pendente" : "Resolvida"}</p><p className="text-xs text-gray-500">Registrada: {instanteAdministrativo(p.criadoEm)}</p>{p.situacao === "RESOLVIDA" ? <p className="text-sm">Encerrada por {p.resolvidaPorNome ?? "usuário indisponível"}: {p.observacaoResolucao}</p> : <ReconferirPendencia pendenciaId={p.id} />}<Link className="text-sm underline" href={`/matriculas/${encodeURIComponent(p.matriculaId)}/autorizacoes-comunicacao`}>Conferir destinatários acadêmicos</Link></li>)}</ul>{!d.pendencias.length && (cursorDaLeitura(navPendencias) !== null ? <EstadoVazio role="status" acao={<Link className="underline" href={hrefLista("/secretaria/avisos-agenda", avisosAtuais)}>Ir para o início das pendências</Link>}>Nenhuma pendência a partir deste ponto da fila: o link ficou antigo ou a fila terminou.</EstadoVazio> : <EstadoVazio role="status">Nenhuma pendência operacional registrada.</EstadoVazio>)}<PaginacaoFila anterior={d.anteriorPendencia} proxima={d.proximaPendencia} href={hrefPendencias} rotulo="Navegação da fila de pendências operacionais" /></section></section>;
}
