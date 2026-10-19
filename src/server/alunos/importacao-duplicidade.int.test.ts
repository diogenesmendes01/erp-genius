import { beforeEach, describe, expect, it } from "vitest";
import { StatusPais } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { LOTE_CANDIDATOS_DUPLICIDADE, carregarCadastradosParaDuplicidade, chavesDeIdentidade, type IdentidadeAluno } from "./importacao-duplicidade";

// #180 C2 contra o Postgres real: acento no primeiro nome, leitura sem teto e país nas chaves de nome.

beforeEach(async () => { await truncarBanco(); });

const pais = (codigoISO: string, nome: string) =>
  prisma.pais.create({ data: { nome, codigoISO, moedaLocal: "USD", ddi: "+1", status: StatusPais.ATIVO } });

const linha = (o: Partial<IdentidadeAluno> & { paisId: string }): IdentidadeAluno => ({
  primeiroNome: "José", sobrenome: "Pérez", documento: null, email: null, telefoneE164: null, nascimento: null, ...o,
});

describe("carregarCadastradosParaDuplicidade (banco real)", () => {
  it("\"Jose\" na planilha acha \"José\" cadastrado com o mesmo nascimento", async () => {
    const cr = await pais("CR", "Costa Rica");
    await prisma.aluno.create({ data: { primeiroNome: "José", sobrenome: "Pérez", paisId: cr.id, codigo: "A-000001", nascimento: new Date("2005-06-07T00:00:00.000Z") } });
    const jose = linha({ paisId: cr.id, primeiroNome: "Jose", sobrenome: "Perez", nascimento: new Date(2005, 5, 7, 12) });
    const i = await carregarCadastradosParaDuplicidade([jose]);
    expect(i.procurar(chavesDeIdentidade(jose))).toEqual({ origem: { tipo: "cadastro", nome: "José Pérez", codigo: "A-000001" }, criterio: "nascimento" });
  });

  it("sem teto: o cadastro mais novo é achado mesmo depois de mais de um lote de candidatos", async () => {
    const cr = await pais("CR", "Costa Rica");
    await prisma.aluno.createMany({
      data: Array.from({ length: LOTE_CANDIDATOS_DUPLICIDADE + 5 }, (_, k) => ({ primeiroNome: `Irmão${k}`, paisId: cr.id, email: "familia@example.test" })),
    });
    await prisma.aluno.create({ data: { primeiroNome: "José", sobrenome: "Pérez", paisId: cr.id, codigo: "A-999999", email: "familia@example.test" } });
    const jose = linha({ paisId: cr.id, email: "Familia@Example.test" });
    const i = await carregarCadastradosParaDuplicidade([jose]);
    expect(i.procurar(chavesDeIdentidade(jose))?.origem).toEqual({ tipo: "cadastro", nome: "José Pérez", codigo: "A-999999" });
  });

  it("mesmo nome e e-mail em outro país não é duplicidade", async () => {
    const [cr, pa] = [await pais("CR", "Costa Rica"), await pais("PA", "Panamá")];
    await prisma.aluno.create({ data: { primeiroNome: "José", sobrenome: "Pérez", paisId: pa.id, email: "jose@example.test", telefoneE164: "+50760000000" } });
    const jose = linha({ paisId: cr.id, email: "jose@example.test", telefoneE164: "+50760000000" });
    expect((await carregarCadastradosParaDuplicidade([jose])).procurar(chavesDeIdentidade(jose))).toBeNull();
    const noPanama = linha({ paisId: pa.id, email: "jose@example.test" });
    expect((await carregarCadastradosParaDuplicidade([noPanama])).procurar(chavesDeIdentidade(noPanama))?.criterio).toBe("email");
  });
});
