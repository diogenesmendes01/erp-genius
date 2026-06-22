import { describe, it, expect, vi, beforeEach } from "vitest";
import { Papel } from "@prisma/client";

// Mock do client Prisma — testamos a regra de escopo sem DB real.
const cobrancaFindFirst = vi.fn();
const documentoFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cobranca: { findFirst: (...a: unknown[]) => cobrancaFindFirst(...a) },
    documento: { findFirst: (...a: unknown[]) => documentoFindFirst(...a) },
  },
}));

import { podeLerArquivo, urlCanonica } from "./autorizacao";

const segmentos = ["123-comprovante.pdf"];
const url = "/api/files/123-comprovante.pdf";

beforeEach(() => {
  cobrancaFindFirst.mockReset();
  documentoFindFirst.mockReset();
  cobrancaFindFirst.mockResolvedValue(null);
  documentoFindFirst.mockResolvedValue(null);
});

describe("urlCanonica", () => {
  it("reconstrói a URL gravada nos agregados", () => {
    expect(urlCanonica(segmentos)).toBe(url);
  });
});

describe("podeLerArquivo — comprovante financeiro (Cobranca)", () => {
  beforeEach(() => {
    cobrancaFindFirst.mockResolvedValue({ id: "c1" });
  });

  it("autoriza FINANCEIRO", async () => {
    const ok = await podeLerArquivo({ id: "u1", papeis: [Papel.FINANCEIRO] }, segmentos);
    expect(ok).toBe(true);
  });

  it("autoriza ADMINISTRADOR", async () => {
    const ok = await podeLerArquivo({ id: "u1", papeis: [Papel.ADMINISTRADOR] }, segmentos);
    expect(ok).toBe(true);
  });

  it("nega VENDEDOR (autenticado, sem escopo financeiro) -> 403", async () => {
    const ok = await podeLerArquivo({ id: "u1", papeis: [Papel.VENDEDOR] }, segmentos);
    expect(ok).toBe(false);
  });

  it("nega PROFESSOR", async () => {
    const ok = await podeLerArquivo({ id: "u1", papeis: [Papel.PROFESSOR] }, segmentos);
    expect(ok).toBe(false);
  });
});

describe("podeLerArquivo — documento do Lead (escopo do vendedor)", () => {
  beforeEach(() => {
    documentoFindFirst.mockResolvedValue({ lead: { vendedorDonoId: "dono" } });
  });

  it("autoriza o vendedor dono do lead", async () => {
    const ok = await podeLerArquivo({ id: "dono", papeis: [Papel.VENDEDOR] }, segmentos);
    expect(ok).toBe(true);
  });

  it("nega vendedor de OUTRO lead -> 403", async () => {
    const ok = await podeLerArquivo({ id: "outro", papeis: [Papel.VENDEDOR] }, segmentos);
    expect(ok).toBe(false);
  });

  it("autoriza GERENTE_COMERCIAL (visibilidade ampla)", async () => {
    const ok = await podeLerArquivo({ id: "x", papeis: [Papel.GERENTE_COMERCIAL] }, segmentos);
    expect(ok).toBe(true);
  });

  it("autoriza ADMINISTRADOR", async () => {
    const ok = await podeLerArquivo({ id: "x", papeis: [Papel.ADMINISTRADOR] }, segmentos);
    expect(ok).toBe(true);
  });

  it("nega FINANCEIRO para documento de lead (não é comprovante)", async () => {
    const ok = await podeLerArquivo({ id: "x", papeis: [Papel.FINANCEIRO] }, segmentos);
    expect(ok).toBe(false);
  });
});

describe("podeLerArquivo — arquivo órfão", () => {
  it("nega quando nenhum agregado referencia a URL", async () => {
    const ok = await podeLerArquivo({ id: "u1", papeis: [Papel.ADMINISTRADOR] }, segmentos);
    expect(ok).toBe(false);
    expect(cobrancaFindFirst).toHaveBeenCalled();
    expect(documentoFindFirst).toHaveBeenCalled();
  });
});
