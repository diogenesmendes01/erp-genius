import { NextResponse } from "next/server";

// LIVENESS do container (healthcheck do Coolify / Docker): sem dependências externas,
// sem segredo, sem lógica de negócio — só responde 200 se o Next está de pé.
// Não confundir com /api/whatsapp/health (saúde do CANAL WhatsApp, protegido e com alertas).
//
// SHA do build (#165): o commit entra pelo build-arg GIT_SHA do Dockerfile (o compose do Coolify repassa o
// SOURCE_COMMIT) e fica na variável de ambiente GIT_SHA do runner. Diz qual versão está no ar. Sem o valor, ou
// com algo que não tem forma de SHA, sai "desconhecido" (a variável nunca é repetida crua na resposta).

export const runtime = "nodejs";
// Lido a cada requisição: o valor é do container, não do momento do `next build`.
export const dynamic = "force-dynamic";

const FORMA_SHA = /^[0-9a-f]{7,40}$/;

function shaDoBuild(valor: string | undefined = process.env.GIT_SHA): string {
  const sha = (valor ?? "").trim().toLowerCase();
  return FORMA_SHA.test(sha) ? sha : "desconhecido";
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, sha: shaDoBuild(), timestamp: new Date().toISOString() }, { status: 200 });
}

// HEAD também funciona (wget --spider usa HEAD).
export const HEAD = GET;
