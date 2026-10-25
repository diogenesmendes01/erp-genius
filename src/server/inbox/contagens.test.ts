import { describe, expect, it, vi } from "vitest";
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));vi.mock("@/lib/auth",()=>({auth:vi.fn()}));
import { contagemSegura } from "./contagens";
describe("COUNT bigint para DTO344",()=>{
  it.each([0n,1n,BigInt(Number.MAX_SAFE_INTEGER)])("conserva inteiro seguro %s",v=>expect(contagemSegura(v)).toBe(Number(v)));
  it.each([-1n,BigInt(Number.MAX_SAFE_INTEGER)+1n,1,NaN,"1",null])("recusa valor não seguro/inesperado %s",v=>expect(()=>contagemSegura(v)).toThrow());
});
