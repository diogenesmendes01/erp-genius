import { Client } from "pg";

// Barramento de tempo real do inbox (E6): um único pg.Client por processo faz LISTEN no canal
// e repassa os avisos (só ids, sem conteúdo) aos assinantes. O NOTIFY só chega no commit.
export const CANAL_INBOX = "inbox_eventos";

export type AvisoInbox = {
  // `resync`: a escuta caiu e voltou; avisos podem ter sido perdidos, o cliente recarrega o que mostra.
  tipo: "atendimento.atualizado" | "mensagem.nova" | "mensagem.status" | "resync";
  atendimentoId: string | null;
  mensagemId: string | null;
  conversaId: string;
  /**
   * Aviso direcionado (só `atendimento.atualizado`): vai apenas a este usuário, sem consultar o escopo. Sai da
   * revogação de um convite, quando o ex-convidado já está fora do escopo e o aviso comum não o alcançaria.
   * O NOTIFY só é emitido pelo servidor (nunca pelo cliente) e o id não é repassado no quadro SSE.
   */
  paraUsuarioId?: string;
};

type Estado = {
  assinantes: Set<(a: AvisoInbox) => void>;
  client: Client | null;
  iniciando: Promise<void> | null;
  url: string | null;
  tentativa: number;
  jaConectou: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

const g = globalThis as unknown as { __barramentoInbox?: Estado };
const estado: Estado = (g.__barramentoInbox ??= { assinantes: new Set(), client: null, iniciando: null, url: null, tentativa: 0, jaConectou: false, timer: null });

const ESPERA_INICIAL_MS = 1000;
const ESPERA_MAXIMA_MS = 30_000;

export function esperaReconexaoMs(tentativa: number): number {
  return Math.min(ESPERA_INICIAL_MS * 2 ** tentativa, ESPERA_MAXIMA_MS);
}

export function assinarInbox(fn: (a: AvisoInbox) => void): () => void {
  estado.assinantes.add(fn);
  return () => { estado.assinantes.delete(fn); };
}

function emitir(payload: string | undefined) {
  if (!payload) return;
  let aviso: AvisoInbox;
  try { aviso = JSON.parse(payload) as AvisoInbox; } catch { return; }
  repassar(aviso);
}

function repassar(aviso: AvisoInbox) {
  for (const fn of [...estado.assinantes]) {
    try { fn(aviso); } catch { /* assinante com defeito não derruba o barramento */ }
  }
}

function urlPadrao(): string {
  const bruta = process.env.DATABASE_URL;
  if (!bruta) throw new Error("DATABASE_URL ausente para o barramento do inbox.");
  const u = new URL(bruta);
  u.searchParams.delete("schema");
  return u.toString();
}

function agendarReconexao() {
  if (estado.timer || !estado.url) return;
  const espera = esperaReconexaoMs(estado.tentativa++);
  estado.timer = setTimeout(() => {
    estado.timer = null;
    estado.iniciando = conectar().catch(() => agendarReconexao());
  }, espera);
  estado.timer.unref?.();
}

async function conectar(): Promise<void> {
  const client = new Client({ connectionString: estado.url! });
  const cair = () => {
    if (estado.client !== client) return;
    estado.client = null;
    estado.iniciando = null;
    client.removeAllListeners();
    client.on("error", () => {});
    client.end().catch(() => {});
    agendarReconexao();
  };
  client.on("error", cair);
  client.on("end", cair);
  client.on("notification", (m) => { if (m.channel === CANAL_INBOX) emitir(m.payload); });
  try {
    await client.connect();
    await client.query(`LISTEN ${CANAL_INBOX}`);
  } catch (e) {
    client.removeAllListeners();
    client.on("error", () => {});
    client.end().catch(() => {});
    throw e;
  }
  estado.client = client;
  estado.tentativa = 0;
  // Reconexão (não a primeira): o NOTIFY não é guardado enquanto a escuta está fora, então manda reler.
  if (estado.jaConectou) repassar({ tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" });
  estado.jaConectou = true;
}

// Idempotente: chamadas repetidas reaproveitam a escuta ativa (ou em andamento).
export function iniciarEscuta(url?: string): Promise<void> {
  if (estado.client) return Promise.resolve();
  if (estado.iniciando) return estado.iniciando;
  estado.url = url ?? estado.url ?? urlPadrao();
  if (estado.timer) { clearTimeout(estado.timer); estado.timer = null; }
  const p = conectar().catch((e) => { estado.iniciando = null; agendarReconexao(); throw e; });
  estado.iniciando = p;
  return p;
}
