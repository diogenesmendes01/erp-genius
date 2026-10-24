import { beforeEach, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";
import { extrairMencoes, type TokenMencao } from "@/lib/mencoes-nota";
import type { UsuarioMencao } from "./usuarios-mencoes";
const m = vi.hoisted(() => ({ relevantes: vi.fn(), visivel: vi.fn(), selecionados: vi.fn(), criar: vi.fn() }));
vi.mock("./usuarios-mencoes", () => ({ usuariosRelevantesParaMencao: m.relevantes }));
vi.mock("@/server/whatsapp/atendimentos", () => ({ atendimentoVisivel: m.visivel }));
import { notificarMencoesNaNota } from "./mencoes";
const autor = { id: "autor", nome: "Autor", papeis: [Papel.ADMINISTRADOR], permissoes: [] };
const pessoa = (id: string, nome: string): UsuarioMencao => ({ id, nome, ativo: true, papeis: [Papel.VENDEDOR], permissoes: [] });
const tx = { usuario: { findMany: m.selecionados }, notificacaoUsuario: { create: m.criar } } as unknown as Prisma.TransactionClient;
let relevantes: UsuarioMencao[];
let permitidos: Set<string>;
beforeEach(() => {
  vi.clearAllMocks();
  relevantes = [];
  permitidos = new Set();
  m.relevantes.mockImplementation(async () => relevantes);
  m.selecionados.mockResolvedValue([]);
  m.visivel.mockImplementation(async (p: UsuarioMencao) => permitidos.has(p.id));
  m.criar.mockResolvedValue({});
});
const executar = (nota: string, mencoes?: TokenMencao[]) => notificarMencoesNaNota(tx, { autor, atendimentoId: "at", eventoId: "ev", nota, mencoes });
const avisados = () => m.criar.mock.calls.map(([q]) => q.data.usuarioId);
const consultados = () => m.visivel.mock.calls.map(([p]) => p.id);
it("evita ACL de aliases impossiveis sem desambiguar homonimos antes dela", async () => {
  relevantes = [pessoa("ana-1", "Ana Silva"), pessoa("ana-2", "Ana Souza"), pessoa("outra", "Anabela")];
  permitidos = new Set(["ana-2", "outra"]);
  await executar("@Ana");
  expect(consultados()).toEqual(["ana-1", "ana-2"]);
  expect(avisados()).toEqual(["ana-2"]);
  for (const [, atendimento, restrito, db] of m.visivel.mock.calls) expect([atendimento, restrito, db]).toEqual(["at", false, tx]);
});
it.each([
  ["@Ana Silva", [pessoa("longa", "Ana Silva"), pessoa("curta", "Ana Souza")], ["curta"], ["curta"]],
  ["@Ana Silva", [pessoa("a", "Ana Silva"), pessoa("b", "Ana Silva"), pessoa("curta", "Ana Souza")], ["a", "b", "curta"], []],
  ["@Ana", [pessoa("a", "Ana Silva"), pessoa("b", "Ana Souza")], ["a", "b"], []],
  ["@João Souza", [pessoa("a", "João Souza"), pessoa("b", "João Lima")], ["a", "b"], ["a"]],
  ["@Joa\u0303o Souza", [pessoa("a", "João Souza")], ["a"], ["a"]],
  ["@Ana-Maria @D’Ávila", [pessoa("a", "Ana-Maria"), pessoa("b", "D’Ávila")], ["a", "b"], ["a", "b"]],
  ["email@Ana .@Ana @@Ana _@Ana @Anabela", [pessoa("a", "Ana Silva"), pessoa("b", "Anabela")], ["a", "b"], ["b"]],
] as const)("preserva extracao apos ACL para %s", async (nota, candidatos, visiveis, esperado) => {
  relevantes = [...candidatos];
  permitidos = new Set(visiveis);
  await executar(nota);
  expect(avisados()).toEqual(esperado);
  expect(avisados()).toEqual(extrairMencoes(nota, relevantes.filter(p => permitidos.has(p.id))));
});
it("tokens por ID ignoram filtro lexical e incompatibilidade visivel continua sendo erro", async () => {
  m.selecionados.mockResolvedValue([pessoa("id", "Beatriz")]);
  permitidos.add("id");
  await expect(executar("@Ana", [{ usuarioId: "id", inicio: 0, fim: 4 }])).rejects.toThrow("Confira as pessoas selecionadas");
  expect(consultados()).toEqual(["id"]);
  expect(m.criar).not.toHaveBeenCalled();
  expect(m.selecionados.mock.calls[0][0].where).toEqual({ id: { in: ["id"] } });
});
it("token revogado nao vira mencao livre de homonimo", async () => {
  relevantes = [pessoa("outro", "Ana")];
  m.selecionados.mockResolvedValue([pessoa("id", "Ana")]);
  permitidos.add("outro");
  await executar("@Ana", [{ usuarioId: "id", inicio: 0, fim: 4 }]);
  expect(consultados()).toEqual(["id"]);
  expect(avisados()).toEqual([]);
});
it("sentinel 201 e avaliado antes do filtro, preservando apenas token selecionado", async () => {
  relevantes = [pessoa("ana", "Ana"), ...Array.from({ length: 200 }, (_, i) => pessoa("nao-" + i, "Anabela"))];
  m.selecionados.mockResolvedValue([pessoa("id", "Beatriz")]);
  permitidos = new Set(["ana", "id"]);
  await executar("@Ana @Beatriz", [{ usuarioId: "id", inicio: 5, fim: 13 }]);
  expect(consultados()).toEqual(["id"]);
  expect(avisados()).toEqual(["id"]);
});
it("nao limita mencoes livres a vinte e admite ganho zero entre duzentos homonimos", async () => {
  relevantes = Array.from({ length: 200 }, (_, i) => pessoa("ana-" + i, "Ana " + i));
  permitidos = new Set(relevantes.map(p => p.id));
  await executar("@Ana");
  expect(m.visivel).toHaveBeenCalledTimes(200);
  expect(avisados()).toEqual([]);
});

it("uniao pode chegar a 250 candidatos e tokens continuam distintos por ID", async () => {
  relevantes = Array.from({ length: 200 }, (_, i) => pessoa("ana-" + i, "Ana " + i));
  const selecionados = Array.from({ length: 50 }, (_, i) => pessoa("bia-" + i, "Beatriz " + i));
  m.selecionados.mockResolvedValue(selecionados);
  permitidos = new Set([...relevantes, ...selecionados].map(p => p.id));
  let nota = "@Ana";
  const mencoes = selecionados.map(p => {
    const inicio = nota.length + 1;
    nota += " @" + p.nome;
    return { usuarioId: p.id, inicio, fim: nota.length };
  });
  await executar(nota, mencoes);
  expect(m.visivel).toHaveBeenCalledTimes(250);
  expect(avisados()).toEqual(selecionados.map(p => p.id));
});
it("autor, inativo e portal nao chegam a ACL nem aviso mesmo por token", async () => {
  const selecionados = [pessoa("autor", "Autor"), { ...pessoa("inativo", "Inativo"), ativo: false }, { ...pessoa("portal", "Portal"), papeis: [Papel.ALUNO] }];
  m.selecionados.mockResolvedValue(selecionados);
  permitidos = new Set(selecionados.map(p => p.id));
  await executar("@Autor @Inativo @Portal", [{ usuarioId: "autor", inicio: 0, fim: 6 }, { usuarioId: "inativo", inicio: 7, fim: 15 }, { usuarioId: "portal", inicio: 16, fim: 23 }]);
  expect(m.visivel).not.toHaveBeenCalled();
  expect(avisados()).toEqual([]);
});

it("ACL em fases reduz nome completo visivel de duzentos candidatos para um", async () => {
  relevantes = [pessoa("silva", "Ana Silva"), ...Array.from({ length: 199 }, (_, i) => pessoa("ana-" + i, "Ana Exemplo " + i))];
  permitidos = new Set(relevantes.map(p => p.id));
  await executar("@Ana Silva");
  expect(avisados()).toEqual(["silva"]);
  expect(consultados()).toEqual(["silva"]);
});
it("diferencial gerado equivale a ACL exaustiva para subsets, aliases e tokens", async () => {
  const pessoas = [pessoa("a", "Ana Silva"), pessoa("b", "Ana Silva"), pessoa("c", "Ana Souza"), pessoa("d", "Ana Silva Costa"), pessoa("e", "João Souza"), pessoa("f", "João Lima"), pessoa("g", "D’Ávila")];
  const entradas = ["@Ana Silva", "@Ana Silva Costa e @Ana", "@Ana Silva @Ana Souza", "@JOÃO Souza @Ana Silva", "@Joa\u0303o @D’Ávila", "mail@Ana .@Ana @@Ana @Anabela", "@Ana Silva Costa @Ana Silva @João Souza", "@D’Ávila @Ana Silva", "@Ana Silva @João Souza", "@Ana Silva @Ana", "@Ana Silva @Ana Silva", "@Ana Silva @Ana Silva @João Souza @João Souza"];
  for (const ordem of [pessoas, [...pessoas].reverse(), [...pessoas.slice(3), ...pessoas.slice(0, 3)]])
  for (let mask = 0; mask < 128; mask++) for (const [n, nota] of entradas.entries()) {
    relevantes = ordem;
    permitidos = new Set(pessoas.filter((_, i) => mask & (1 << i)).map(p => p.id));
    const tokens = n >= 8 && n <= 10 ? [{ usuarioId: "b", inicio: 0, fim: 10 }] : [];
    m.selecionados.mockResolvedValue(tokens.length ? [pessoas[1]] : []);
    m.visivel.mockClear(); m.criar.mockClear();
    const esperado = extrairMencoes(nota, pessoas.filter(p => permitidos.has(p.id)), tokens);
    await executar(nota, tokens);
    expect(avisados(), JSON.stringify({ mask, nota, tokens })).toEqual(esperado);
    expect(new Set(consultados()).size).toBe(consultados().length);
  }
});

it("grupo longo ambiguo verifica ambos e para sem consultar alias curto", async () => {
  relevantes = [pessoa("a", "Ana Silva"), pessoa("b", "Ana Silva"), pessoa("curta", "Ana Souza")];
  permitidos = new Set(relevantes.map(p => p.id));
  await executar("@Ana Silva");
  expect(consultados()).toEqual(["a", "b"]);
  expect(avisados()).toEqual([]);
});
