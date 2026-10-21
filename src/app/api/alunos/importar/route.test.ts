import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Importação de alunos com deduplicação (docs/42 L224; docs/43 §6 item 9). Sem banco: auth e Prisma mockados; a
// planilha é um XLSX de verdade, montado com o exceljs. Confere que a linha repetida — de um aluno já cadastrado ou
// de uma linha anterior da mesma planilha — não é criada e volta em `ignorados` com o motivo.

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  usuario: vi.fn(),
  paises: vi.fn(),
  alunos: vi.fn(),
  criar: vi.fn(),
  evento: vi.fn(),
  codigo: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("next/server", () => ({ NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } }));
vi.mock("@/lib/codigo", () => ({ gerarCodigo: m.codigo }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    usuario: { findUnique: m.usuario },
    pais: { findMany: m.paises },
    aluno: { findMany: m.alunos },
    $transaction: async (f: (tx: object) => unknown) => f({ aluno: { create: m.criar } }),
  },
}));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, registrarEvento: m.evento };
});

import { POST } from "./route";

const CABECALHO = ["Nome", "Sobrenome", "País", "Número do documento", "E-mail", "Telefone", "Data de nascimento (AAAA-MM-DD)"];

async function enviar(linhas: string[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Alunos");
  ws.addRow(CABECALHO);
  for (const l of linhas) ws.addRow(l);
  const arquivo = new Uint8Array(await wb.xlsx.writeBuffer());
  const fd = new FormData();
  fd.append("file", new File([arquivo], "alunos.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const r = await POST(new Request("http://localhost/api/alunos/importar", { method: "POST", body: fd }));
  return { status: r.status, corpo: (await r.json()) as { total: number; criados: number; erros: { linha: number; motivo: string }[]; ignorados: { linha: number; motivo: string }[] } };
}
const criadosComo = () => m.criar.mock.calls.map((c) => (c[0] as { data: { primeiroNome: string; sobrenome: string | null } }).data).map((d) => `${d.primeiroNome} ${d.sobrenome ?? ""}`.trim());

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "admin" } });
  m.usuario.mockResolvedValue({ id: "admin", papeis: ["ADMINISTRADOR"], ativo: true });
  m.paises.mockResolvedValue([{ id: "cr", nome: "Costa Rica", codigoISO: "CR", ddi: "506", tiposDocumento: [] }]);
  m.alunos.mockResolvedValue([]);
  let n = 0;
  m.codigo.mockImplementation(async () => `A-${String(++n).padStart(6, "0")}`);
  m.criar.mockImplementation(async (args: { data: { codigo: string } }) => ({ id: `aluno-${args.data.codigo}` }));
});

describe("POST /api/alunos/importar — deduplicação", () => {
  it("reenviar a mesma planilha não recadastra: quem já existe é ignorado com nome, código e motivo", async () => {
    m.alunos.mockResolvedValue([
      { paisId: "cr", primeiroNome: "Ana", sobrenome: "Rojas", codigo: "A-000010", documento: "1-2345-6789", email: null, telefoneE164: null, nascimento: null },
    ]);
    const { status, corpo } = await enviar([
      ["Ana", "Rojas", "Costa Rica", "123456789", "", "", ""],
      ["Bruno", "Mora", "Costa Rica", "", "bruno@example.test", "", ""],
    ]);
    expect(status).toBe(200);
    expect(corpo).toMatchObject({ total: 2, criados: 1, erros: [] });
    expect(corpo.ignorados).toEqual([{ linha: 2, motivo: "Já cadastrado como Ana Rojas (A-000010): mesmo documento no mesmo país. A linha não foi importada." }]);
    expect(criadosComo()).toEqual(["Bruno Mora"]);
    expect(m.evento).toHaveBeenCalledTimes(1);
  });

  it("a linha que repete outra da mesma planilha é ignorada; a primeira é criada", async () => {
    const { corpo } = await enviar([
      ["María", "González", "Costa Rica", "", "maria@example.test", "", ""],
      ["Bruno", "Mora", "Costa Rica", "", "", "88887777", ""],
      ["MARIA", "Gonzalez", "CR", "", "Maria@Example.test", "", ""],
      ["Bruno", "Mora", "Costa Rica", "", "", "+506 8888-7777", ""],
    ]);
    expect(corpo).toMatchObject({ total: 4, criados: 2, erros: [] });
    expect(corpo.ignorados).toEqual([
      { linha: 4, motivo: "Repete a linha 2 desta planilha: mesmo nome e e-mail. A linha não foi importada." },
      { linha: 5, motivo: "Repete a linha 3 desta planilha: mesmo nome e telefone. A linha não foi importada." },
    ]);
    expect(criadosComo()).toEqual(["María González", "Bruno Mora"]);
  });

  it("irmãos com o mesmo e-mail e telefone do responsável não são duplicata", async () => {
    const { corpo } = await enviar([
      ["Ana", "Rojas", "Costa Rica", "", "familia@example.test", "88887777", ""],
      ["Bruno", "Rojas", "Costa Rica", "", "familia@example.test", "88887777", ""],
    ]);
    expect(corpo).toMatchObject({ criados: 2, ignorados: [] });
  });

  it("uma consulta só aos cadastrados, em lotes, com os candidatos da planilha (nascimento pelo dia, sem o primeiro nome)", async () => {
    await enviar([
      ["Ana", "Rojas", "Costa Rica", "1-2345-6789", "", "", "2001-02-03"],
      ["Bruno", "Mora", "Costa Rica", "", "bruno@example.test", "", ""],
    ]);
    expect(m.alunos).toHaveBeenCalledTimes(1);
    const args = m.alunos.mock.calls[0][0] as { where: { OR: unknown[] }; take: number };
    expect(args.take).toBeGreaterThan(0);
    expect(args.where.OR).toEqual(expect.arrayContaining([
      { documento: { in: ["1-2345-6789", "123456789"] } },
      { email: { in: ["bruno@example.test"], mode: "insensitive" } },
      { nascimento: { gte: new Date("2001-02-03T00:00:00.000Z"), lt: new Date("2001-02-04T00:00:00.000Z") } },
    ]));
  });

  it("linha com erro continua no relatório de erros e não entra nos ignorados; a que falhou ao gravar não vira referência", async () => {
    m.criar.mockRejectedValueOnce(new Error("falha"));
    const { corpo } = await enviar([
      ["Ana", "Rojas", "Costa Rica", "123456789", "", "", ""],
      ["", "SemNome", "Costa Rica", "", "", "", ""],
      ["Ana", "Rojas", "Costa Rica", "123456789", "", "", ""],
    ]);
    // A linha 2 falhou ao gravar; a 4 (mesma pessoa) é criada — não é "repetida" de algo que não existe.
    expect(corpo.erros).toEqual([{ linha: 2, motivo: "Falha ao gravar a linha no banco." }, { linha: 3, motivo: "Nome (obrigatório) está vazio." }]);
    expect(corpo.ignorados).toEqual([]);
    expect(corpo.criados).toBe(1);
  });
});
