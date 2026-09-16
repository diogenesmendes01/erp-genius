import { it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { conferirConflitosReplanejamento } from "./replanejamento-conflitos";
const p = (id: string, turmaId: string, inicio = "2099-10-01T10:00:00Z", fim = "2099-10-01T11:00:00Z") => ({ encontroId: id, turmaId, professorId: "prof", inicio, fim });
function banco() {
 const db = { encontroAgenda: { findMany: vi.fn().mockResolvedValue([]) }, indisponibilidadeDocente: { findMany: vi.fn().mockResolvedValue([]) }, usuario: { findMany: vi.fn().mockResolvedValue([{id:"prof"}]) } };
 return { db, tx: db as unknown as Prisma.TransactionClient };
}
it("detecta professor compartilhado entre turmas e aceita horários consecutivos", async () => {
 const {tx}=banco();
 const r=await conferirConflitosReplanejamento(tx,[p("a","t1"),p("b","t2"),p("c","t3","2099-10-01T11:00:00Z","2099-10-01T12:00:00Z")]);
 expect(r.internos).toEqual([{primeiro:"a",segundo:"b"}]);
});
it("consulta somente horários que permanecem, mantendo conflitos externos e ausências", async () => {
 const {tx,db}=banco();
 db.encontroAgenda.findMany.mockResolvedValue([{id:"particular",turmaId:null,professorId:"prof",inicio:new Date("2099-10-01T10:30:00Z"),fim:new Date("2099-10-01T11:30:00Z")}]);
 db.indisponibilidadeDocente.findMany.mockResolvedValue([{id:"licenca",professorId:"prof",inicio:new Date("2099-10-01T09:00:00Z"),fim:new Date("2099-10-01T12:00:00Z")}]);
 const r=await conferirConflitosReplanejamento(tx,[p("a","t1")]);
 expect(db.encontroAgenda.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id:{notIn:["a"]},status:{in:["PREVISTO","MINISTRADO"]}})}));
 expect(r.externos).toEqual([{encontroPropostoId:"a",encontroExistenteId:"particular"}]);
 expect(r.indisponibilidades).toEqual([{encontroId:"a",indisponibilidadeId:"licenca"}]);
 expect(r.reservasConferidas).toBe(false);
});
it("identifica docente não apto e rejeita intervalo ou identidade inválidos", async () => {
 const {tx,db}=banco(); db.usuario.findMany.mockResolvedValue([]);
 expect((await conferirConflitosReplanejamento(tx,[p("a","t1")])).semDocenteApto).toEqual(["a"]);
 await expect(conferirConflitosReplanejamento(tx,[p("a","t1"),p("a","t2")])).rejects.toThrow("repetido");
 await expect(conferirConflitosReplanejamento(tx,[p("a","t1","invalid")])).rejects.toThrow("inválido");
});
