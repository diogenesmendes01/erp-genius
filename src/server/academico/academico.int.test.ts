import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

// FASE 3 (doc 03): diário/frequência, notas, progressão sugerida + certificado e o
// PORTAL DO ALUNO (row-level pelo vínculo usuário↔aluno). Sessão mockada; papéis do banco.

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo, eventosDo } from "@/test/integracao";
import { aprovarNivelAluno, criarAcessoPortal, lancarNotas, registrarAula, registrarTesteNivel, salvarAvaliacao } from "./acoes";
import { dadosPortalDoUsuario, progressaoDaTurma, validarCertificado } from "./consultas";

let professor: Awaited<ReturnType<typeof criarUsuario>>;
let secretaria: Awaited<ReturnType<typeof criarUsuario>>;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

beforeEach(async () => {
  await truncarBanco();
  professor = await criarUsuario([Papel.PROFESSOR], "Prof");
  secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Sec");
  catalogo = await seedCatalogoMinimo();
});

async function seedTurmaComAluno() {
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const turma = await prisma.turma.create({
    data: {
      nome: "Salvador",
      modalidadeId: catalogo.modalidade.id,
      nivelId: nivel.id,
      professorId: professor.id,
      status: "EM_ANDAMENTO",
      capacidade: 10,
    },
  });
  const aluno = await prisma.aluno.create({
    data: { codigo: "A-000001", primeiroNome: "Maria", sobrenome: "Rojas", paisId: catalogo.pais.id },
  });
  await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: turma.id } });
  return { turma, aluno, nivel };
}

describe("diário de classe", () => {
  it("professor da turma registra aula + frequência; re-registrar a data EDITA", async () => {
    const { turma, aluno } = await seedTurmaComAluno();
    authMock.mockResolvedValue({ user: { id: professor.id } });

    const r1 = await registrarAula({
      turmaId: turma.id,
      dataISO: "2026-08-20",
      conteudo: "Presente simple",
      presencas: [{ alunoId: aluno.id, presente: true }],
    });
    expect(r1.ok, r1.ok ? "" : `falhou: ${(r1 as { erro?: string }).erro}`).toBe(true);

    const r2 = await registrarAula({
      turmaId: turma.id,
      dataISO: "2026-08-20",
      conteudo: "Presente simple (rev.)",
      presencas: [{ alunoId: aluno.id, presente: false }],
    });
    expect(r2.ok).toBe(true);

    expect(await prisma.aula.count()).toBe(1); // editou, não duplicou
    const presenca = await prisma.presenca.findFirstOrThrow();
    expect(presenca.presente).toBe(false);
  });

  it("professor de OUTRA turma é barrado (escopo)", async () => {
    const { turma, aluno } = await seedTurmaComAluno();
    const outro = await criarUsuario([Papel.PROFESSOR], "Outro Prof");
    authMock.mockResolvedValue({ user: { id: outro.id } });

    const r = await registrarAula({
      turmaId: turma.id,
      dataISO: "2026-08-20",
      presencas: [{ alunoId: aluno.id, presente: true }],
    });
    expect(r.ok).toBe(false);
    expect(await prisma.aula.count()).toBe(0);
  });
});

describe("notas + progressão sugerida", () => {
  it("média ponderada + frequência alimentam a sugestão (aprovado ≥70 e ≥75%)", async () => {
    const { turma, aluno } = await seedTurmaComAluno();
    authMock.mockResolvedValue({ user: { id: professor.id } });

    // 4 aulas: 3 presenças (75%).
    for (const [dia, presente] of [["01", true], ["02", true], ["03", true], ["04", false]] as const) {
      await registrarAula({
        turmaId: turma.id,
        dataISO: `2026-08-${dia}`,
        presencas: [{ alunoId: aluno.id, presente }],
      });
    }
    // Prova (peso 2, nota 80) + Oral (peso 1, nota 60) → média (80*2+60)/3 = 73,3.
    const prova = await salvarAvaliacao({ turmaId: turma.id, nome: "Prova", peso: 2 });
    const oral = await salvarAvaliacao({ turmaId: turma.id, nome: "Oral", peso: 1 });
    await lancarNotas({ avaliacaoId: prova.ok ? prova.dado!.id : "", notas: [{ alunoId: aluno.id, valor: 80 }] });
    await lancarNotas({ avaliacaoId: oral.ok ? oral.dado!.id : "", notas: [{ alunoId: aluno.id, valor: 60 }] });

    const progressao = await progressaoDaTurma(turma.id);
    expect(progressao).toHaveLength(1);
    expect(progressao[0].frequenciaPct).toBe(75);
    expect(progressao[0].media).toBe(73.3);
    expect(progressao[0].aprovadoSugerido).toBe(true);
  });
});

