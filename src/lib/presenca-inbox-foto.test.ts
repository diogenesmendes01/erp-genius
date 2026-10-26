import { expect,it } from "vitest";
import { restanteFotoPresenca } from "./presenca-inbox-foto";
it.each([[25000,100,100,25000],[25000,100,10100,15000],[1000,100,1099,1],[1000,100,1100,null],[1000,100,1101,null]])("validade relativa desconta latência desde início request %j",(ttl,inicio,agora,esperado)=>expect(restanteFotoPresenca(ttl,inicio,agora)).toBe(esperado));
it.each([undefined,null,0,-1,25001,NaN,Infinity,"25000"])("validade inválida %j não autoriza status",ttl=>expect(restanteFotoPresenca(ttl,100,200)).toBeNull());
it.each([[NaN,200],[100,NaN],[Infinity,200],[200,100],[-1,100]])("relógio monotônico inválido %j descarta foto",(inicio,agora)=>expect(restanteFotoPresenca(25000,inicio,agora)).toBeNull());
it("não usa hora civil e não adiciona latência no recebimento",()=>{expect(restanteFotoPresenca(2000,500,2400)).toBe(100);expect(restanteFotoPresenca(2000,500,2500)).toBeNull();});
