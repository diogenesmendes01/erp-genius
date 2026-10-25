import { expect,it,vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { assumirAriaNoBanco } from "./assumir-aria";
it.each(["40P01","P2034","outro"])("357 falha %s não é engolida nem recebe retry de phantom",async code=>{
 const erro=Object.assign(Error("Falha da transação"),{code}),transaction=vi.fn().mockRejectedValue(erro);
 const db={$transaction:transaction} as unknown as Pick<PrismaClient,"$transaction">;
 await expect(assumirAriaNoBanco(db,"autor","atendimento")).rejects.toBe(erro);expect(transaction).toHaveBeenCalledOnce();
});
