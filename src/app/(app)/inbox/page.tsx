import { Papel } from "@prisma/client";
import { exigirSessaoPagina, temPapel } from "@/server/_shared";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { carregarThread, listarConversasInbox, listarLinhasDoUsuario } from "@/server/whatsapp/consultas";
import { lerBuscaInbox, lerCanalInbox } from "@/server/whatsapp/busca-inbox";
import { InboxCliente } from "./InboxCliente";
import { AtendimentosPainel } from "./AtendimentosPainel";
import { listarOpcoesAtendimento, listarTriagemWhatsApp, listarRevisoesEnvio } from "@/server/whatsapp/operacoes-atendimento";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";

// INBOX MÍNIMA (doc 26 §Camada 3 · doc 30 E3): lista (não-lidas primeiro) + thread +
// texto livre + mídia + vínculo + ação rápida de cobrança. Guard de página ANTES de
// qualquer consulta; o row-level real é o escopo do atendimento (whatsapp/escopo.ts).
// SPEC-ERP-005: conversas das linhas comerciais (números de VENDAS) convivem com as institucionais;
// o filtro "Minha linha / Institucional" aparece para quem enxerga os dois tipos.

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const usuario = await exigirSessaoPagina(...PAPEIS_INBOX);
  const parametros = await searchParams;
  const c = typeof parametros.c === "string" ? parametros.c : undefined;
  // Busca no servidor (E4): alcança as conversas mais antigas, fora das 200 recentes.
  const busca = lerBuscaInbox(parametros);
  const canal = lerCanalInbox(parametros);

  const [lista, thread, opcoes, triagem, revisoes, preferencia, linhas] = await Promise.all([
    listarConversasInbox(usuario, { busca, ...(canal ? { canal } : {}) }),
    c ? carregarThread(usuario, c) : Promise.resolve(null),
    listarOpcoesAtendimento(),
    temPapel(usuario, Papel.ADMINISTRADOR) ? listarTriagemWhatsApp() : Promise.resolve(null),
    temPapel(usuario, Papel.ADMINISTRADOR) ? listarRevisoesEnvio() : Promise.resolve(null),
    consultarPreferenciaFusoEquipe(),
    listarLinhasDoUsuario(usuario),
  ]);

  // Alçadas das ações rápidas seguem o doc 12: promessa/pagamento = Financeiro/Secretaria.
  const podeCobranca = temPapel(usuario, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA);
  const preferenciaFusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  // Filtro por tipo de canal só faz sentido para quem vê linhas comerciais E atendimentos institucionais.
  const veLinhas = temPapel(usuario, Papel.ADMINISTRADOR, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
  const veInstitucional = temPapel(usuario, Papel.ADMINISTRADOR, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA, Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);

  return (
    <div>
      <h1 className="text-2xl font-medium">Inbox</h1>
      <p className="mt-1 text-sm text-gray-500">
        Atendimentos institucionais separados por finalidade e vínculo com a escola.
      </p>
      <div className="mt-6">
        <AtendimentosPainel opcoes={opcoes} triagem={triagem} revisoes={revisoes} preferenciaFusoExibicao={preferenciaFusoExibicao} />
      </div>
      <div className="mt-4">
        <InboxCliente conversas={lista.itens} busca={busca} canal={canal} filtroCanal={veLinhas && veInstitucional} linhas={linhas} limitada={lista.limitada} thread={thread} podeCobranca={podeCobranca} preferenciaFusoExibicao={preferenciaFusoExibicao} />
      </div>
    </div>
  );
}
