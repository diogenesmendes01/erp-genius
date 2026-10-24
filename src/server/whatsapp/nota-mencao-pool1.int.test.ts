import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
// Somente o client deste arquivo tem pool1; a URL do perfil/listener continua intacta.
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { protegerTransacoes } = await import("@/lib/transacao-confirmada");
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "3");
  return { prisma: protegerTransacoes(new PrismaClient({ datasourceUrl: url.toString() })) };
});
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async original => {
  const real = await original<typeof import("@/server/_shared/sessao")>();
  return { ...real, exigirSessao: async () => {
    const u = await real.carregarUsuarioFresco(sessao.usuarioId);
    if (!u) throw new real.ErroAutenticacao();
    if (real.apenasPortal(u)) throw new real.ErroPermissao();
    return u;
  } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { comAvisosInbox } from "@/test/avisos-inbox";
import { garantirAtendimento } from "./atendimentos";
import { registrarNotaAtendimento } from "./acoes-conversa";
beforeEach(async () => { await truncarBanco(); sessao.usuarioId = ""; });
afterAll(() => prisma.$disconnect());
async function cenario() {
  const autor = await criarUsuario([Papel.ADMINISTRADOR], "Autora pool1");
  const destino = await criarUsuario([Papel.ADMINISTRADOR], "Ana Silva");
  const numero = await criarNumeroSetor({ telefoneE164: "+5500000000437", setores: ["COMERCIAL"], donoId: autor.id });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+5500000000438" } });
  const a = await prisma.$transaction(tx => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: autor.id }));
  sessao.usuarioId = autor.id;
  return { a, destino };
}
it("pool1 real: nota, ACL, aviso e NOTIFY confirmam juntos; replay nao repete", async () => {
  const { a, destino } = await cenario();
  const entrada = { atendimentoId: a.id, nota: "@Ana Silva", chaveIdempotencia: "pool1-mencao-337", mencoes: [{ usuarioId: destino.id, inicio: 0, fim: 10 }] };
  const primeira = await comAvisosInbox(() => registrarNotaAtendimento(entrada));
  expect(primeira.resultado.ok).toBe(true);
  expect(primeira.avisos).toEqual([{ tipo: "atendimento.atualizado", atendimentoId: a.id, conversaId: a.conversaId, mensagemId: null }]);
  expect(await prisma.evento.count({ where: { tipo: "NotaInterna" } })).toBe(1);
  expect(await prisma.notificacaoUsuario.count({ where: { usuarioId: destino.id, refId: a.id } })).toBe(1);
  const replay = await comAvisosInbox(() => registrarNotaAtendimento(entrada));
  expect(replay.resultado.ok).toBe(true);
  expect(replay.avisos).toEqual([]);
  expect(await prisma.notificacaoUsuario.count()).toBe(1);
  expect(await prisma.mensagemWhatsApp.count()).toBe(0);
  expect(await prisma.intencaoMensagem.count()).toBe(0);
});
it("pool1 real: token incompatível reverte nota e aviso sem NOTIFY", async () => {
  const { a, destino } = await cenario();
  const observado = await comAvisosInbox(() => registrarNotaAtendimento({ atendimentoId: a.id, nota: "@Outra Pessoa", mencoes: [{ usuarioId: destino.id, inicio: 0, fim: 13 }] }));
  expect(observado.resultado.ok).toBe(false);
  expect(observado.avisos).toEqual([]);
  expect(await prisma.evento.count({ where: { tipo: "NotaInterna" } })).toBe(0);
  expect(await prisma.notificacaoUsuario.count()).toBe(0);
});
