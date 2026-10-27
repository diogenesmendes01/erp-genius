import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const TIMEOUT_MS = 3000;

export async function GET(): Promise<NextResponse> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
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

    console.error("[api/ready] resposta inesperada do SELECT 1:", result);
    return NextResponse.json({ ready: false }, { status: 503 });
  } catch (error) {
    console.error("[api/ready] banco/Prisma indisponível:", error);
    return NextResponse.json({ ready: false }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}

export const HEAD = GET;
