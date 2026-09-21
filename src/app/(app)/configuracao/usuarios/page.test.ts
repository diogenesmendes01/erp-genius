import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guarda: vi.fn(), usuarios: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/lib/guards", () => ({ exigirPapelLeitura: mocks.guarda }));
vi.mock("@/server/acesso/consultas", () => ({ listarUsuarios: mocks.usuarios }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/components/AcessoNegado", () => ({ AcessoNegado: () => "negado" }));
vi.mock("./UsuariosPainel", () => ({ UsuariosPainel: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao: string | null }) => `fuso:${preferenciaFusoExibicao}` }));

import Page from "./page";

it("guarda usuários antes das consultas e encaminha fallback da preferência", async () => {
  mocks.guarda.mockResolvedValueOnce(null);
  expect(renderToStaticMarkup(await Page())).toContain("negado");
  expect(mocks.usuarios).not.toHaveBeenCalled();
  expect(mocks.preferencia).not.toHaveBeenCalled();

  mocks.guarda.mockResolvedValue(["ADMINISTRADOR"]);
  mocks.usuarios.mockResolvedValue([]);
  mocks.preferencia.mockResolvedValue({ ok: false });
  expect(renderToStaticMarkup(await Page())).toContain("fuso:null");
});