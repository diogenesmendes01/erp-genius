import { beforeEach, describe, expect, it, vi } from "vitest";

// Deduplicação da importação de alunos (docs/42 L224; docs/43 §6 item 9). Sem banco: o Prisma é mockado e o
// teste confere o `where`/`take`/`cursor`/`select` da leitura dos candidatos; as chaves e o índice são puros.

const m = vi.hoisted(() => ({ alunos: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { aluno: { findMany: m.alunos } } }));

import {
  IndiceDuplicidade,
  LOTE_CANDIDATOS_DUPLICIDADE,
  carregarCadastradosParaDuplicidade,
  chavesDeIdentidade,
  documentoComparavel,
  motivoDuplicidade,
  nomeComparavel,
  type IdentidadeAluno,
} from "./importacao-duplicidade";

const pessoa = (o: Partial<IdentidadeAluno> = {}): IdentidadeAluno => ({
  paisId: "cr", primeiroNome: "María", sobrenome: "González Rojas", documento: null, email: null, telefoneE164: null, nascimento: null, ...o,
});
const criterios = (p: IdentidadeAluno) => chavesDeIdentidade(p).map((c) => c.criterio);

beforeEach(() => {
  vi.resetAllMocks();
  m.alunos.mockResolvedValue([]);
});

describe("chaves de identidade", () => {
  it("documento compara sem pontuação, espaço e caixa, e só dentro do mesmo país", () => {
    expect(documentoComparavel(" 1-2345-6789 ")).toBe("123456789");
    expect(documentoComparavel("ab.12/3")).toBe("AB123");
    const a = chavesDeIdentidade(pessoa({ documento: "1-2345-6789" }));
    const b = chavesDeIdentidade(pessoa({ documento: "123456789", primeiroNome: "Outro" }));
    expect(a[0]).toEqual(b[0]);
    expect(chavesDeIdentidade(pessoa({ documento: "123456789", paisId: "br" }))[0]).not.toEqual(a[0]);
  });

  it("documento curto demais (menos de 4 caracteres úteis) não identifica", () => {
    expect(criterios(pessoa({ documento: "1-2" }))).toEqual([]);
  });

  it("e-mail, telefone e nascimento só identificam junto com o nome (irmãos dividem o contato do responsável)", () => {
    const comum = { email: "Familia@Example.test", telefoneE164: "+50688887777", nascimento: new Date(2010, 3, 12, 12) };
    const ana = new IndiceDuplicidade();
    ana.registrar(chavesDeIdentidade(pessoa({ primeiroNome: "Ana", sobrenome: "Rojas", ...comum })), { tipo: "planilha", linha: 2 });
    expect(ana.procurar(chavesDeIdentidade(pessoa({ primeiroNome: "Bruno", sobrenome: "Rojas", ...comum })))).toBeNull();
    expect(ana.procurar(chavesDeIdentidade(pessoa({ primeiroNome: "Ana", sobrenome: "Rojas", email: "familia@example.test" })))).toEqual({ origem: { tipo: "planilha", linha: 2 }, criterio: "email" });
  });

  it("nome + e-mail, telefone ou nascimento só valem dentro do mesmo país, como o documento (#180 C2)", () => {
    const comum = { email: "maria@example.test", telefoneE164: "+50688887777", nascimento: new Date(2010, 3, 12, 12) };
    const i = new IndiceDuplicidade();
    i.registrar(chavesDeIdentidade(pessoa({ paisId: "cr", ...comum })), { tipo: "planilha", linha: 2 });
    expect(i.procurar(chavesDeIdentidade(pessoa({ paisId: "pa", ...comum })))).toBeNull();
    expect(i.procurar(chavesDeIdentidade(pessoa({ paisId: "cr", ...comum })))?.criterio).toBe("email");
  });

  it("nome sem acento, sem caixa e com espaços normalizados", () => {
    expect(nomeComparavel("  MARÍA ", "González   Rojas")).toBe("maria gonzalez rojas");
    const i = new IndiceDuplicidade();
    i.registrar(chavesDeIdentidade(pessoa({ telefoneE164: "+50688887777" })), { tipo: "planilha", linha: 3 });
    expect(i.procurar(chavesDeIdentidade(pessoa({ primeiroNome: "maria", sobrenome: "gonzalez rojas", telefoneE164: "+50688887777" })))?.criterio).toBe("telefone");
  });

  it("nascimento compara a data civil: o meio-dia local da planilha e a meia-noite UTC da carga são o mesmo dia", () => {
    const i = new IndiceDuplicidade();
    i.registrar(chavesDeIdentidade(pessoa({ nascimento: new Date("1998-04-12T00:00:00.000Z") })), { tipo: "cadastro", nome: "María González Rojas", codigo: "A-000007" });
    expect(i.procurar(chavesDeIdentidade(pessoa({ nascimento: new Date(1998, 3, 12, 12) })))?.criterio).toBe("nascimento");
    expect(i.procurar(chavesDeIdentidade(pessoa({ nascimento: new Date(1998, 3, 13, 12) })))).toBeNull();
  });

  it("sem documento e só com o nome: nenhuma chave (nome sozinho não identifica)", () => {
    expect(criterios(pessoa())).toEqual([]);
  });

  it("o documento vem primeiro: é o critério dito quando documento e e-mail coincidem", () => {
    const i = new IndiceDuplicidade();
    const p = pessoa({ documento: "1-2345-6789", email: "maria@example.test" });
    i.registrar(chavesDeIdentidade(p), { tipo: "planilha", linha: 2 });
    expect(i.procurar(chavesDeIdentidade(p))?.criterio).toBe("documento");
  });

  it("a primeira origem de cada chave vale (a linha 2, não a 5)", () => {
    const i = new IndiceDuplicidade();
    const chaves = chavesDeIdentidade(pessoa({ documento: "123456789" }));
    i.registrar(chaves, { tipo: "planilha", linha: 2 });
    i.registrar(chaves, { tipo: "planilha", linha: 5 });
    expect(i.procurar(chaves)?.origem).toEqual({ tipo: "planilha", linha: 2 });
  });
});

