import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), findMany: vi.fn(), componente: vi.fn() }));

vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/lib/prisma", () => ({ prisma: { matricula: { findMany: mocks.findMany } } }));
vi.mock("./CondicoesEncerramento", () => ({ CondicoesEncerramento: (props: unknown) => {
  mocks.componente(props);
  return null;
} }));

import { Papel } from "@prisma/client";
import { CondicoesEncerramentoLista } from "./CondicoesEncerramentoLista";

describe("lista de condições de encerramento", () => {
  it("entrega ao formulário somente originais enviados da matrícula ainda em preparação", async () => {
    mocks.findMany.mockResolvedValue([{ id: "matricula-1", codigo: "MAT-246", status: "AGUARDANDO", ativadaEm: null, contratoOk: false, confirmacaoContratoEm: null, contratoDocumentoId: null,
      processosAssinatura: [{ id: "processo-1", artefatoId: "artefato-1" }], cobrancas: [{ id: "cobranca-1", codigo: "MEN-001", tipo: "MENSALIDADE" }], condicoesEncerramento: [],
    }]);

    renderToStaticMarkup(await CondicoesEncerramentoLista({ ids: ["matricula-1"], autorId: "secretaria-1", administrador: false }));

    expect(mocks.sessao).toHaveBeenCalledWith(Papel.SECRETARIA_ACADEMICA);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        processosAssinatura: expect.objectContaining({ where: { estado: "ENVIADO", referenciaExterna: { not: null }, conclusao: null } }),
      }),
    }));
    expect(mocks.componente).toHaveBeenCalledWith(expect.objectContaining({
      documentoId: null,
      cobrancas: [{ id: "cobranca-1", codigo: "MEN-001", tipo: "MENSALIDADE" }],
      fontesOriginaisEnviados: [{ processoAssinaturaId: "processo-1", artefatoContratualId: "artefato-1" }],
    }));
  });

  it("não entrega origem enviada para matrícula ativada", async () => {
    mocks.findMany.mockResolvedValue([{ id: "matricula-2", codigo: "MAT-247", status: "ATIVA", ativadaEm: new Date(), contratoOk: false, confirmacaoContratoEm: null, contratoDocumentoId: null,
      processosAssinatura: [{ id: "processo-2", artefatoId: "artefato-2" }], cobrancas: [], condicoesEncerramento: [],
    }]);

    renderToStaticMarkup(await CondicoesEncerramentoLista({ ids: ["matricula-2"], autorId: "secretaria-1", administrador: false }));

    expect(mocks.componente).toHaveBeenLastCalledWith(expect.objectContaining({ fontesOriginaisEnviados: [] }));
  });
});
