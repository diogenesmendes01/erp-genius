import {expect,it} from "vitest";
import {modoRodape,textoTravado} from "./modo-rodape";
it.each(["ia","aprovacao","handoff"] as const)("travado_nos_tres_estados_da_aria %s",estado=>expect(modoRodape(estado,false)).toBe("travado"));
it.each(["ia","aprovacao","handoff"] as const)("nota_destrava_so_a_aba_nota %s",estado=>expect(modoRodape(estado,true)).toBe("compositor"));
it.each(["humano",null] as const)("humano_e_sem_estado_usam_o_compositor %s",estado=>expect(modoRodape(estado,false)).toBe("compositor"));
it("textos_travados",()=>{expect([textoTravado("ia"),textoTravado("aprovacao"),textoTravado("handoff")]).toEqual(["Aria está respondendo esta conversa.","Aria aguarda aprovação da sugestão acima.","Aria parou de responder e aguarda um humano."]);});
