import { Papel } from "@prisma/client";
import { exigirSessaoPagina, temPapel } from "@/server/_shared";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { lerFiltrosInbox } from "@/server/inbox/filtros";
import { decodificarCursor } from "@/server/inbox/cursor";
import { listarAtendimentosPagina, obterItemListaInbox } from "@/server/inbox/consultas-pagina";
import { InboxNovo } from "./InboxNovo";
import { AtendimentosPainel } from "./AtendimentosPainel";
import { listarOpcoesAtendimento, listarTriagemWhatsApp, listarRevisoesEnvio } from "@/server/whatsapp/operacoes-atendimento";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";

// Inbox novo (Fase 3): lista paginada por cursor + conversa + painel; tempo real por SSE (sem polling).
// Guard de página ANTES de qualquer consulta; o row-level real é o escopo do atendimento (whatsapp/escopo.ts).
// A triagem/revisão do Inbox antigo continua aqui, (abrir atendimento; triagem e revisão só do administrador) até a Task 33 movê-la para a conversa.

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
  const admin = temPapel(usuario, Papel.ADMINISTRADOR);

  const [inicial, opcoes, triagem, revisoes, preferencia] = await Promise.all([
    listarAtendimentosPagina(usuario, filtros, cursor),
    listarOpcoesAtendimento(),
    admin ? listarTriagemWhatsApp() : Promise.resolve(null),
    admin ? listarRevisoesEnvio() : Promise.resolve(null),
    consultarPreferenciaFusoEquipe(),
  ]);
  // Deep link (?c=) fora da primeira página ou dos filtros: o item entra na lista (o escopo continua valendo).
  if (c && !inicial.itens.some((i) => i.id === c)) {
    const item = await obterItemListaInbox(usuario, c);
    if (item) inicial.itens = [item, ...inicial.itens];
  }
  const fuso = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;

  return (
    <div>
      <h1 className="text-2xl font-medium">Inbox</h1>
      <div className="mt-4">
        <AtendimentosPainel opcoes={opcoes} triagem={triagem} revisoes={revisoes} preferenciaFusoExibicao={fuso} />
      </div>
      <div className="mt-4">
        <InboxNovo inicial={inicial} filtros={filtros} selecionado={c} usuario={{ id: usuario.id, papeis: usuario.papeis }} fuso={fuso}
          destinos={opcoes.destinos.map((d) => ({ chave: d.chave, nome: d.nome, finalidade: d.finalidade, disponivel: d.disponivel }))} />
      </div>
    </div>
  );
}
