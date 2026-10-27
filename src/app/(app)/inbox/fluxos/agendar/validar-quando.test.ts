import {expect,it} from "vitest";
import {validarQuando} from "./validar-quando";
const agora=new Date("2026-10-22T13:30Z");
it("horário futuro é interpretado no fuso declarado",()=>{expect(validarQuando("2026-10-22T11:00","America/Sao_Paulo",agora)).toBeNull();});
it("campo incompleto e passado ou instante igual recusam antes da action",()=>{
 expect(validarQuando("","America/Sao_Paulo",agora)).toBe("Escolha o dia e a hora do envio.");
 for(const quando of ["2026-10-22T10:29","2026-10-22T10:30"])expect(validarQuando(quando,"America/Sao_Paulo",agora)).toBe("Esse horário já passou. Escolha uma data e hora no futuro.");
});
it.each(["2026-03-08T02:30","2026-11-01T01:30"])("GAP/FOLD canônico recusa%s sem escolher offset",quando=>{expect(validarQuando(quando,"America/New_York",new Date("2026-01-01Z"))).toMatch(/não existe|se repete/);});
it("data impossível e fuso inválido conservam erro canônico",()=>{expect(validarQuando("2026-02-31T09:00","UTC",agora)).toMatch(/Data inexistente/);expect(validarQuando("2035-01-01T09:00","invalido",agora)).toMatch(/fuso válido/);});