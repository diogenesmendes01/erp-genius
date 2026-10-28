import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriverWhatsApp, Papel, SessaoNumero } from "@prisma/client";

const findMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { numeroWhatsApp: { findMany } } }));

import { opcoesFiltroInbox, saudeDoNumero, vendedorSemWhatsAppConectado } from "./opcoes-filtro";
import { whereNumeroServeSetor } from "@/server/whatsapp/numero-setor";

describe("saúde pública do número", () => {
  for (const driver of Object.values(DriverWhatsApp)) {
    for (const sessao of Object.values(SessaoNumero)) {
      it(`${driver}/${sessao}: inativo é desconectado`, () => {
        expect(saudeDoNumero({ driver, sessao, ativo: false })).toBe("desconectado");
      });
      it(`${driver}/${sessao}: ativo segue o domínio do canal`, () => {
        const esperada = driver === DriverWhatsApp.META_CLOUD || sessao === SessaoNumero.CONECTADO
          ? "conectado" : sessao === SessaoNumero.DESCONECTADO ? "desconectado" : "instavel";
        expect(saudeDoNumero({ driver, sessao, ativo: true })).toBe(esperada);
      });
    }
  }
});

const PAPEIS_GESTORES = [
  Papel.ADMINISTRADOR,
  Papel.GERENTE_COMERCIAL,
  Papel.FINANCEIRO,
  Papel.SECRETARIA_ACADEMICA,
  Papel.GERENTE_PEDAGOGICO,
] as const;

describe("vendedorSemWhatsAppConectado", () => {
  it("vendedor sem número próprio está bloqueado", () => {
    expect(vendedorSemWhatsAppConectado([Papel.VENDEDOR], [])).toBe(true);
  });

  it.each(["desconectado", "instavel"] as const)("vendedor só com número %s está bloqueado", (saude) => {
    expect(vendedorSemWhatsAppConectado([Papel.VENDEDOR], [{ saude }])).toBe(true);
  });

  it("vendedor com ao menos um número conectado segue liberado", () => {
    expect(vendedorSemWhatsAppConectado([Papel.VENDEDOR], [{ saude: "desconectado" }, { saude: "conectado" }])).toBe(false);
  });

  it.each(PAPEIS_GESTORES)("perfil %s não é bloqueado mesmo sem conectados", (papel) => {
    expect(vendedorSemWhatsAppConectado([papel], [])).toBe(false);
    expect(vendedorSemWhatsAppConectado([Papel.VENDEDOR, papel], [{ saude: "desconectado" }])).toBe(false);
  });
});

describe("opcoesFiltroInbox do vendedor", () => {
  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([]);
  });

  it("consulta somente números cujo donoId é o vendedor", async () => {
    await opcoesFiltroInbox({ id: "joao", papeis: [Papel.VENDEDOR] });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ donoId: "joao" }] } }));
    expect(findMany.mock.calls[0][0].where).not.toEqual({ OR: [whereNumeroServeSetor("COMERCIAL")] });
  });

  it("sem id não casa número de outro dono", async () => {
    await opcoesFiltroInbox({ papeis: [Papel.VENDEDOR] });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ donoId: "__sem_dono__" }] } }));
  });

  it("não devolve cobrança nem número de outro dono", async () => {
    findMany.mockImplementation(async ({ where }: { where: { OR?: { donoId?: string }[] } }) => {
      const dono = where.OR?.find((ramo) => typeof ramo.donoId === "string")?.donoId;
      const linhas = [
        { id: "cob", rotulo: "Cobranças Mendes", driver: DriverWhatsApp.BAILEYS, sessao: SessaoNumero.DESCONECTADO, ativo: true, donoId: "outro" },
        { id: "alheio", rotulo: "Vendas Outro", driver: DriverWhatsApp.BAILEYS, sessao: SessaoNumero.CONECTADO, ativo: true, donoId: "outro" },
        { id: "meu", rotulo: "Vendas João", driver: DriverWhatsApp.MOTOR, sessao: SessaoNumero.CONECTADO, ativo: true, donoId: "joao" },
      ];
      return linhas.filter((n) => n.donoId === dono);
    });
    const resultado = await opcoesFiltroInbox({ id: "joao", papeis: [Papel.VENDEDOR] });
    expect(resultado.setores).toEqual(["COMERCIAL"]);
    expect(resultado.numeros).toEqual([{ id: "meu", rotulo: "Vendas João", saude: "conectado" }]);
  });

  it("gerente comercial continua pelo setor e administrador vê todos", async () => {
    await opcoesFiltroInbox({ id: "g", papeis: [Papel.GERENTE_COMERCIAL] });
    expect(findMany.mock.calls[0][0].where).toEqual({ OR: [whereNumeroServeSetor("COMERCIAL")] });
    findMany.mockClear();
    await opcoesFiltroInbox({ id: "a", papeis: [Papel.ADMINISTRADOR] });
    expect(findMany.mock.calls[0][0].where).toEqual({});
  });
});
