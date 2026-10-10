import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn(), identificacao: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/gravacoes/troca-fonte-reposicao", () => ({
  consultarTrocaFonteReposicaoGravacao: mocks.consultar, proporTrocaFonteReposicaoGravacao: vi.fn(), decidirTrocaFonteReposicaoGravacao: vi.fn(),
}));
vi.mock("@/server/identificacao-registro", () => ({ consultarIdentificacaoReposicao: mocks.identificacao }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import Page from "./page";

const usuario = { id: "gestao", papeis: [Papel.GERENTE_PEDAGOGICO] };
const dados = () => ({
  contexto: { reposicaoId: "repo/1?", materialId: "material", matriculaId: "matricula-interna", fonteMaterialAtual: { versao: 1, revisao: "material-r1" }, fontePublicacaoAtual: { versao: 2, revisao: "aula-r2" }, materialDisponivel: true, disponibilizacaoId: null, jaAdotaPublicacaoAtual: false },
  propostas: [{ id: "interna", motivo: "Adotar publicação corrigida da aula original.", criadaEm: new Date("2026-09-18T12:00:00.000Z"), versaoMaterialEsperada: 1, fonteMaterialAnterior: { versao: 1, driveRevisionId: "material-r1" }, fontePublicacao: { versao: 2, driveRevisionId: "aula-r2" }, preparadorId: "gestao-a", preparador: { nome: "Gestão A" }, podeDecidir: false, decisao: null, fonteMaterial: null }],
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  mocks.identificacao.mockResolvedValue({
    id: "matricula-interna", codigo: "M-000777", status: "ATIVA", alunoId: "aluno-interno", aluno: "Bruna Lima", produto: "Inglês · Regular",
    turma: "T-000042", aulaOrigemInicio: new Date("2026-09-10T15:00:00.000Z"),
  });
});

it("consulta somente a reposição contextual depois do guard de gestão", async () => {
  mocks.sessao.mockResolvedValue(usuario);
  mocks.consultar.mockResolvedValue(dados());
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "repo/1?" }) }));
  expect(mocks.sessao).toHaveBeenCalledWith(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  expect(mocks.consultar).toHaveBeenCalledWith({ reposicaoId: "repo/1?" });
  expect(html).toContain("Material v1 → publicação v2");
  expect(html).toContain("06:00");
  expect(html).toContain("America/Costa_Rica");
  expect(mocks.preferencia).toHaveBeenCalledTimes(1);
  expect(html).not.toContain("interna");
});

it("identifica o aluno, a matrícula e a aula de origem da reposição (docs/42 L1989), sem id cru", async () => {
  mocks.sessao.mockResolvedValue(usuario);
  mocks.consultar.mockResolvedValue(dados());
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "repo/1?" }) }));
  expect(mocks.identificacao).toHaveBeenCalledWith(usuario, { reposicaoId: "repo/1?", matriculaId: "matricula-interna" });
  expect(html).toContain('aria-label="Aluno e reposição desta troca"');
  expect(html).toContain('href="/alunos/aluno-interno"');
  expect(html).toContain(">Bruna Lima</a>");
  expect(html).toContain("Matrícula: M-000777 · Inglês · Regular");
  expect(html).toContain("Reposição por gravação da aula de 10/09/2026, 09:00 (America/Costa_Rica) · turma T-000042");
  // Nenhum id interno vira texto: só aparece dentro de href.
  expect(html.replace(/href="[^"]*"/g, "")).not.toMatch(/interna|aluno-interno/);
});

it("sem identificação no alcance, a tela segue sem o cabeçalho do registro", async () => {
  mocks.sessao.mockResolvedValue(usuario);
  mocks.consultar.mockResolvedValue(dados());
  mocks.identificacao.mockResolvedValue(null);
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "repo/1?" }) }));
  expect(html).not.toContain("Aluno e reposição desta troca");
  expect(html).toContain("Adotar publicação corrigida na reposição");
});

it("não consulta a reposição quando o guard falha", async () => {
  mocks.sessao.mockRejectedValue(new Error("acesso negado"));
  await expect(Page({ params: Promise.resolve({ id: "repo" }) })).rejects.toThrow("acesso negado");
  expect(mocks.consultar).not.toHaveBeenCalled();
  expect(mocks.preferencia).not.toHaveBeenCalled();
  expect(mocks.identificacao).not.toHaveBeenCalled();
});
