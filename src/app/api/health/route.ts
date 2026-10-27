import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMA_SHA = /^[0-9a-f]{7,40}$/;

function shaDoBuild(valor: string | undefined = process.env.GIT_SHA): string {
  const sha = (valor ?? "").trim().toLowerCase();
  return FORMA_SHA.test(sha) ? sha : "desconhecido";
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, sha: shaDoBuild(), timestamp: new Date().toISOString() }, { status: 200 });
}

export const HEAD = GET;