describe("progressão aprovada → certificado", () => {
  it("aprovarNivelAluno emite certificado com código público + evento; não duplica", async () => {
    const { turma, aluno, nivel } = await seedTurmaComAluno();
    authMock.mockResolvedValue({ user: { id: secretaria.id } });

    const r = await aprovarNivelAluno(turma.id, aluno.id);
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);
    const codigo = r.ok ? r.dado!.codigoValidacao : "";

    const cert = await prisma.certificado.findFirstOrThrow();
    expect(cert.nivelId).toBe(nivel.id);
    expect((await eventosDo("Aluno", aluno.id)).map((e) => e.tipo)).toContain("NivelConcluido");

    // Validação pública.
    const valido = await validarCertificado(codigo);
    expect(valido?.aluno).toBe("Maria Rojas");
    expect(await validarCertificado("FFFFFFFFFFFF")).toBeNull();

    // Idempotência por aluno×nível.
    const r2 = await aprovarNivelAluno(turma.id, aluno.id);
    expect(r2.ok).toBe(false);
  });

  it("professor NÃO aprova progressão (alçada da secretaria/pedagógico)", async () => {
    const { turma, aluno } = await seedTurmaComAluno();
    authMock.mockResolvedValue({ user: { id: professor.id } });
    const r = await aprovarNivelAluno(turma.id, aluno.id);
    expect(r.ok).toBe(false);
    expect(await prisma.certificado.count()).toBe(0);
  });
});

describe("portal do aluno", () => {
  it("acesso criado 1:1; o portal devolve SÓ os dados do próprio aluno", async () => {
    const { turma, aluno } = await seedTurmaComAluno();
    authMock.mockResolvedValue({ user: { id: secretaria.id } });
    const r = await criarAcessoPortal({ alunoId: aluno.id, email: "maria@aluno.cr", senha: "segredo123" });
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);

    const usuarioAluno = await prisma.usuario.findUniqueOrThrow({ where: { email: "maria@aluno.cr" } });
    expect(usuarioAluno.papeis).toEqual([Papel.ALUNO]);

    // Aula registrada aparece na frequência do portal.
    authMock.mockResolvedValue({ user: { id: professor.id } });
    await registrarAula({
      turmaId: turma.id,
      dataISO: "2026-08-20",
      presencas: [{ alunoId: aluno.id, presente: true }],
    });

    const portal = await dadosPortalDoUsuario({ id: usuarioAluno.id, nome: "Maria", papeis: [Papel.ALUNO] });
    expect(portal?.aluno.nome).toBe("Maria Rojas");
    expect(portal?.turma?.label).toContain("A1");
    expect(portal?.frequencia.pct).toBe(100);

    // Usuário SEM vínculo (staff) não tem portal.
    const semVinculo = await dadosPortalDoUsuario({ id: secretaria.id, nome: "Sec", papeis: [Papel.SECRETARIA_ACADEMICA] });
    expect(semVinculo).toBeNull();
  });

  it("segundo acesso para o mesmo aluno é recusado", async () => {
    const { aluno } = await seedTurmaComAluno();
    authMock.mockResolvedValue({ user: { id: secretaria.id } });
    await criarAcessoPortal({ alunoId: aluno.id, email: "maria@aluno.cr", senha: "segredo123" });
    const r = await criarAcessoPortal({ alunoId: aluno.id, email: "outra@aluno.cr", senha: "segredo123" });
    expect(r.ok).toBe(false);
  });
});


describe("review PR #60 — acadêmico", () => {
  it("nota de aluno de OUTRA turma é recusada (nada é gravado)", async () => {
    const { turma } = await seedTurmaComAluno();
    const forasteiro = await prisma.aluno.create({
      data: { codigo: "A-000099", primeiroNome: "Zé", paisId: catalogo.pais.id },
    });
    authMock.mockResolvedValue({ user: { id: professor.id } });
    const av = await salvarAvaliacao({ turmaId: turma.id, nome: "Prova X", peso: 1 });
    const r = await lancarNotas({
      avaliacaoId: av.ok ? av.dado!.id : "",
      notas: [{ alunoId: forasteiro.id, valor: 90 }],
    });
    expect(r.ok).toBe(false);
    expect(await prisma.nota.count()).toBe(0);
  });

  it("data da aula 'YYYY-MM-DD' é ancorada no DIA LOCAL (não vira véspera em UTC-)", async () => {
    const { turma, aluno } = await seedTurmaComAluno();
    authMock.mockResolvedValue({ user: { id: professor.id } });
    await registrarAula({
      turmaId: turma.id,
      dataISO: "2026-08-20",
      presencas: [{ alunoId: aluno.id, presente: true }],
    });
    const aula = await prisma.aula.findFirstOrThrow();
    expect(aula.data.getDate()).toBe(20); // dia LOCAL preservado (meio-dia local)
    expect(aula.data.getHours()).toBe(12);
  });
});

