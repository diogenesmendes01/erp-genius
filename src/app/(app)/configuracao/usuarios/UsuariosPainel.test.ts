import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/acesso/acoes", () => ({ alternarUsuarioAtivo: vi.fn() }));

import { UsuariosPainel } from "./UsuariosPainel";

const usuarios = [{ id: "u", nome: "Ana", email: "ana@example.test", papeis: [Papel.ADMINISTRADOR], ativo: true, limiteDescontoPct: null, limiteDescontoTaxaPct: null, limiteDescontoMensalidadePct: null, permissoes: [], gerenteComercialId: null, ultimoAcesso: "2026-01-01T02:30:00.000Z" }];

it("exibe último acesso no fuso pessoal e usa UTC quando não há preferência", () => {
  const preferido = renderToStaticMarkup(createElement(UsuariosPainel, { usuarios, preferenciaFusoExibicao: "America/Costa_Rica" }));
  const fallback = renderToStaticMarkup(createElement(UsuariosPainel, { usuarios, preferenciaFusoExibicao: null }));

  expect(preferido).toContain("31/12/2025, 20:30 (horário exibido em America/Costa_Rica; origem UTC)");
  expect(fallback).toContain("01/01/2026, 02:30 (horário exibido em UTC; origem UTC)");
  expect(preferido).toContain("Ana");
  expect(preferido).toContain("Ativo");
});