import { afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ state: vi.fn(), preparar: vi.fn(), push: vi.fn(), tarefas: [] as Promise<unknown>[] }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: m.state, useId: () => "teste", useSyncExternalStore: () => "UTC", useTransition: () => [false, (acao: () => Promise<unknown>) => m.tarefas.push(acao())] }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("@/server/contratos/aditivos", () => ({ prepararAditivoContratual: m.preparar, decidirAditivoContratual: vi.fn() }));
import { PrepararAditivo } from "./Formularios";

afterEach(() => vi.unstubAllGlobals());
function montar(escolha: string, tentativa: string | null = null, data = "2026-11-03", cobertura = true) {
  vi.clearAllMocks(); m.tarefas.length = 0;
  const mensagem = vi.fn(), registrarTentativa = vi.fn();
  vi.stubGlobal("crypto", { randomUUID: () => "chave-nova" });
  const entradas: Record<string, string> = { vigencia: "2026-10-01T10:00", motivo: "Ajuste contratual conferido", referenciaCiclo: "CICLO_MATRICULA", dataReferenciaCiclo: data };
  for (const campo of cobertura ? ["COBERTURA_INICIO", "COBERTURA_FIM"] : ["ALUNO_NOME"]) entradas[`alterar:${campo}`] = "on";
  vi.stubGlobal("FormData", class { get(chave: string) { return entradas[chave] ?? null; } });
  m.state.mockReturnValueOnce(["", mensagem]).mockReturnValueOnce(["chave-original", vi.fn()]).mockReturnValueOnce([tentativa, registrarTentativa])
    .mockReturnValueOnce([escolha, vi.fn()]).mockReturnValueOnce(["modelo", vi.fn()])
    .mockReturnValueOnce([{ COBERTURA_INICIO: { tipo: "DATA", data: "2026-11-01" }, COBERTURA_FIM: { tipo: "DATA", data: "2026-11-30" }, ALUNO_NOME: { tipo: "TEXT", texto: "Nome corrigido" } }, vi.fn()]);
  m.preparar.mockResolvedValue({ ok: true, dado: { id: "proposta" } });
  const campos = cobertura ? ["COBERTURA_INICIO", "COBERTURA_FIM"] as const : ["ALUNO_NOME"] as const;
  const arvore = PrepararAditivo({ matriculaId: "matricula", fonte: { conclusaoId: "assinatura", conclusaoHash: "a".repeat(64), campos: campos.map(origem => ({ origem, rotulo: origem, anterior: "Anterior" })) }, modelos: [{ id: "modelo", codigo: "AD", versao: 1, modeloHash: "b".repeat(64), titulo: "Modelo" }] });
  return { mensagem, registrarTentativa, async enviar() { arvore.props.onSubmit({ preventDefault() {}, currentTarget: {} }); await Promise.all(m.tarefas); } };
}
it("envia referência e data aprováveis no payload e na identidade da tentativa", async () => {
  const c = montar("MUDAR_REFERENCIA"); await c.enviar();
  expect(m.preparar).toHaveBeenCalledWith(expect.objectContaining({ cicloCoberturaFutura: { escolha: "MUDAR_REFERENCIA", referencia: "CICLO_MATRICULA", dataReferencia: "2026-11-03" }, chaveIdempotencia: "chave-original" }));
  expect(JSON.parse(c.registrarTentativa.mock.calls[0][0]).cicloCoberturaFutura.dataReferencia).toBe("2026-11-03");
});
it("exige escolha e data real antes de enviar cobertura", async () => {
  for (const [escolha, data] of [["", "2026-11-03"], ["MUDAR_REFERENCIA", "2026-02-30"]]) {
    const c = montar(escolha, null, data); await c.enviar(); expect(m.preparar).not.toHaveBeenCalled(); expect(c.mensagem).toHaveBeenCalledWith(expect.stringContaining("referência válida"));
  }
});
it("mudança de política troca a chave e não afeta aditivo sem cobertura", async () => {
  const c = montar("PRESERVAR_REFERENCIA", "conteúdo anterior"); await c.enviar();
  expect(m.preparar.mock.calls[0][0]).toMatchObject({ chaveIdempotencia: "chave-nova", cicloCoberturaFutura: { escolha: "PRESERVAR_REFERENCIA" } });
  const outro = montar("MUDAR_REFERENCIA", null, "", false); await outro.enviar();
  expect(m.preparar).toHaveBeenCalledOnce(); expect(m.preparar.mock.calls[0][0]).not.toHaveProperty("cicloCoberturaFutura");
});
