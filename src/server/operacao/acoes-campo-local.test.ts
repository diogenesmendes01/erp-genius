import { beforeEach, describe, expect, it, vi } from "vitest";

// Lote 3 do fuso pessoal nas telas: as ações `*-local` recebem o texto do datetime-local e o fuso escrito ao lado do
// campo, convertem NO SERVIDOR e só então chamam a ação de origem com o instante ISO. Fuso inválido ou texto
// incompleto voltam como erro, sem chamar a origem. Expectativas fixas: passam em TZ=UTC e America/Sao_Paulo.
const m = vi.hoisted(() => ({ origem: vi.fn(async (entrada: unknown) => ({ ok: true as const, dado: entrada })) }));
vi.mock("@/server/diario/reposicao-individual", () => ({ concluirReposicaoIndividual: m.origem, proporCorrecaoConclusaoReposicao: m.origem }));
vi.mock("@/server/diario/reposicao-entrega-operacional", () => ({ prorrogarEtapaOperacional: m.origem, liberarEntregaOperacional: m.origem }));
vi.mock("@/server/diario/chamada", () => ({ listarAlunosParaChamada: m.origem }));
vi.mock("@/server/diario/acoes", () => ({ salvarAulaDiario: m.origem }));
vi.mock("@/server/financeiro/acoes", () => ({ publicarPoliticaComissao: m.origem }));
vi.mock("@/server/contratos/aditivos", () => ({ prepararAditivoContratual: m.origem }));
vi.mock("@/server/contratos/agenda-aditivo", () => ({ consultarConferenciaAgendaAditivo: m.origem }));

import { concluirReposicaoGravadaLocal, liberarEntregaOperacionalLocal, prorrogarEtapaOperacionalLocal, proporCorrecaoGravadaLocal } from "@/server/diario/reposicao-local";
import { listarAlunosParaChamadaLocal, salvarAulaDiarioLocal } from "@/server/diario/diario-local";
import { publicarPoliticaComissaoLocal } from "@/server/financeiro/politica-comissao-local";
import { prepararAditivoContratualLocal } from "@/server/contratos/aditivos-local";
import { consultarConferenciaAgendaAditivoLocal } from "@/server/contratos/agenda-aditivo-local";

beforeEach(() => m.origem.mockClear());
const ERRO_FUSO = { ok: false, erro: expect.stringMatching(/fuso válido/) };