describe("review PR #60 rodada 2 — acadêmico", () => {
  it("teste de nível: PROFESSOR só registra para aluno das SUAS turmas; secretaria registra qualquer", async () => {
    const { aluno, nivel } = await seedTurmaComAluno();
    const forasteiro = await prisma.aluno.create({
      data: { codigo: "A-000077", primeiroNome: "Bia", paisId: catalogo.pais.id },
    });
    authMock.mockResolvedValue({ user: { id: professor.id } });
    const negado = await registrarTesteNivel({ alunoId: forasteiro.id, nivelId: nivel.id, pontuacao: 80 });
    expect(negado.ok).toBe(false);
    expect(await prisma.testeNivel.count()).toBe(0);

    const proprio = await registrarTesteNivel({ alunoId: aluno.id, nivelId: nivel.id, pontuacao: 90 });
    expect(proprio.ok, proprio.ok ? "" : `falhou: ${(proprio as { erro?: string }).erro}`).toBe(true);

    authMock.mockResolvedValue({ user: { id: secretaria.id } });
    const amplo = await registrarTesteNivel({ alunoId: forasteiro.id, nivelId: nivel.id });
    expect(amplo.ok).toBe(true);
  });

  it("frequência exige o ROSTER: aluno omitido vira FALTA materializada; repetido é rejeitado", async () => {
    const { turma, aluno } = await seedTurmaComAluno();
    const segundo = await prisma.aluno.create({
      data: { codigo: "A-000078", primeiroNome: "Leo", paisId: catalogo.pais.id },
    });
    await prisma.alocacaoTurma.create({ data: { alunoId: segundo.id, turmaId: turma.id } });
    authMock.mockResolvedValue({ user: { id: professor.id } });

    const r = await registrarAula({
      turmaId: turma.id,
      dataISO: "2026-08-21",
      presencas: [{ alunoId: aluno.id, presente: true }], // Leo omitido
    });
    expect(r.ok).toBe(true);
    const doSegundo = await prisma.presenca.findFirstOrThrow({ where: { alunoId: segundo.id } });
    expect(doSegundo.presente).toBe(false); // falta materializada — entra no denominador
    expect(await prisma.presenca.count()).toBe(2);

    const dup = await registrarAula({
      turmaId: turma.id,
      dataISO: "2026-08-22",
      presencas: [
        { alunoId: aluno.id, presente: true },
        { alunoId: aluno.id, presente: false },
      ],
    });
    expect(dup.ok).toBe(false);
  });

  it("datetime e data de calendário inválida são rejeitados no schema (só 'AAAA-MM-DD')", async () => {
    const { turma, aluno } = await seedTurmaComAluno();
    authMock.mockResolvedValue({ user: { id: professor.id } });
    const comHora = await registrarAula({
      turmaId: turma.id,
      dataISO: "2026-08-20T09:00",
      presencas: [{ alunoId: aluno.id, presente: true }],
    });
    expect(comHora.ok).toBe(false);
    const invalida = await registrarAula({
      turmaId: turma.id,
      dataISO: "2026-02-31",
      presencas: [{ alunoId: aluno.id, presente: true }],
    });
    expect(invalida.ok).toBe(false);
    expect(await prisma.aula.count()).toBe(0);
  });

  it("certificado aluno×nível é ÚNICO no banco (duas aprovações concorrentes não geram dois códigos)", async () => {
    const { aluno, nivel } = await seedTurmaComAluno();
    await prisma.certificado.create({
      data: { alunoId: aluno.id, nivelId: nivel.id, codigoValidacao: "AAAAAAAAAAAA" },
    });
    await expect(
      prisma.certificado.create({
        data: { alunoId: aluno.id, nivelId: nivel.id, codigoValidacao: "BBBBBBBBBBBB" },
      }),
    ).rejects.toThrow(); // P2002 — @@unique(alunoId, nivelId)
  });
});
