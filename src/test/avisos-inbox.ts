import { randomUUID } from "node:crypto";
import { Client } from "pg";
import type { AvisoInbox } from "@/server/inbox/barramento";

/** Observa NOTIFY real. Canal privado de barreira confirma a entrega após o
 * commit sem sleeps nem inserir um aviso falso no canal produtivo do Inbox.
 */
export async function comAvisosInbox<T>(executar: () => Promise<T>): Promise<{ resultado: T; avisos: AvisoInbox[] }> {
  // A config de integração injeta a URL do perfil; nunca aceitar o fallback do pg.
  const url = process.env.DATABASE_URL;
  const alvo = new URL(url ?? "invalid:");
  if (!["postgres:", "postgresql:"].includes(alvo.protocol) || !["localhost", "127.0.0.1"].includes(alvo.hostname)
    || alvo.port !== "54329" || alvo.search || alvo.hash
    || !["erp_genius_test", "erp_genius_test_dev_email", "erp_genius_test_dev_gravacoes", "erp_genius_test_tester", "erp_genius_test_ciint"].includes(alvo.pathname.slice(1))) {
    throw new Error("O listener de teste exige a URL descartável injetada pela configuração de integração.");
  }
  const client = new Client({ connectionString: url });
  const marca = randomUUID();
  const avisos: AvisoInbox[] = [];
  let confirmar = () => {};
  try {
    await client.connect();
    client.on("notification", (mensagem) => {
      if (mensagem.channel === "inbox_eventos" && mensagem.payload) avisos.push(JSON.parse(mensagem.payload) as AvisoInbox);
      if (mensagem.channel === "inbox_barreira_teste" && mensagem.payload === marca) confirmar();
    });
    await client.query("LISTEN inbox_eventos");
    await client.query("LISTEN inbox_barreira_teste");
    const resultado = await executar();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("A barreira NOTIFY do teste não chegou.")), 3000);
      confirmar = () => { clearTimeout(timer); resolve(); };
      void client.query("SELECT pg_notify('inbox_barreira_teste', $1)", [marca]).catch((erro: unknown) => { clearTimeout(timer); reject(erro); });
    });
    return { resultado, avisos };
  } finally { await client.end(); }
}
