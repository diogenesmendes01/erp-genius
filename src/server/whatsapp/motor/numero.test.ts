import { beforeEach, describe, expect, it, vi } from "vitest";

const { chamar } = vi.hoisted(() => ({ chamar: vi.fn() }));
vi.mock("./cliente", async (orig) => ({ ...(await orig<typeof import("./cliente")>()), chamarMotor: chamar }));

import { ErroMotorParcial, clienteMotorNumero } from "./numero";

beforeEach(() => chamar.mockReset().mockResolvedValue({ resultado: { ok: true } }));
const corpos = () => chamar.mock.calls.map((c) => c[1].json);

describe("clienteMotorNumero", () => {
  it("perfil: profile.update e profile.picture", async () => {
    await clienteMotorNumero.atualizarPerfil("ref 1", { nome: "Escola", recado: "Oi", fotoDataUri: "data:image/png;base64,AA==" });
    expect(chamar.mock.calls[0][0]).toBe("/v1/numeros/ref%201/acoes");
    expect(corpos()).toEqual([
      { acao: "profile.picture", payload: { image: "data:image/png;base64,AA==" } },
      { acao: "profile.update", payload: { name: "Escola", about: "Oi" } },
    ]);
  });
  it("perfil: foto recusada não aplica nome nem recado", async () => {
    chamar.mockRejectedValueOnce(new Error("413"));
    await expect(clienteMotorNumero.atualizarPerfil("r", { nome: "Escola", fotoDataUri: "data:image/png;base64,AA==" })).rejects.toThrow("413");
    expect(chamar).toHaveBeenCalledTimes(1);
  });
  it("perfil: foto aplicada e textos recusados → ErroMotorParcial com a foto", async () => {
    chamar.mockResolvedValueOnce({ resultado: { ok: true } }).mockRejectedValueOnce(new Error("500"));
    const e = await clienteMotorNumero.atualizarPerfil("r", { nome: "Escola", fotoDataUri: "data:image/png;base64,AA==" }).catch((x) => x);
    expect(e).toBeInstanceOf(ErroMotorParcial);
    expect(e.aplicado).toEqual({ foto: true });
  });
  it("privacidade: falha no meio → ErroMotorParcial com o que já foi aplicado", async () => {
    chamar.mockResolvedValueOnce({ resultado: { ok: true } }).mockRejectedValueOnce(new Error("500"));
    const e = await clienteMotorNumero.atualizarPrivacidade("r", { vistoPorUltimo: "NINGUEM", foto: "CONTATOS" }).catch((x) => x);
    expect(e).toBeInstanceOf(ErroMotorParcial);
    expect(e.aplicado).toEqual({ privacidade: { vistoPorUltimo: "NINGUEM" } });
  });
  it("privacidade: mapeia só o que mudou", async () => {
    await clienteMotorNumero.atualizarPrivacidade("r", { vistoPorUltimo: "NINGUEM", foto: "CONTATOS", grupos: "TODOS" });
    expect(corpos()).toEqual([
      { acao: "privacy.update", payload: { setting: "lastSeen", value: "none" } },
      { acao: "privacy.update", payload: { setting: "profilePicture", value: "contacts" } },
      { acao: "privacy.update", payload: { setting: "groupsAdd", value: "all" } },
    ]);
  });
  it("grupos não aceita NINGUEM", async () => {
    await expect(clienteMotorNumero.atualizarPrivacidade("r", { grupos: "NINGUEM" })).rejects.toThrow();
    expect(chamar).not.toHaveBeenCalled();
  });
  it("temporárias: defaultDisappearing", async () => {
    await clienteMotorNumero.definirTemporarias("r", 604800);
    expect(corpos()).toEqual([{ acao: "privacy.update", payload: { setting: "defaultDisappearing", value: 604800 } }]);
  });
});
