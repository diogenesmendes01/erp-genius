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

/** O usuário relido ainda pode receber os avisos do Inbox? */
const podeContinuar = (u: UsuarioSessao | null): u is UsuarioSessao => !!u && !apenasPortal(u) && temPapel(u, ...PAPEIS_INBOX);

// Tempo real do inbox (E6): repassa só avisos (ids) dos atendimentos que o usuário enxerga.
// B9 (#201 C6): a conexão tem prazo máximo de vida e revalida a sessão periodicamente. Usuário desativado, papel
// revogado, falha ao reler ou JWT vencido fecham o stream; o EventSource reconecta sozinho e a abertura confere
// sessão e papel de novo (401/403 encerram de vez).
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
  // A escuta é idempotente; falha de conexão não derruba a rota (o barramento reconecta sozinho).
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
        // Na fila dos avisos: nenhum aviso sai com o usuário velho depois que a revalidação começou.
        fila = fila.then(async () => {
          if (!aberto) return;
          let fresco: UsuarioSessao | null;
          try { fresco = await carregarUsuarioFresco(usuario.id); } catch { encerrar(); return; }
          if (!podeContinuar(fresco)) { encerrar(); return; }
          // Papéis podem ter mudado sem perder o Inbox: o escopo do filtro passa a ser o do usuário relido.
          usuario = fresco;
          filtro = criarFiltroDeAvisos(fresco);
        });
      }, REVALIDAR_MS);
      const sair = assinarInbox((aviso) => {
        // Fila serial: preserva a ordem dos avisos mesmo com o filtro assíncrono.
        fila = fila.then(async () => {
          if (!aberto) return;
          try { if (await filtro(aviso)) enviar(formatarSSE(aviso)); } catch { /* sem aviso é melhor que stream quebrado */ }
        });
      });
      encerrar = () => {
        if (!aberto) return;
        aberto = false; clearInterval(ping); clearInterval(revalidar); clearTimeout(prazo); sair();
        try { controller.close(); } catch { /* já fechado */ }
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
