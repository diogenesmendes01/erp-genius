import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAvisosAlteracaoAgenda } from "@/server/comunicacoes-agenda/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { ReconferirPendencia } from "./ReconferirPendencia";
import { VoltarPara } from "@/components/VoltarPara";
const rotulo: Record<string, string> = { PREPARADO: "Preparado", ENVIADO: "Aceito pelo provedor", INCERTO: "Resultado incerto", FALHOU: "Falhou" };
const motivos: Record<string, string> = { SEM_DESTINATARIO_AUTORIZADO: "Sem destinatário acadêmico autorizado", CONFIGURACAO_INDISPONIVEL: "Configuração institucional indisponível", CONTATO_SEM_OPT_IN: "Contato sem aceite de comunicações", CONTATO_INDISPONIVEL: "Contato acadêmico indisponível" };
export default async function AvisosAgendaPage({ searchParams }: { searchParams: Promise<{ cursor?: string; pendenciaCursor?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR); const { cursor, pendenciaCursor } = await searchParams;
  const [resultado, preferencia] = await Promise.all([
    consultarAvisosAlteracaoAgenda({ cursor, pendenciaCursor }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!resultado.ok || !resultado.dado) return <section><h1 className="text-2xl font-medium">Avisos de alterações na agenda</h1><p role="alert">Não foi possível consultar a fila.</p></section>;
  const d = resultado.dado;
  const preferenciaFusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const instanteAdministrativo = (valor: Date) => {
    const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
    return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
  };
  return <section className="space-y-5"><header><VoltarPara href="/secretaria" para="Secretaria" /><h1 className="text-2xl font-medium">Avisos de alterações na agenda</h1><p className="text-sm text-gray-600">Aceito pelo provedor não confirma entrega. A fila não faz novo envio automático após resultado incerto.</p></header><section className="space-y-2"><h2 className="text-lg font-medium">Avisos</h2><ul className="space-y-2">{d.itens.map(i => <li key={i.id} className="rounded border p-3"><strong>{i.alunoNome}</strong><p>{i.canal} · {rotulo[i.situacao] ?? i.situacao}</p><p className="text-xs text-gray-500">Atualizado: {instanteAdministrativo(i.atualizadoEm)}</p></li>)}</ul>{!d.itens.length && <p role="status">Nenhum aviso nesta página.</p>}{cursor && <Link className="underline" href={`/secretaria/avisos-agenda${pendenciaCursor ? `?pendenciaCursor=${encodeURIComponent(pendenciaCursor)}` : ""}`}>Voltar ao início</Link>}{d.proximoCursor && <Link className="ml-4 underline" href={`/secretaria/avisos-agenda?cursor=${encodeURIComponent(d.proximoCursor)}${pendenciaCursor ? `&pendenciaCursor=${encodeURIComponent(pendenciaCursor)}` : ""}`}>Próxima página</Link>}</section><section className="space-y-2"><h2 className="text-lg font-medium">Pendências operacionais</h2><p className="text-sm text-gray-600">Uma pendência não confirma envio nem autoriza nova tentativa.</p><ul className="space-y-2">{d.pendencias.map(p => <li key={p.id} className="rounded border p-3"><strong>{p.matriculaCodigo ?? "Matrícula"} · {p.alunoNome}</strong><p>{motivos[p.motivo] ?? p.motivo} · {p.situacao === "PENDENTE" ? "Pendente" : "Resolvida"}</p><p className="text-xs text-gray-500">Registrada: {instanteAdministrativo(p.criadoEm)}</p>{p.situacao === "RESOLVIDA" ? <p className="text-sm">Encerrada por {p.resolvidaPorNome ?? "usuário indisponível"}: {p.observacaoResolucao}</p> : <ReconferirPendencia pendenciaId={p.id} />}<Link className="text-sm underline" href={`/matriculas/${encodeURIComponent(p.matriculaId)}/autorizacoes-comunicacao`}>Conferir destinatários acadêmicos</Link></li>)}</ul>{!d.pendencias.length && <p role="status">Nenhuma pendência nesta página.</p>}{pendenciaCursor && <Link className="underline" href={`/secretaria/avisos-agenda${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`}>Voltar ao início das pendências</Link>}{d.proximoCursorPendencia && <Link className="ml-4 underline" href={`/secretaria/avisos-agenda?pendenciaCursor=${encodeURIComponent(d.proximoCursorPendencia)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`}>Próxima página de pendências</Link>}</section></section>;
}
