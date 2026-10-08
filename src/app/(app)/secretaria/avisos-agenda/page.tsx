import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAvisosAlteracaoAgenda } from "@/server/comunicacoes-agenda/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { ReconferirPendencia } from "./ReconferirPendencia";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Paginacao } from "@/components/Paginacao";
import { CANAL_AVISO_ALTERACAO_AGENDA_LABEL, SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL, MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL, rotular } from "@/lib/labels";
import { hrefLista, lerPagina, type ParametrosUrl } from "@/lib/pagina-url";
export default async function AvisosAgendaPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const q = await searchParams, pagina = lerPagina(q), paginaPendencias = lerPagina(q, "paginaPendencias");
  // Cada lista anda nos dois sentidos sem perder a página da outra.
  const href = (avisos: number, pendencias: number) => hrefLista("/secretaria/avisos-agenda", { pagina: avisos, paginaPendencias: pendencias });
  const [resultado, preferencia] = await Promise.all([
    consultarAvisosAlteracaoAgenda({ pagina, paginaPendencias }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!resultado.ok || !resultado.dado) return <section><h1 className="text-2xl font-medium">Avisos de alterações na agenda</h1><p role="alert">Não foi possível consultar a fila.</p></section>;
  const d = resultado.dado;
  const preferenciaFusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const instanteAdministrativo = (valor: Date) => {
    const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
    return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
  };
  return <section className="space-y-5"><header><VoltarPara href="/secretaria" /><h1 className="text-2xl font-medium">Avisos de alterações na agenda</h1><p className="text-sm text-gray-600">Aceito pelo provedor não confirma entrega. A fila não faz novo envio automático após resultado incerto.</p></header><section className="space-y-2"><h2 className="text-lg font-medium">Avisos</h2><ul className="space-y-2">{d.itens.map(i => <li key={i.id} className="rounded border p-3"><strong>{i.alunoNome}</strong><p>{rotular(CANAL_AVISO_ALTERACAO_AGENDA_LABEL, i.canal)} · {rotular(SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL, i.situacao)}</p><p className="text-xs text-gray-500">Atualizado: {instanteAdministrativo(i.atualizadoEm)}</p></li>)}</ul>{!d.itens.length && (pagina > 1 ? <EstadoVazio role="status">Nenhum aviso nesta página.</EstadoVazio> : <EstadoVazio role="status">Nenhum aviso de alteração na agenda.</EstadoVazio>)}<Paginacao pagina={pagina} temProxima={d.temProxima} href={(p) => href(p, paginaPendencias)} rotulo="Páginas de avisos" /></section><section className="space-y-2"><h2 className="text-lg font-medium">Pendências operacionais</h2><p className="text-sm text-gray-600">Uma pendência não confirma envio nem autoriza nova tentativa.</p><ul className="space-y-2">{d.pendencias.map(p => <li key={p.id} className="rounded border p-3"><strong>{p.matriculaCodigo ?? "Matrícula"} · {p.alunoNome}</strong><p>{rotular(MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL, p.motivo)} · {p.situacao === "PENDENTE" ? "Pendente" : "Resolvida"}</p><p className="text-xs text-gray-500">Registrada: {instanteAdministrativo(p.criadoEm)}</p>{p.situacao === "RESOLVIDA" ? <p className="text-sm">Encerrada por {p.resolvidaPorNome ?? "usuário indisponível"}: {p.observacaoResolucao}</p> : <ReconferirPendencia pendenciaId={p.id} />}<Link className="text-sm underline" href={`/matriculas/${encodeURIComponent(p.matriculaId)}/autorizacoes-comunicacao`}>Conferir destinatários acadêmicos</Link></li>)}</ul>{!d.pendencias.length && (paginaPendencias > 1 ? <EstadoVazio role="status">Nenhuma pendência nesta página.</EstadoVazio> : <EstadoVazio role="status">Nenhuma pendência operacional registrada.</EstadoVazio>)}<Paginacao pagina={paginaPendencias} temProxima={d.temProximaPendencia} href={(p) => href(pagina, p)} rotulo="Páginas de pendências operacionais" /></section></section>;
}
