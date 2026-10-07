import { afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ estado: vi.fn(), ref: vi.fn(), preparar: vi.fn(), decidir: vi.fn(), aplicar: vi.fn(), atualizar: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: m.estado, useRef: m.ref }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.atualizar }) }));
vi.mock("@/server/contratos/vencimento-aditivo", () => ({ proporVencimentoAditivo: m.preparar, decidirVencimentoAditivo: m.decidir, aplicarVencimentoAditivo: m.aplicar }));
import { VencimentoFormulario } from "./Formulario";
function montar() {
 const setters = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
 m.estado.mockReturnValueOnce([false,setters[0]]).mockReturnValueOnce(["",setters[1]]).mockReturnValueOnce([false,setters[2]]).mockReturnValueOnce([false,setters[3]]);
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
 // A tela mostra "Repetir mesma tentativa" e trava os campos pelo estado, não pelo ref (react-hooks/refs).
 expect(c.setters[3]).toHaveBeenCalledWith(true); expect(c.setters[3]).not.toHaveBeenCalledWith(false);
 expect(m.atualizar).toHaveBeenCalledTimes(1);
});
it("rejeição conhecida permite corrigir a entrada com nova chave", async () => {
 m.preparar.mockResolvedValueOnce({ ok: false, erro: "Corrigir", podeRevisar: true }).mockResolvedValueOnce({ ok: true });
 const c = montar(); await c.enviar(); expect(c.tentativa.current).toBeNull(); expect(c.setters[3]).toHaveBeenLastCalledWith(false); c.alterar(); await c.enviar();
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

// Integração da #151 (B3): o que a tela mostra com a tentativa pendente vem do estado `temTentativa` — campos
// travados (fieldset) e "Repetir mesma tentativa" —, para a pessoa não editar e achar que reenviou outra coisa.
type No = { type?: unknown; props?: Record<string, unknown> };
function achar(no: unknown, tipo: string): No | undefined {
 if (Array.isArray(no)) { for (const n of no) { const r = achar(n, tipo); if (r) return r; } return undefined; }
 if (!no || typeof no !== "object") return undefined;
 const n = no as No; if (n.type === tipo) return n; return achar(n.props?.children, tipo);
}
const texto = (no: unknown): string => typeof no === "string" ? no : Array.isArray(no) ? no.map(texto).join("") : no && typeof no === "object" ? texto((no as No).props?.children) : "";
function renderComTentativa(temTentativa: boolean) {
 m.estado.mockReturnValueOnce([false, vi.fn()]).mockReturnValueOnce(["", vi.fn()]).mockReturnValueOnce([false, vi.fn()]).mockReturnValueOnce([temTentativa, vi.fn()]);
 m.ref.mockReturnValueOnce({ current: false }).mockReturnValueOnce({ current: null });
 const arvore = VencimentoFormulario({ modo: "preparar", matriculaId: "m", versaoCondicoesId: "v", revisaoHash: "hash" });
 return { travado: achar(arvore, "fieldset")?.props?.disabled, botao: texto(achar(arvore, "button")) };
}
it("tentativa pendente: campos travados e \"Repetir mesma tentativa\"; sem tentativa, editáveis e \"Preparar acerto\"", () => {
 expect(renderComTentativa(true)).toEqual({ travado: true, botao: "Repetir mesma tentativa" });
 expect(renderComTentativa(false)).toEqual({ travado: false, botao: "Preparar acerto" });
});
