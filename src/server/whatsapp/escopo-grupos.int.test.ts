import { beforeEach, describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { escopoGrupos } from "./escopo";

beforeEach(async () => {
  await truncarBanco();
});

async function cenario() {
  const catalogo = await seedCatalogoMinimo();
  const prof = await criarUsuario([Papel.PROFESSOR]);
  const outroProf = await criarUsuario([Papel.PROFESSOR]);
  const gerPed = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
  const fin = await criarUsuario([Papel.FINANCEIRO]);
  const admin = await criarUsuario([Papel.ADMINISTRADOR]);
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: catalogo.modalidade.id, professorId: prof.id } });
  await prisma.vinculoDocente.create({ data: { turmaId: turma.id, professorId: prof.id, inicio: new Date(Date.now() - 1000) } });
  const numPed = await criarNumeroSetor({ telefoneE164: "+5511900001001", setores: ["PEDAGOGICO"] });
  const numFin = await criarNumeroSetor({ telefoneE164: "+5511900001002", setores: ["FINANCEIRO"] });
  const grupoTurma = await prisma.grupoWhatsApp.create({ data: { numeroId: numPed.id, grupoJid: "1@g.us", nome: "Turma", turmaId: turma.id } });
  const grupoSemTurmaNumeroFin = await prisma.grupoWhatsApp.create({ data: { numeroId: numFin.id, grupoJid: "2@g.us", nome: "Avisos" } });
  return { prof, outroProf, gerPed, fin, admin, grupoTurma, grupoSemTurmaNumeroFin };
}
const idsGrupos = async (u: { id: string; papeis: Papel[] }) =>
  (await prisma.grupoWhatsApp.findMany({ where: await escopoGrupos(u), select: { id: true }, orderBy: { id: "asc" } })).map((g) => g.id);

describe("escopoGrupos", () => {
  it("grupo da turma: professor alocado e PEDAGOGICO veem; outro professor não", async () => {
    const { prof, outroProf, gerPed, grupoTurma } = await cenario();
    expect(await idsGrupos(prof)).toEqual([grupoTurma.id]);
    expect(await idsGrupos(gerPed)).toContain(grupoTurma.id);
    expect(await idsGrupos(outroProf)).toEqual([]);
  });
  it("grupo sem turma: setores do número (Q4 provisória); admin vê todos", async () => {
    const { fin, admin, grupoSemTurmaNumeroFin } = await cenario();
    expect(await idsGrupos(fin)).toEqual([grupoSemTurmaNumeroFin.id]);
    expect(await idsGrupos(admin)).toHaveLength(2);
  });
  it("sem papel de inbox: fail-closed", async () => {
    await cenario();
    const nada = await criarUsuario([Papel.VENDEDOR]);
    expect(await idsGrupos(nada)).toEqual([]);
  });
});
