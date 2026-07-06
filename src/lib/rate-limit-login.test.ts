import { describe, it, expect } from "vitest";
import {
  loginBloqueado,
  registrarFalhaLogin,
  limparFalhasLogin,
  MAX_FALHAS,
  JANELA_FALHAS_MS,
} from "./rate-limit-login";

const T0 = 1_750_000_000_000; // relógio injetado — determinístico

describe("rate-limit do login", () => {
  it("bloqueia após MAX_FALHAS na janela e trata e-mails separadamente", () => {
    const email = "a@genius.com";
    limparFalhasLogin(email);
    for (let i = 0; i < MAX_FALHAS; i++) {
      expect(loginBloqueado(email, T0 + i)).toBe(false); // ainda não travou
      registrarFalhaLogin(email, T0 + i);
    }
    expect(loginBloqueado(email, T0 + MAX_FALHAS)).toBe(true);
    expect(loginBloqueado("outro@genius.com", T0 + MAX_FALHAS)).toBe(false);
  });

  it("desbloqueia quando as falhas saem da janela deslizante", () => {
    const email = "b@genius.com";
    limparFalhasLogin(email);
    for (let i = 0; i < MAX_FALHAS; i++) registrarFalhaLogin(email, T0);
    expect(loginBloqueado(email, T0 + JANELA_FALHAS_MS - 1)).toBe(true);
    expect(loginBloqueado(email, T0 + JANELA_FALHAS_MS)).toBe(false);
  });

  it("login bem-sucedido zera o contador", () => {
    const email = "c@genius.com";
    for (let i = 0; i < MAX_FALHAS; i++) registrarFalhaLogin(email, T0);
    expect(loginBloqueado(email, T0 + 1)).toBe(true);
    limparFalhasLogin(email);
    expect(loginBloqueado(email, T0 + 2)).toBe(false);
  });
});
