import { Papel } from "@prisma/client";
import { exigirSessaoPagina, temPapel } from "@/server/_shared";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { carregarThread, listarConversas } from "@/server/whatsapp/consultas";
import { InboxCliente } from "./InboxCliente";

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

  const [conversas, thread] = await Promise.all([
    listarConversas(usuario),
    c ? carregarThread(usuario, c) : Promise.resolve(null),
  ]);

  // Alçadas das ações rápidas seguem o doc 12: promessa/pagamento = Financeiro/Secretaria.
  const podeCobranca = temPapel(usuario, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA);

  return (
    <div>
      <h1 className="text-2xl font-medium">Inbox</h1>
      <p className="mt-1 text-sm text-gray-500">
        Conversas de WhatsApp dos números da escola — vendas e respostas de cobrança.
      </p>
      <div className="mt-6">
        <InboxCliente conversas={conversas} thread={thread} podeCobranca={podeCobranca} />
      </div>
    </div>
  );
}
