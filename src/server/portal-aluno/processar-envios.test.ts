import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ envios: vi.fn(), despacho: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { solicitacaoEnvioPortalAluno: { findMany: m.envios } } }));
vi.mock("./envio-resend", () => ({ despacharAcessoPortalResend: m.despacho }));

import { ErroRegra } from "@/server/_shared";
import { processarEnviosPortalAluno } from "./processar-envios";

const ambiente = { EMAIL_PORTAL_ENVIO_ENABLED: "true" };

beforeEach(() => {
  vi.resetAllMocks();
  m.despacho.mockResolvedValue({ situacao: "ENVIADO" });
});

describe("processarEnviosPortalAluno", () => {
  it("não consulta nem faz claim quando o envio institucional está desligado", async () => {
    await expect(processarEnviosPortalAluno({}, { ambiente: { EMAIL_PORTAL_ENVIO_ENABLED: "false" } })).resolves.toEqual({
      habilitado: false, processados: 0, aceitosPeloProvedor: 0, incertos: 0, pendencias: 0, proximoCursor: null,
    });
    expect(m.envios).not.toHaveBeenCalled();
    expect(m.despacho).not.toHaveBeenCalled();
  });

  it("pagina PREPARADO por id e despacha serialmente sem expor dados de mensagem", async () => {
    m.envios.mockResolvedValue(Array.from({ length: 21 }, (_, indice) => ({ id: String(indice).padStart(2, "0") })));
    const ordem: string[] = [];
    let emAndamento = 0;
    m.despacho.mockImplementation(async (id: string) => {
      emAndamento += 1;
      expect(emAndamento).toBe(1);
      ordem.push(id);
      emAndamento -= 1;
      return id === "01" ? { situacao: "INCERTO" } : { situacao: "ENVIADO" };
    });

    const resultado = await processarEnviosPortalAluno({ cursor: "anterior" }, { ambiente });

    expect(m.envios).toHaveBeenCalledWith({
      where: { situacao: "PREPARADO", id: { gt: "anterior" } }, orderBy: { id: "asc" }, take: 21, select: { id: true },
    });
    expect(ordem).toEqual(Array.from({ length: 20 }, (_, indice) => String(indice).padStart(2, "0")));
    expect(resultado).toEqual({ habilitado: true, processados: 20, aceitosPeloProvedor: 19, incertos: 1, pendencias: 0, proximoCursor: "19" });
    expect(JSON.stringify(resultado)).not.toMatch(/destinat|token|link|recibo|provedorId/i);
  });

  it("conta regra do item como pendência e continua os demais", async () => {
    m.envios.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    m.despacho.mockRejectedValueOnce(new ErroRegra("Conta mudou."))
      .mockResolvedValueOnce({ situacao: "ENVIADO" });

    await expect(processarEnviosPortalAluno({}, { ambiente })).resolves.toEqual({
      habilitado: true, processados: 1, aceitosPeloProvedor: 1, incertos: 0, pendencias: 1, proximoCursor: null,
    });
    expect(m.despacho).toHaveBeenNthCalledWith(1, "a", { ambiente });
    expect(m.despacho).toHaveBeenNthCalledWith(2, "b", { ambiente });
  });

  it("propaga falha de configuração ou infraestrutura e não mascara a execução", async () => {
    m.envios.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    m.despacho.mockRejectedValueOnce(new Error("configuração ausente"));

    await expect(processarEnviosPortalAluno({}, { ambiente })).rejects.toThrow("configuração ausente");
    expect(m.despacho).toHaveBeenCalledTimes(1);
  });
});
