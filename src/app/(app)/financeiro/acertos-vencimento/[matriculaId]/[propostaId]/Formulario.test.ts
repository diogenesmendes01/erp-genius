import { afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ estado: vi.fn(), ref: vi.fn(), preparar: vi.fn(), decidir: vi.fn(), aplicar: vi.fn(), atualizar: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: m.estado, useRef: m.ref }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.atualizar }) }));
vi.mock("@/server/contratos/vencimento-aditivo", () => ({ proporVencimentoAditivo: m.preparar, decidirVencimentoAditivo: m.decidir, aplicarVencimentoAditivo: m.aplicar }));
import { VencimentoFormulario } from "./Formulario";
function montar() {
 const setters = [vi.fn(), vi.fn(), vi.fn()];
 m.estado.mockReturnValueOnce([false,setters[0]]).mockReturnValueOnce(["",setters[1]]).mockReturnValueOnce([false,setters[2]]);
 const envio = { current: false }, tentativa = { current: null as any };
 m.ref.mockReturnValueOnce(envio).mockReturnValueOnce(tentativa);
 let motivo = "Conferência financeira", evidencia = "Contrato assinado";
 vi.stubGlobal("FormData", class { get(nome: string) { return nome === "motivo" ? motivo : evidencia; } });
 const arvore = VencimentoFormulario({ modo: "preparar", matriculaId: "m", versaoCondicoesId: "v", revisaoHash: "hash" });
 const enviar = () => arvore.props.onSubmit({ preventDefault() {}, currentTarget: {} });
 return { enviar, envio, tentativa, setters, alterar: () => { motivo = "Dados corrigidos"; evidencia = "Outra evidência"; } };
}
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });
it("preserva chave e entrada após resultado incerto, mesmo com campos alterados", async () => {
 m.preparar.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ ok: true });
 const c = montar(); await c.enviar(); c.alterar(); await c.enviar();
 expect(m.preparar.mock.calls[0][0]).toEqual(m.preparar.mock.calls[1][0]);
 expect(c.setters[2]).toHaveBeenCalledWith(true); expect(c.tentativa.current).not.toBeNull();
 expect(m.atualizar).toHaveBeenCalledTimes(1);
});
it("rejeição conhecida permite corrigir a entrada com nova chave", async () => {
 m.preparar.mockResolvedValueOnce({ ok: false, erro: "Corrigir", podeRevisar: true }).mockResolvedValueOnce({ ok: true });
 const c = montar(); await c.enviar(); expect(c.tentativa.current).toBeNull(); c.alterar(); await c.enviar();
 expect(m.preparar.mock.calls[1][0].motivo).toBe("Dados corrigidos");
 expect(m.preparar.mock.calls[1][0].chaveIdempotencia).not.toBe(m.preparar.mock.calls[0][0].chaveIdempotencia);
});
it("não dispara submissão concorrente antes da próxima renderização", async () => {
 let concluir!: (valor: unknown) => void;
 m.preparar.mockImplementation(() => new Promise(resolve => { concluir = resolve; }));
 const c = montar(); const primeira = c.enviar(); await c.enviar();
 expect(m.preparar).toHaveBeenCalledTimes(1); concluir({ ok: true }); await primeira;
 expect(c.envio.current).toBe(false);
});