describe("ações *-local: conversão explícita no servidor", () => {
  it("reposições: validação, correção, prorrogação e liberação no fuso da tela (com virada do dia)", async () => {
    await concluirReposicaoGravadaLocal({ reposicaoId: "r", versaoAnterior: 1, entregaId: "e", validadaLocal: "2026-10-21T22:30:15", fuso: "America/Sao_Paulo", evidencia: "Evidência" });
    expect(m.origem).toHaveBeenLastCalledWith({ reposicaoId: "r", versaoAnterior: 1, entregaId: "e", validadaEm: "2026-10-22T01:30:15.000Z", evidencia: "Evidência" });
    await proporCorrecaoGravadaLocal({ reposicaoId: "r", conclusaoId: "c", versaoAnterior: 0, concluida: true, entregaId: "e", validadaLocal: "2026-10-21T10:00", fuso: "America/Costa_Rica", motivo: "Motivo", evidencia: "Evidência" });
    expect(m.origem).toHaveBeenLastCalledWith(expect.objectContaining({ validadaEm: "2026-10-21T16:00:00.000Z" }));
    await prorrogarEtapaOperacionalLocal({ reposicaoId: "r", solicitacaoCorrecaoId: null, prazoAnterior: "2026-10-20T03:00:00.000Z", novoPrazoLocal: "2026-10-25T23:59", fuso: "America/Sao_Paulo", motivo: "Motivo" });
    expect(m.origem).toHaveBeenLastCalledWith(expect.objectContaining({ novoPrazo: "2026-10-26T02:59:00.000Z" }));
    await liberarEntregaOperacionalLocal({ reposicaoId: "r", expiraLocal: "2026-10-25T08:00", fuso: "UTC", motivo: "Motivo" });
    expect(m.origem).toHaveBeenLastCalledWith({ reposicaoId: "r", expiraEm: "2026-10-25T08:00:00.000Z", motivo: "Motivo" });
  });

  it("diário, comissão, aditivo e agenda do aditivo", async () => {
    await listarAlunosParaChamadaLocal({ turmaId: "t", ocorridaLocal: "2026-10-21T19:00", fuso: "America/Sao_Paulo" });
    expect(m.origem).toHaveBeenLastCalledWith({ turmaId: "t", ocorridaEm: "2026-10-21T22:00:00.000Z" });
    await salvarAulaDiarioLocal({ turmaId: "t", ocorridaLocal: "2026-10-21T19:00", fuso: "America/Sao_Paulo", conteudo: "c", registros: [] });
    expect(m.origem).toHaveBeenLastCalledWith(expect.objectContaining({ ocorridaEm: "2026-10-21T22:00:00.000Z" }));
    await publicarPoliticaComissaoLocal({ paisId: "p", produtoId: "x", tipo: "PERCENTUAL", percentual: 5, valorFixo: null, moeda: "CRC", vigenciaLocal: "2026-11-01T00:00", fuso: "America/Costa_Rica" });
    expect(m.origem).toHaveBeenLastCalledWith(expect.objectContaining({ vigenteEm: new Date("2026-11-01T06:00:00.000Z") }));
    await prepararAditivoContratualLocal({ vigenciaLocal: "2026-11-01T00:00", fusoVigencia: "America/Sao_Paulo" } as never);
    expect(m.origem).toHaveBeenLastCalledWith(expect.objectContaining({ vigenciaInicio: "2026-11-01T03:00:00.000Z" }));
    await consultarConferenciaAgendaAditivoLocal({ matriculaId: "m", alteracoes: [{ encontroId: "e", professorNovoId: "p", fusoOrigem: "America/Sao_Paulo", inicioLocal: "2026-11-01T22:30", fimLocal: "2026-11-01T23:30" }] });
    expect(m.origem).toHaveBeenLastCalledWith({ matriculaId: "m", encontros: [{ encontroId: "e", professorNovoId: "p", inicioNovo: "2026-11-02T01:30:00.000Z", fimNovo: "2026-11-02T02:30:00.000Z", duracaoMinutos: 60, fusoOrigem: "America/Sao_Paulo" }] });
  });

  it("vigência vazia da comissão = agora (relógio do servidor)", async () => {
    const antes = Date.now();
    await publicarPoliticaComissaoLocal({ paisId: "p", produtoId: "x", tipo: "PERCENTUAL", percentual: 5, valorFixo: null, moeda: "CRC", vigenciaLocal: "", fuso: "America/Sao_Paulo" });
    const vigente = (m.origem.mock.calls.at(-1)![0] as { vigenteEm: Date }).vigenteEm.getTime();
    expect(vigente).toBeGreaterThanOrEqual(antes);
  });

  it("fuso inválido/ausente ou texto incompleto: erro legível e a origem não é chamada", async () => {
    expect(await concluirReposicaoGravadaLocal({ reposicaoId: "r", versaoAnterior: 1, entregaId: "e", validadaLocal: "2026-10-21T10:00", fuso: "Lua/Base", evidencia: "e" })).toEqual(ERRO_FUSO);
    expect(await salvarAulaDiarioLocal({ turmaId: "t", ocorridaLocal: "2026-10-21T10:00", fuso: "", conteudo: "c", registros: [] })).toEqual(ERRO_FUSO);
    expect(await listarAlunosParaChamadaLocal({ turmaId: "t", ocorridaLocal: "2026-10-21", fuso: "UTC" })).toEqual({ ok: false, erro: "Informe data e hora completas." });
    expect(await consultarConferenciaAgendaAditivoLocal({ matriculaId: "m", alteracoes: [{ encontroId: "e", professorNovoId: "p", fusoOrigem: "America/New_York", inicioLocal: "2026-03-08T02:30", fimLocal: "2026-03-08T03:30" }] }))
      .toEqual({ ok: false, erro: expect.stringMatching(/não existe em America\/New_York/) });
    expect(m.origem).not.toHaveBeenCalled();
  });
});
