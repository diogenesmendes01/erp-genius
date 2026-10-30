import { lerJsonPortalAluno } from "@/server/portal-aluno/http";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { entrarPortalAluno } from "@/server/portal-aluno/identidade";
import { ErroConfigPortalIncompleta } from "@/server/portal-aluno/erros";
import { cookieSessaoPortalAluno } from "@/server/portal-aluno/sessao";
import { origemPortalAlunoPermitida } from "@/server/portal-aluno/politica";

export const runtime = "nodejs";

const semCache = { "Cache-Control": "no-store" } as const;
const entradaInvalida = () => {
  console.warn("portal-aluno.login.entrada-invalida");
  return NextResponse.json({ erro: "Não foi possível iniciar a sessão." }, { status: 422, headers: semCache });
};

export async function POST(request: Request) {
  if (!origemPortalAlunoPermitida(request)) {
    return NextResponse.json({ erro: "Origem não permitida." }, { status: 403, headers: semCache });
  }
  let corpo: unknown;
  try {
    corpo = await lerJsonPortalAluno(request);
  } catch {
    return entradaInvalida();
  }
  try {
    const resultado = await entrarPortalAluno(corpo);
    if (!resultado.autenticado) {
      return NextResponse.json({ erro: "Credenciais inválidas." }, { status: 401, headers: semCache });
    }
    const resposta = NextResponse.json({ ok: true }, { headers: semCache });
    resposta.cookies.set(cookieSessaoPortalAluno(resultado.sessaoCookie, resultado.expiraEm));
    return resposta;
  } catch (e) {
    // #536: discriminação SOMENTE por classe + código; a mensagem interna nunca chega ao cliente.
    if (e instanceof ErroConfigPortalIncompleta && e.codigo === "PORTAL_CONFIG_INCOMPLETA") {
      console.error("portal-aluno.login.config-incompleta", { codigo: e.codigo, camposAusentes: [...e.camposAusentes] });
      return NextResponse.json(
        { erro: "Portal temporariamente indisponível, procure a secretaria.", codigo: "PORTAL_INDISPONIVEL" },
        { status: 503, headers: { ...semCache, "Retry-After": "300" } },
      );
    }
    if (e instanceof ZodError) return entradaInvalida();
    console.error("portal-aluno.login.erro-inesperado", { nome: e instanceof Error ? e.name : typeof e });
    return NextResponse.json({ erro: "Não foi possível iniciar a sessão. Tente novamente." }, { status: 500, headers: semCache });
  }
}
