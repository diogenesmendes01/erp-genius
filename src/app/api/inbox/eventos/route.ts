import { NextResponse } from "next/server";
import {
  exigirSessaoComPrazo,
  carregarUsuarioFresco,
  apenasPortal,
  temPapel,
  ErroAutenticacao,
  exigirPapel,
  ErroPermissao,
  type UsuarioSessao,
} from "@/server/_shared/sessao";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { assinarInbox, iniciarEscuta } from "@/server/inbox/barramento";
import { criarFiltroDeAvisos, formatarSSE } from "@/server/inbox/eventos-sse";
import { REVALIDAR_MS, RETRY_MS, VIDA_MAX_MS } from "./limites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PING_MS = 25_000;

const podeContinuar = (u: UsuarioSessao | null): u is UsuarioSessao => !!u && !apenasPortal(u) && temPapel(u, ...PAPEIS_INBOX);

export async function GET(req: Request) {
  let usuario: UsuarioSessao;
  let expiraEm: number | null;
  try {
    ({ usuario, expiraEm } = await exigirSessaoComPrazo());
    exigirPapel(usuario, ...PAPEIS_INBOX);
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
    if (e instanceof ErroPermissao) return NextResponse.json({ erro: "Sem acesso à inbox." }, { status: 403 });
    throw e;
  }
  const vida = expiraEm === null ? VIDA_MAX_MS : Math.min(VIDA_MAX_MS, expiraEm - Date.now());
  if (vida <= 0) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  await iniciarEscuta().catch(() => {});

  let filtro = criarFiltroDeAvisos(usuario);
  const enc = new TextEncoder();
  let encerrar = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let aberto = true;
      let fila: Promise<void> = Promise.resolve();
      const enviar = (texto: string) => { if (aberto) { try { controller.enqueue(enc.encode(texto)); } catch { encerrar(); } } };
      const ping = setInterval(() => enviar(": ping\n\n"), PING_MS);
      const prazo = setTimeout(() => encerrar(), vida);
      const revalidar = setInterval(() => {
        fila = fila.then(async () => {
          if (!aberto) return;
          let fresco: UsuarioSessao | null;
          try { fresco = await carregarUsuarioFresco(usuario.id); } catch { encerrar(); return; }
          if (!podeContinuar(fresco)) { encerrar(); return; }
          usuario = fresco;
          filtro = criarFiltroDeAvisos(fresco);
        });
      }, REVALIDAR_MS);
      const sair = assinarInbox((aviso) => {
        fila = fila.then(async () => {
          if (!aberto) return;
          try { if (await filtro(aviso)) enviar(formatarSSE(aviso)); } catch {  }
        });
      });
      encerrar = () => {
        if (!aberto) return;
        aberto = false; clearInterval(ping); clearInterval(revalidar); clearTimeout(prazo); sair();
        try { controller.close(); } catch {  }
      };
      req.signal.addEventListener("abort", encerrar, { once: true });
      if (req.signal.aborted) encerrar();
      else enviar(`retry: ${RETRY_MS}\n: ok\n\n`);
    },
    cancel() { encerrar(); },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no",
  } });
}