describe("motivo mostrado ao operador", () => {
  it("cadastro: nome, código e o critério; planilha: a linha repetida", () => {
    expect(motivoDuplicidade({ tipo: "cadastro", nome: "Ana Rojas", codigo: "A-000123" }, "documento"))
      .toBe("Já cadastrado como Ana Rojas (A-000123): mesmo documento no mesmo país. A linha não foi importada.");
    expect(motivoDuplicidade({ tipo: "cadastro", nome: "Ana Rojas", codigo: null }, "email"))
      .toBe("Já cadastrado como Ana Rojas: mesmo nome e e-mail. A linha não foi importada.");
    expect(motivoDuplicidade({ tipo: "planilha", linha: 4 }, "nascimento"))
      .toBe("Repete a linha 4 desta planilha: mesmo nome e data de nascimento. A linha não foi importada.");
  });
});

describe("carregarCadastradosParaDuplicidade", () => {
  it("lê em lotes pelo id: documento como veio e sem pontuação, e-mail sem caixa, telefone, dia do nascimento, nos países da planilha", async () => {
    await carregarCadastradosParaDuplicidade([
      pessoa({ documento: "1-2345-6789", email: " Maria@Example.test " }),
      pessoa({ primeiroNome: "Bruno", paisId: "br", telefoneE164: "+50688887777", nascimento: new Date(2001, 0, 2, 12) }),
    ]);
    expect(m.alunos).toHaveBeenCalledTimes(1);
    const args = m.alunos.mock.calls[0][0];
    expect(args.take).toBe(LOTE_CANDIDATOS_DUPLICIDADE);
    expect(args.orderBy).toEqual({ id: "asc" });
    expect(args.cursor).toBeUndefined();
    expect(args.where).toEqual({ paisId: { in: ["cr", "br"] }, OR: [
      { documento: { in: ["1-2345-6789", "123456789"] } },
      { email: { in: ["maria@example.test"], mode: "insensitive" } },
      { telefoneE164: { in: ["+50688887777"] } },
      { nascimento: { gte: new Date("2001-01-02T00:00:00.000Z"), lt: new Date("2001-01-03T00:00:00.000Z") } },
    ] });
    expect(Object.keys(args.select).sort()).toEqual(["codigo", "documento", "email", "id", "nascimento", "paisId", "primeiroNome", "sobrenome", "telefoneE164"]);
  });

  it("acento: o candidato vem pelo dia do nascimento, não pelo primeiro nome — \"Jose\" na planilha acha \"José\" no cadastro (#180 C2)", async () => {
    m.alunos.mockResolvedValue([{ id: "a1", paisId: "cr", primeiroNome: "José", sobrenome: "Pérez", codigo: "A-000001", documento: null, email: null, telefoneE164: null, nascimento: new Date("2005-06-07T00:00:00.000Z") }]);
    const jose = pessoa({ primeiroNome: "Jose", sobrenome: "Perez", nascimento: new Date(2005, 5, 7, 12) });
    const i = await carregarCadastradosParaDuplicidade([jose]);
    const where = m.alunos.mock.calls[0][0].where;
    expect(JSON.stringify(where)).not.toContain("primeiroNome");
    expect(i.procurar(chavesDeIdentidade(jose))).toEqual({ origem: { tipo: "cadastro", nome: "José Pérez", codigo: "A-000001" }, criterio: "nascimento" });
  });

  it("sem teto: quando um lote vem cheio, lê o próximo depois do último id, até acabar (#180 C2)", async () => {
    const enchimento = Array.from({ length: LOTE_CANDIDATOS_DUPLICIDADE }, (_, k) => ({
      id: `a${String(k).padStart(6, "0")}`, paisId: "cr", primeiroNome: `Outro${k}`, sobrenome: null, codigo: null, documento: null, email: "maria@example.test", telefoneE164: null, nascimento: null,
    }));
    m.alunos
      .mockResolvedValueOnce(enchimento)
      .mockResolvedValueOnce([{ id: "z1", paisId: "cr", primeiroNome: "María", sobrenome: "González Rojas", codigo: "A-009999", documento: null, email: "maria@example.test", telefoneE164: null, nascimento: null }]);
    const maria = pessoa({ email: "maria@example.test" });
    const i = await carregarCadastradosParaDuplicidade([maria]);
    expect(m.alunos).toHaveBeenCalledTimes(2);
    const segundo = m.alunos.mock.calls[1][0];
    expect(segundo.cursor).toEqual({ id: enchimento.at(-1)!.id });
    expect(segundo.skip).toBe(1);
    expect(segundo.where).toEqual(m.alunos.mock.calls[0][0].where);
    expect(i.procurar(chavesDeIdentidade(maria))?.origem).toEqual({ tipo: "cadastro", nome: "María González Rojas", codigo: "A-009999" });
  });

  it("sem campo que identifique (só nome e país): não consulta", async () => {
    const i = await carregarCadastradosParaDuplicidade([pessoa(), pessoa({ primeiroNome: "Bruno" })]);
    expect(m.alunos).not.toHaveBeenCalled();
    expect(i.procurar(chavesDeIdentidade(pessoa()))).toBeNull();
  });

  it("o cadastrado encontrado vira origem com nome e código; documento formatado diferente ainda casa", async () => {
    m.alunos.mockResolvedValue([{ id: "a1", paisId: "cr", primeiroNome: "Ana", sobrenome: "Rojas", codigo: "A-000123", documento: "1 2345 6789", email: null, telefoneE164: null, nascimento: null }]);
    const i = await carregarCadastradosParaDuplicidade([pessoa({ documento: "1-2345-6789" })]);
    expect(i.procurar(chavesDeIdentidade(pessoa({ documento: "1-2345-6789" })))).toEqual({
      origem: { tipo: "cadastro", nome: "Ana Rojas", codigo: "A-000123" }, criterio: "documento",
    });
  });
});
