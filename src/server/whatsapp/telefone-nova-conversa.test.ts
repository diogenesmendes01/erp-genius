import { describe, expect, it } from "vitest";
import { normalizarNumeroNovaConversa } from "./telefone-nova-conversa";
import { telefoneE164 } from "@/server/_shared/validacao";

describe("D9 número internacional explícito, sem inferir país", () => {
 it.each(["+5511981113344", "+50688889999", "+525512345678", "+541112345678", "+56912345678", "+573001234567"])("preserva formato internacional LatAm %s", numero => {
  expect(normalizarNumeroNovaConversa(numero)).toBe(numero);
 });
 it("aceita separadores visuais sem duplicar DDI", () => {
  expect(normalizarNumeroNovaConversa("  +55 (11) 98111-3344  ")).toBe("+5511981113344");
  expect(normalizarNumeroNovaConversa("+506 8888-9999")).toBe("+50688889999");
 });
 it.each(["11981113344", "005511981113344", "+05511981113344", "+55ABC11981113344", "+55 11 98111-3344 ramal 2", "++5511981113344", "", " ", "+", "+55119811133445678", "+55\n11981113344"])("recusa entrada não canônica sem inventar país: %j", numero => {
  expect(normalizarNumeroNovaConversa(numero)).toBeNull();
 });
 it("usa limites do validador compartilhado, não mínimo dez da busca histórica", () => {
  for(const numero of ["+506888899", "+12", "+123456789012345"]){
   expect(telefoneE164.safeParse(numero).success).toBe(true);expect(normalizarNumeroNovaConversa(numero)).toBe(numero);
  }
 });
 it("formatos equivalentes produzem o mesmo telefone para hash/idempotência", () => {
  expect(normalizarNumeroNovaConversa("+55 (11) 98111-3344")).toBe(normalizarNumeroNovaConversa("+5511981113344"));
 });
});
