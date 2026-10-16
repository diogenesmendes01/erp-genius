import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarFilaEnviosPortalAluno } from "@/server/portal-aluno/fila-envios";
import { ROTULO_SITUACAO_FILA_ENVIOS, SITUACOES_FILA_ENVIOS, hrefFilaEnvios, lerSituacaoFilaEnvios } from "@/server/portal-aluno/filtro-fila-envios";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { ConciliacaoEnvio } from "./ConciliacaoEnvio";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { PaginacaoFila } from "@/components/PaginacaoFila";
import { FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL, SITUACAO_ENVIO_PORTAL_ALUNO_LABEL, rotular } from "@/lib/labels";
import type { ParametrosUrl } from "@/lib/pagina-url";
import { cursorDaLeitura, lerNavegacao } from "@/lib/cursor-fila";

// Abas de situação (docs/42 L431; docs/43 §6 item 9): "Incertos" abre a tela — é o que ela existe para tratar —,
// "Falhas" e "Todos" ao lado. A situação vai na URL e acompanha o cursor nos dois sentidos.
export default async function EnviosPortalPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const parametros = await searchParams;
  const nav = lerNavegacao(parametros);
  const situacao = lerSituacaoFilaEnvios(parametros);
  const [resultado, preferencia] = await Promise.all([
    consultarFilaEnviosPortalAluno({ ...nav, situacao }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!resultado.ok || !resultado.dado) return <section><h1 className="text-2xl font-medium">Envios de acesso ao portal</h1><p role="alert">Não foi possível consultar a fila.</p></section>;
  const { itens, anterior, proxima } = resultado.dado;
  const preferenciaFusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const instanteAdministrativo = (valor: Date) => {
    const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
    return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
  };
  return <section className="space-y-4"><header><VoltarPara href="/secretaria" /><h1 className="text-2xl font-medium">Envios de acesso ao portal</h1><p className="text-sm text-gray-600">Aceito pelo provedor não confirma entrega. Resultado incerto exige conciliação; esta tela não reenvia automaticamente.</p><nav aria-label="Situação dos envios" className="mt-3 flex gap-4 text-sm">{SITUACOES_FILA_ENVIOS.map((s) => s === situacao
    ? <span key={s} aria-current="true" className="font-medium text-gray-900">{ROTULO_SITUACAO_FILA_ENVIOS[s]}</span>
    : <Link key={s} href={hrefFilaEnvios(s)} className="text-brand-700 hover:underline">{ROTULO_SITUACAO_FILA_ENVIOS[s]}</Link>)}</nav></header><ul className="space-y-2">{itens.map(i => <li key={i.id} className="rounded border p-3"><strong>{i.alunoNome}</strong><p>{rotular(FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL, i.finalidade)} · {rotular(SITUACAO_ENVIO_PORTAL_ALUNO_LABEL, i.situacao)}</p><p className="text-xs text-gray-500">Preparada em {instanteAdministrativo(i.criadoEm)}. Atualizada em {instanteAdministrativo(i.atualizadoEm)}.</p>{(i.situacao === "INCERTO" || i.conciliacao) && <ConciliacaoEnvio item={i} preferenciaFusoExibicao={preferenciaFusoExibicao}/>}</li>)}</ul>{!itens.length && (cursorDaLeitura(nav) !== null ? <EstadoVazio bloco role="status" acao={<Link className="underline" href={hrefFilaEnvios(situacao)}>Ir para o início da fila</Link>}>Nenhuma solicitação a partir deste ponto da fila: o link ficou antigo ou a fila terminou.</EstadoVazio> : situacao === "incertos" ? <EstadoVazio bloco role="status">Nenhum envio com resultado incerto para conciliar.</EstadoVazio> : situacao === "falhas" ? <EstadoVazio bloco role="status">Nenhum envio com falha.</EstadoVazio> : <EstadoVazio bloco role="status">Nenhuma solicitação de acesso ao portal na fila.</EstadoVazio>)}<PaginacaoFila anterior={anterior} proxima={proxima} href={(cursor) => hrefFilaEnvios(situacao, cursor)} rotulo="Navegação da fila de envios de acesso ao portal" /></section>;
}
