import { Papel } from "@prisma/client";
import { exigirSessaoPagina, temPapel } from "@/server/_shared";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { carregarThread, listarConversas } from "@/server/whatsapp/consultas";
import { InboxCliente } from "./InboxCliente";
import { AtendimentosPainel } from "./AtendimentosPainel";
import { listarOpcoesAtendimento, listarTriagemWhatsApp, listarRevisoesEnvio } from "@/server/whatsapp/operacoes-atendimento";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";

// INBOX MÍNIMA (doc 26 §Camada 3 · doc 30 E3): lista (não-lidas primeiro) + thread +
// texto livre + mídia + vínculo + ação rápida de cobrança. Guard de página ANTES de
// qualquer consulta; o row-level real é o escopo do número (whatsapp/escopo.ts).

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const usuario = await exigirSessaoPagina(...PAPEIS_INBOX);
  const { c } = await searchParams;

  const [conversas, thread, opcoes, triagem, revisoes, preferencia] = await Promise.all([
    listarConversas(usuario),
    c ? carregarThread(usuario, c) : Promise.resolve(null),
    listarOpcoesAtendimento(),
    temPapel(usuario, Papel.ADMINISTRADOR) ? listarTriagemWhatsApp() : Promise.resolve(null),
    temPapel(usuario, Papel.ADMINISTRADOR) ? listarRevisoesEnvio() : Promise.resolve(null),
    consultarPreferenciaFusoEquipe(),
  ]);

  // Alçadas das ações rápidas seguem o doc 12: promessa/pagamento = Financeiro/Secretaria.
  const podeCobranca = temPapel(usuario, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA);
  const preferenciaFusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;

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
        <InboxCliente conversas={conversas} thread={thread} podeCobranca={podeCobranca} preferenciaFusoExibicao={preferenciaFusoExibicao} />
      </div>
    </div>
  );
}
