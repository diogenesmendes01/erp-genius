import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared";
import type { AvisoInbox } from "./barramento";

// Caminho de permissão do aviso direcionado (`paraUsuarioId`, revogação de convite) sem banco: o Prisma e o
// escopo são mockados e respondem "fora do escopo", então só o ramo direcionado pode deixar o aviso passar.

const m = vi.hoisted(() => ({ atendimento: vi.fn(), conversa: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { atendimentoWhatsApp: { findFirst: m.atendimento }, conversaWhatsApp: { findFirst: m.conversa } },
}));
vi.mock("@/server/whatsapp/escopo", () => ({ escopoAtendimentos: async () => ({}), escopoGrupos: async () => ({}) }));

const { criarFiltroDeAvisos, formatarSSE } = await import("./eventos-sse");

const destinatario: UsuarioSessao = { id: "u-dest", nome: "Ex-convidado", papeis: [Papel.VENDEDOR] };
const outro: UsuarioSessao = { id: "u-outro", nome: "Outro", papeis: [Papel.VENDEDOR] };

const direcionado: AvisoInbox = {
  tipo: "atendimento.atualizado",
  atendimentoId: "at-1",
  mensagemId: null,
  conversaId: "cv-1",
  paraUsuarioId: "u-dest",
};

beforeEach(() => {
  m.atendimento.mockReset().mockResolvedValue(null);
  m.conversa.mockReset().mockResolvedValue(null);
});

describe("criarFiltroDeAvisos: aviso direcionado", () => {
  it("destinatario_recebe_sem_consultar_escopo", async () => {
    expect(await criarFiltroDeAvisos(destinatario)(direcionado)).toBe(true);
    expect(m.atendimento).not.toHaveBeenCalled();
    expect(m.conversa).not.toHaveBeenCalled();
  });

  it("outro_usuario_nao_recebe", async () => {
    expect(await criarFiltroDeAvisos(outro)(direcionado)).toBe(false);
    expect(m.atendimento).not.toHaveBeenCalled();
  });

  it("outro_usuario_nao_recebe_mesmo_com_o_atendimento_no_escopo", async () => {
    m.atendimento.mockResolvedValue({ id: "at-1" });
    expect(await criarFiltroDeAvisos(outro)(direcionado)).toBe(false);
  });

  it.each(["mensagem.nova", "mensagem.status"] as const)("tipo_%s_com_paraUsuarioId_e_barrado", async (tipo) => {
    m.atendimento.mockResolvedValue({ id: "at-1" });
    expect(await criarFiltroDeAvisos(destinatario)({ ...direcionado, tipo, mensagemId: "msg-1" })).toBe(false);
    expect(m.atendimento).not.toHaveBeenCalled();
  });

  it("sem_paraUsuarioId_fora_do_escopo_e_barrado", async () => {
    const { paraUsuarioId: _p, ...comum } = direcionado;
    void _p;
    expect(await criarFiltroDeAvisos(destinatario)(comum)).toBe(false);
    expect(m.atendimento).toHaveBeenCalledTimes(1);
  });
});

describe("formatarSSE", () => {
  it("nao_emite_paraUsuarioId_no_quadro", () => {
    const quadro = formatarSSE(direcionado);
    expect(quadro).not.toContain("paraUsuarioId");
    expect(quadro).not.toContain("u-dest");
    const [evento, dados] = quadro.split("\n");
    expect(evento).toBe("event: atendimento.atualizado");
    expect(JSON.parse(dados!.replace(/^data: /, ""))).toEqual({
      tipo: "atendimento.atualizado",
      atendimentoId: "at-1",
      mensagemId: null,
      conversaId: "cv-1",
    });
    expect(quadro.endsWith("\n\n")).toBe(true);
  });
});

it("IDs públicos podem conter o trecho do destinatário sem vazá-lo", () => {
  const publico = { tipo: "atendimento.atualizado" as const, atendimentoId: "atendimento-u9", conversaId: "conversa-u9", mensagemId: null };
  const quadro = formatarSSE({ ...publico, paraUsuarioId: "u9" });
  const linhas = quadro.split("\n");
  expect(linhas).toHaveLength(4);
  expect(linhas[0]).toBe("event: atendimento.atualizado");
  expect(linhas[1]).toMatch(/^data: /);
  expect(linhas.slice(2)).toEqual(["", ""]);
  const dados = JSON.parse(linhas[1].slice("data: ".length));
  expect(dados).toEqual(publico);
  expect(dados).not.toHaveProperty("paraUsuarioId");
});
