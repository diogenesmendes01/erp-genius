import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// READINESS do container (healthcheck do Coolify / Docker): valida conectividade com o banco
// e que o Prisma Client está funcional (engine correto carregado).
// Retorna 503 se o banco está inacessível ou o Prisma falha.
// Sem segredo, sem auth, sem lógica de negócio — só a saúde técnica do runtime.
// Rota PÚBLICA: o detalhe do erro (host/porta do banco, mensagem do engine) vai só para o log.

export const runtime = "nodejs";

const TIMEOUT_MS = 3000;

export async function GET(): Promise<NextResponse> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Timeout curto: readiness check não deve travar o healthcheck do orchestrator.
    const result = await Promise.race([
      prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 as result`,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Timeout")), TIMEOUT_MS);
      }),
    ]);

    if (result && result[0]?.result === 1) {
      return NextResponse.json(
        { ready: true, timestamp: new Date().toISOString() },
        { status: 200 }
      );
    }

    // SELECT 1 retornou algo inesperado.
    console.error("[api/ready] resposta inesperada do SELECT 1:", result);
    return NextResponse.json({ ready: false }, { status: 503 });
  } catch (error) {
    // Banco inacessível, Prisma engine quebrado, ou timeout.
    console.error("[api/ready] banco/Prisma indisponível:", error);
    return NextResponse.json({ ready: false }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}

// HEAD também funciona (wget --spider usa HEAD).
export const HEAD = GET;
