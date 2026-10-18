import { DriverWhatsApp } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { Papel } from "@prisma/client";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { ErroRegra } from "@/server/_shared";
import { gravarMensagemGrupo, contatoIndividual } from "./grupos";
import { listarTriagemWhatsApp } from "./operacoes-atendimento";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const u = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!u?.ativo) throw new original.ErroAutenticacao();
    return u;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const u = await sessao(); original.exigirPapel(u, ...papeis); return u;
  } };
});

beforeEach(async () => { await truncarBanco(); });

async function cenario() {
  const { numero } = await seedCanal({ driver: DriverWhatsApp.BAILEYS, estado: "ATIVA" });
  const dadosGrupo = { numeroId: numero.id, grupoJid: "120363000000000001@g.us", nomeGrupo: "Turma A",
    participanteJid: "50688887777@s.whatsapp.net", participanteE164: "+50688887777" as string | null, participanteNome: null as string | null,
    providerMessageId: "g-1", tipo: "TEXTO" as const, corpo: "Bom dia, pessoal", quando: new Date("2026-10-16T12:00:00Z"), driver: DriverWhatsApp.BAILEYS };
  return { numero, dadosGrupo };
}

describe("grupos no modelo (E3.5)", () => {
  it("conversa tem contato XOR grupo", async () => {
    const { numero } = await cenario();
    await expect(prisma.conversaWhatsApp.create({ data: { numeroId: numero.id } })).rejects.toThrow(/Conversa_contato_xor_grupo/);
  });

  it("atendimento em conversa de grupo é recusado pelo banco", async () => {
    const { dadosGrupo } = await cenario();
    const r = await prisma.$transaction((tx) => gravarMensagemGrupo(tx, dadosGrupo));
    await expect(prisma.atendimentoWhatsApp.create({ data: { conversaId: r.conversaId, contextoChave: "x", finalidade: "PEDAGOGICO" } }))
      .rejects.toThrow(/Conversa de grupo não abre atendimento/);
  });

  it("mensagem de grupo: grava participante, não abre atendimento, não cancela automação nem soma não lidas", async () => {
    const { numero, dadosGrupo } = await cenario();
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887777" } });
    const intencaoCron = await prisma.intencaoMensagem.create({ data: { numeroId: numero.id, contatoId: contato.id, origem: "CRON", corpoRenderizado: "lembrete" } });
    const r = await prisma.$transaction((tx) => gravarMensagemGrupo(tx, { ...dadosGrupo, participanteNome: "Ana" }));
    const m = await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: r.mensagemId } });
    expect(m).toMatchObject({ atendimentoId: null, participanteNome: "Ana", participanteJid: dadosGrupo.participanteJid, participanteE164: "+50688887777", direcao: "ENTRADA" });
    expect(await prisma.atendimentoWhatsApp.count()).toBe(0);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencaoCron.id } })).status).toBe("PENDENTE");
    const conversa = await prisma.conversaWhatsApp.findUniqueOrThrow({ where: { id: r.conversaId } });
    expect(conversa).toMatchObject({ contatoId: null, naoLidas: 0 });
    expect(conversa.grupoId).not.toBeNull();
  });

  it("segunda mensagem reaproveita grupo e conversa; nome do grupo é atualizado", async () => {
    const { dadosGrupo } = await cenario();
    const a = await prisma.$transaction((tx) => gravarMensagemGrupo(tx, dadosGrupo));
    await prisma.conversaWhatsApp.update({ where: { id: a.conversaId }, data: { naoLidas: 3 } });
    const b = await prisma.$transaction((tx) => gravarMensagemGrupo(tx, { ...dadosGrupo, providerMessageId: "g-2", nomeGrupo: "Turma A 2026" }));
    expect((await prisma.conversaWhatsApp.findUniqueOrThrow({ where: { id: a.conversaId } })).naoLidas).toBe(3);
    expect(b.conversaId).toBe(a.conversaId);
    expect(await prisma.grupoWhatsApp.count()).toBe(1);
    expect((await prisma.grupoWhatsApp.findFirstOrThrow()).nome).toBe("Turma A 2026");
  });

  it("triagem não lista mensagem de grupo", async () => {
    const { dadosGrupo } = await cenario();
    const r = await prisma.$transaction((tx) => gravarMensagemGrupo(tx, dadosGrupo));
    const adm = await criarUsuario([Papel.ADMINISTRADOR]);
    authMock.mockResolvedValue({ user: { id: adm.id } });
    expect((await listarTriagemWhatsApp()).map((t) => t.id)).not.toContain(r.mensagemId);
  });

  it("contatoIndividual devolve o contato ou lança ErroRegra em grupo", () => {
    const contato = { id: "c" } as never;
    expect(contatoIndividual({ contato })).toBe(contato);
    expect(() => contatoIndividual({ contato: null })).toThrow(new ErroRegra("Conversa de grupo não tem contato individual."));
  });
});
