import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import {
  PROCESSADORES,
  drenarEventosMotor,
  registrarEventoMotor,
  MAX_TENTATIVAS_EVENTO,
  RETENCAO_EVENTO_MS,
} from "./receber";
import type { EnvelopeMotor } from "./eventos";

let n = 0;
function env(tipo: string, dados: unknown = {}): EnvelopeMotor {
  n += 1;
  const idEvento = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  return { idEvento, tipo, numeroId: "num1", ocorridoEm: Date.now(), dados };
}

const tiposTeste = ["t.a", "t.b", "t.c"];
afterEach(() => {
  for (const t of tiposTeste) delete PROCESSADORES[t];
});
beforeEach(async () => {
  await truncarBanco();
});

describe("drenarEventosMotor", () => {
  it("processa em ordem de seq", async () => {
    const ordem: string[] = [];
    PROCESSADORES["t.a"] = async (e) => {
      ordem.push((e.dados as { k: string }).k);
      return "ok";
    };
    for (const k of ["e1", "e2", "e3"]) await registrarEventoMotor(env("t.a", { k }));
    const r = await drenarEventosMotor();
    expect(ordem).toEqual(["e1", "e2", "e3"]);
    expect(r.processados).toBe(3);
    expect(await prisma.eventoMotorRecebido.count({ where: { processadoEm: null } })).toBe(0);
  });

  it("tipo desconhecido vira ignorado", async () => {
    await registrarEventoMotor(env("t.zzz"));
    const r = await drenarEventosMotor();
    expect(r.descartados).toBe(1);
    const ev = await prisma.eventoMotorRecebido.findFirstOrThrow();
    expect(ev.processadoEm).not.toBeNull();
    expect(ev.resultado).toBe("ignorado:tipo_desconhecido");
  });

  it("{adiar} incrementa tentativas e agenda backoff; evento seguinte de outro tipo segue", async () => {
    PROCESSADORES["t.a"] = async () => ({ adiar: "ainda_nao" });
    PROCESSADORES["t.b"] = async () => "ok";
    await registrarEventoMotor(env("t.a"));
    await registrarEventoMotor(env("t.b"));
    const agora = new Date("2026-01-01T00:00:00Z");
    const r = await drenarEventosMotor(agora);
    expect(r).toMatchObject({ processados: 1, adiados: 1 });
    const a = await prisma.eventoMotorRecebido.findFirstOrThrow({ where: { tipo: "t.a" } });
    expect(a.tentativas).toBe(1);
    expect(a.processadoEm).toBeNull();
    expect(a.proximaTentativaEm!.getTime()).toBe(agora.getTime() + 5_000);
    // antes do backoff: não reprocessa
    const r2 = await drenarEventosMotor(new Date(agora.getTime() + 1_000));
    expect(r2.adiados).toBe(0);
    // depois do backoff: tenta de novo
    const r3 = await drenarEventosMotor(new Date(agora.getTime() + 6_000));
    expect(r3.adiados).toBe(1);
    const a2 = await prisma.eventoMotorRecebido.findFirstOrThrow({ where: { tipo: "t.a" } });
    expect(a2.tentativas).toBe(2);
  });

  it("após 12 tentativas marca processado com resultado 'desistiu:<motivo>'", async () => {
    PROCESSADORES["t.a"] = async () => ({ adiar: "sem_conversa" });
    await registrarEventoMotor(env("t.a"));
    await prisma.eventoMotorRecebido.updateMany({ data: { tentativas: MAX_TENTATIVAS_EVENTO - 1 } });
    const r = await drenarEventosMotor();
    expect(r.descartados).toBe(1);
    const ev = await prisma.eventoMotorRecebido.findFirstOrThrow();
    expect(ev.processadoEm).not.toBeNull();
    expect(ev.resultado).toBe("desistiu:sem_conversa");
    expect(ev.tentativas).toBe(MAX_TENTATIVAS_EVENTO);
  });

  it("dois drenos concorrentes: um sai sem processar (advisory lock)", async () => {
    let chamadas = 0;
    PROCESSADORES["t.a"] = async () => {
      chamadas += 1;
      await new Promise((r) => setTimeout(r, 150));
      return "ok";
    };
    for (let i = 0; i < 3; i++) await registrarEventoMotor(env("t.a"));
    const [a, b] = await Promise.all([drenarEventosMotor(), drenarEventosMotor()]);
    expect(a.processados + b.processados).toBe(3);
    expect(chamadas).toBe(3);
  });

  it("apaga eventos processados há mais de 7 dias", async () => {
    const agora = new Date();
    const velho = new Date(agora.getTime() - RETENCAO_EVENTO_MS - 1000);
    const base = { tipo: "t.x", numeroRef: "n", ocorridoEm: agora, dados: {} };
    await prisma.eventoMotorRecebido.create({ data: { ...base, idEvento: "velho", recebidoEm: velho, processadoEm: velho, resultado: "ok" } });
    await prisma.eventoMotorRecebido.create({ data: { ...base, idEvento: "novo", processadoEm: agora, resultado: "ok" } });
    await drenarEventosMotor(agora);
    const ids = (await prisma.eventoMotorRecebido.findMany()).map((e) => e.idEvento).sort();
    expect(ids).toEqual(["novo"]);
  });

  it("exceção no processador vira {adiar: mensagem} e não derruba o lote", async () => {
    PROCESSADORES["t.a"] = async () => {
      throw new Error("boom");
    };
    PROCESSADORES["t.b"] = async () => "ok";
    await registrarEventoMotor(env("t.a"));
    await registrarEventoMotor(env("t.b"));
    const r = await drenarEventosMotor();
    expect(r).toMatchObject({ processados: 1, adiados: 1 });
  });
});
