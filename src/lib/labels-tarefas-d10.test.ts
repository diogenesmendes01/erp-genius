import {expect,it} from "vitest";
import {PrioridadeTarefa} from "@prisma/client";
import {PRIORIDADE_TAREFA_LABEL,rotular} from "./labels";
it("prioridade central cobre enum preparado e mostra Baixa sem enum cru",()=>{expect(Object.keys(PRIORIDADE_TAREFA_LABEL).sort()).toEqual(Object.values(PrioridadeTarefa).sort());expect(rotular(PRIORIDADE_TAREFA_LABEL,PrioridadeTarefa.BAIXA)).toBe("Baixa");expect(Object.isFrozen(PRIORIDADE_TAREFA_LABEL)).toBe(true);});