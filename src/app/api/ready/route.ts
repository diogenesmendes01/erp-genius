import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// READINESS do container (healthcheck do Coolify / Docker): valida conectividade com o banco
// e que o Prisma Client está funcional (engine correto carregado).
// Retorna 503 se o banco está inacessível ou o Prisma falha.
// Sem segredo, sem auth, sem lógica de negócio — só a saúde técnica do runtime.

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    // Timeout curto: readiness check não deve travar o healthcheck do orchestrator.
    const result = await Promise.race([
      prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 as result`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 3000)
      ),
    ]);

    if (result && result[0]?.result === 1) {
      return NextResponse.json(
        { ready: true, timestamp: new Date().toISOString() },
        { status: 200 }
      );
    }

    // SELECT 1 retornou algo inesperado.
    return NextResponse.json(
      { ready: false, error: "Unexpected DB response" },
      { status: 503 }
    );
  } catch (error) {
    // Banco inacessível, Prisma engine quebrado, ou timeout.
    return NextResponse.json(
      {
        ready: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}

// HEAD também funciona (wget --spider usa HEAD).
export const HEAD = GET;
