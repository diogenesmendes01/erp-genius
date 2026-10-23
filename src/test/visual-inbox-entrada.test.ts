import { expect, it } from "vitest";
import { lerOpcoesDemo } from "../../scripts/visual/demo-inbox";
it("CLI entrada só aceita chave fictícia fechada e não mistura argumentos",()=>{
 expect(lerOpcoesDemo([])).toEqual({entrada:null}); expect(lerOpcoesDemo(["--entrada","thiago"])).toEqual({entrada:"thiago"});
 for(const args of [["--entrada"],["--entrada","produção"],["--entrada","thiago","extra"],["--foo","thiago"]])expect(()=>lerOpcoesDemo(args)).toThrow();
});
