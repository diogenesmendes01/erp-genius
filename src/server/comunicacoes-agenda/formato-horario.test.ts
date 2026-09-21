import { expect, it } from "vitest";
import { formatarIntervaloAvisoAgenda } from "./formato-horario";

it("mostra a data de término quando o aviso atravessa meia-noite no fuso do encontro", () => {
  const texto = formatarIntervaloAvisoAgenda(new Date("2099-10-11T02:00:00.000Z"), new Date("2099-10-11T04:00:00.000Z"), "America/Sao_Paulo");
  expect(texto).toContain("10/10/2099");
  expect(texto).toContain("11/10/2099");
  expect(texto).toContain("America/Sao_Paulo");
});
