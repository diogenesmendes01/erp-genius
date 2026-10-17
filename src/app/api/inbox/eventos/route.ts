import { NextResponse } from "next/server";
import { exigirSessao, ErroAutenticacao, exigirPapel, ErroPermissao } from "@/server/_shared/sessao";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { assinarInbox, iniciarEscuta } from "@/server/inbox/barramento";
import { criarFiltroDeAvisos, formatarSSE } from "@/server/inbox/eventos-sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PING_MS = 25_000;

// Tempo real do inbox (E6): repassa só avisos (ids) dos atendimentos que o usuário enxerga.
export async function GET(req: Request) {
  let usuario;
  try {
    usuario = await exigirSessao();
    exigirPapel(usuario, ...PAPEIS_INBOX);
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
    if (e instanceof ErroPermissao) return NextResponse.json({ erro: "Sem acesso à inbox." }, { status: 403 });
    throw e;
  }
  // A escuta é idempotente; falha de conexão não derruba a rota (o barramento reconecta sozinho).
  await iniciarEscuta().catch(() => {});

  const filtro = criarFiltroDeAvisos(usuario);
  const enc = new TextEncoder();
  let encerrar = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let aberto = true;
      let fila: Promise<void> = Promise.resolve();
      const enviar = (texto: string) => { if (aberto) { try { controller.enqueue(enc.encode(texto)); } catch { encerrar(); } } };
      const ping = setInterval(() => enviar(": ping\n\n"), PING_MS);
      const sair = assinarInbox((aviso) => {
        // Fila serial: preserva a ordem dos avisos mesmo com o filtro assíncrono.
        fila = fila.then(async () => {
          if (!aberto) return;
          try { if (await filtro(aviso)) enviar(formatarSSE(aviso)); } catch { /* sem aviso é melhor que stream quebrado */ }
        });
      });
      encerrar = () => {
        if (!aberto) return;
        aberto = false; clearInterval(ping); sair();
        try { controller.close(); } catch { /* já fechado */ }
      };
      req.signal.addEventListener("abort", encerrar, { once: true });
      if (req.signal.aborted) encerrar();
      else enviar(": ok\n\n");
    },
    cancel() { encerrar(); },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no",
  } });
}
