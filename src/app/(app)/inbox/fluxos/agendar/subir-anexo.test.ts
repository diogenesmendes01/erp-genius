import {afterEach,expect,it,vi} from "vitest";
import {subirAnexoAgendamento} from "./subir-anexo";
afterEach(()=>vi.unstubAllGlobals());
const arquivo=(tamanho:number)=>({name:"foto.png",size:tamanho,type:"image/png"}) as unknown as File;
class FormDataFake{campos:[string,unknown][]=[];append(k:string,v:unknown){this.campos.push([k,v]);}}
it("sobe pelo uploader da inbox com o atendimento e devolve url e nome",async()=>{
 vi.stubGlobal("FormData",FormDataFake);const f=vi.fn().mockResolvedValue({ok:true,json:async()=>({url:"/api/files/whatsapp-out/u/1.png",nome:"foto.png"})});vi.stubGlobal("fetch",f);
 expect(await subirAnexoAgendamento("a",arquivo(10))).toEqual({ok:true,dado:{url:"/api/files/whatsapp-out/u/1.png",nome:"foto.png"}});
 expect(f).toHaveBeenCalledWith("/api/whatsapp/upload",expect.objectContaining({method:"POST"}));expect((f.mock.calls[0][1].body as FormDataFake).campos).toContainEqual(["atendimentoId","a"]);
});
it("arquivo vazio ou grande não sobe; erro do servidor volta como erro",async()=>{
 vi.stubGlobal("FormData",FormDataFake);const f=vi.fn().mockResolvedValue({ok:false,json:async()=>({erro:"Tipo não suportado."})});vi.stubGlobal("fetch",f);
 expect(await subirAnexoAgendamento("a",arquivo(0))).toEqual({ok:false,erro:"Arquivo vazio ou acima de 10MB."});
 expect(await subirAnexoAgendamento("a",arquivo(11*1024*1024))).toEqual({ok:false,erro:"Arquivo vazio ou acima de 10MB."});
 expect(f).not.toHaveBeenCalled();
 expect(await subirAnexoAgendamento("a",arquivo(10))).toEqual({ok:false,erro:"Tipo não suportado."});
});
