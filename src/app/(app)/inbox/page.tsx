import { Papel } from "@prisma/client";
import { ErroPermissao, exigirSessaoPagina, temPapel } from "@/server/_shared";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { lerFiltrosInbox } from "@/server/inbox/filtros";
import { decodificarCursor } from "@/server/inbox/cursor";
import { contarChipsInbox, listarAtendimentosPagina, obterItemListaInbox } from "@/server/inbox/consultas-pagina";
import { criarOperacaoListaInbox } from "@/server/inbox/contexto-lista";
import { resumoDaListaInbox } from "@/server/inbox/contagens";
import { opcoesFiltroInbox } from "@/server/inbox/opcoes-filtro";
import { InboxNovo } from "./InboxNovo";
import { listarOpcoesAtendimento, listarTriagemWhatsApp, listarRevisoesEnvio } from "@/server/whatsapp/operacoes-atendimento";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { listarNotificacoes } from "@/server/crm/notificacoes";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { capacidadesCrm } from "@/server/crm/permissoes";
import { SinoNotificacoes } from "../tarefas/SinoNotificacoes";

const um = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const usuario = await exigirSessaoPagina(...PAPEIS_INBOX);
  const parametros = await searchParams;
  const c = um(parametros.c) || null;
  const filtros = lerFiltrosInbox(parametros);
  const bruto = um(parametros.cursor);
  const cursor = bruto && decodificarCursor(bruto) ? bruto : null;
  const operacao=criarOperacaoListaInbox(usuario);
  const admin = temPapel(usuario, Papel.ADMINISTRADOR);
  const triagemOuNula = () => listarTriagemWhatsApp().catch((e: unknown) => {
    if (e instanceof ErroPermissao) return null;
    throw e;
  });

  const [inicial, opcoes, triagem, revisoes, preferencia, opcoesFiltro, notificacoes, fusoEscola, contagens, resumo] = await Promise.all([
    listarAtendimentosPagina(usuario, filtros, cursor,undefined,{operacao}),
    listarOpcoesAtendimento(),
    triagemOuNula(),
    admin ? listarRevisoesEnvio() : Promise.resolve(null),
    consultarPreferenciaFusoEquipe(),
    opcoesFiltroInbox(usuario),
    listarNotificacoes(usuario),
    fusoDaEscola(),
    contarChipsInbox(usuario, filtros,{operacao}),
    resumoDaListaInbox(usuario,filtros,undefined,{operacao}),
  ]);
  if (c && !inicial.itens.some((i) => i.id === c)) {
    const item = await obterItemListaInbox(usuario, c,{operacao});
    if (item) inicial.itens = [item, ...inicial.itens];
  }
  const fuso = resolverFusoExibicao((preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null, fusoEscola);

  // eslint-disable-next-line react-hooks/purity -- snapshot servidor autorizado; o cliente recebe o número, não recalcula no getter SSR.
  const agoraInicial = Date.now();
  return (
    <div className="-m-4 md:-m-8 flex min-h-0 flex-col h-[calc(100dvh-3.5625rem)] sm:h-[calc(100dvh-3.3125rem)] md:h-dvh">
      <InboxNovo podeCriarOportunidade={capacidadesCrm(usuario.papeis).has("funil.mover")} podeAbrirFunil={capacidadesCrm(usuario.papeis).has("funil.ver")} agoraInicial={agoraInicial} inicial={inicial} filtros={filtros} selecionado={c} usuario={{ id: usuario.id, nome: usuario.nome, papeis: usuario.papeis }} fusoEscola={fusoEscola} fuso={fuso}
        destinos={opcoes.destinos.map((d) => ({ chave: d.chave, nome: d.nome, finalidade: d.finalidade, disponivel: d.disponivel }))}
        triagem={triagem} revisoes={revisoes} opcoesFiltro={opcoesFiltro} contagens={contagens} resumo={resumo}
        opcoesNovaConversa={opcoes} sino={<SinoNotificacoes key="sino-inbox" notificacoes={notificacoes} fusoExibicao={fuso} fusoEscola={fusoEscola} />} />
    </div>
  );
}
