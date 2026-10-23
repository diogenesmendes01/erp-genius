import assert from 'node:assert/strict';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const raiz = 'output/inbox-313-visual';
const fonte = '4fcdc6cad73c3ad8782405c29db8770122fa8432';
const proto = '2e88216481bd5889070d572e1a867baeec21b668';
const dirs = { formal: raiz+'/formal-final-4fcdc6ca', virtual: raiz+'/virtual-atual-4fcdc6ca-2026-10-23T03-31-56.270Z', complemento: raiz+'/complemento-publico-atual-2026-10-23T03-33-08.092Z' };
const json = async p => JSON.parse(await readFile(p+'/manifesto.json','utf8'));
const [f,v,c] = await Promise.all([json(dirs.formal),json(dirs.virtual),json(dirs.complemento)]);
assert.equal(f.capturas.length,52); assert.equal(v.fonte,fonte); assert.equal(c.fonte,fonte);
assert.equal(v.resultados.length,6); assert.equal(c.resultados.length,4);
const png = async (caminho, dados) => {
 const b=await readFile(caminho);
 assert.equal(b.subarray(1,4).toString(),'PNG');
 const tamanho=(await stat(caminho)).size;
 return {...dados,tipo:dados.grupo,arquivo:caminho,fonte:{aplicacao:dados.fonteAplicacao,harness:dados.fonteHarness},caminho,arquivoPacote:dados.grupo+'/'+caminho.split('/').at(-1),bytes:tamanho,width:b.readUInt32BE(16),height:b.readUInt32BE(20),sha256:createHash('sha256').update(b).digest('hex'),inspecao:'favoravel'};
};
const probes={};
for(const [grupo,nome] of [['formal-app','capturar-app-atual.mjs'],['virtual','probe-virtual-atual.mjs'],['complemento','probe-complemento-publico-atual.mjs']]){
 const arquivo=raiz+'/'+nome;
 probes[grupo]={arquivo,sha256:createHash('sha256').update(await readFile(arquivo)).digest('hex'),natureza:'Probe privado local não contido no commit da aplicação; usa helpers compartilhados da fonte4f. Não incluir automaticamente no ZIP.'};
}
const imagens=[];
for(const x of f.capturas){
 assert.equal(x.falhas.length,0);
 assert.equal(x.fonteHarness,x.alvo==='app'?fonte:proto);
 const i=await png(dirs.formal+'/'+x.arquivo,{grupo:x.alvo==='app'?'formal-app':'formal-prototipo',tema:x.tema,tamanho:x.tamanho,estado:x.estado,fonteAplicacao:x.fonteAplicacao,fonteHarness:x.fonteHarness,objetosHarness:x.objetosHarness,anonimizacaoDOM:x.anonimizacao});
 assert.equal(i.sha256,x.sha256);
 imagens.push(i);
}
for(const [grupo,m] of [['virtual',v],['complemento',c]]){
 for(const r of m.resultados){
  assert.equal(r.falhas.length,0);
  for(const arq of r.fotos)imagens.push(await png(dirs[grupo]+'/'+arq,{grupo,tema:r.tema,tamanho:r.tamanho,fonteAplicacao:fonte,fonteHarness:fonte}));
 }
}
assert.equal(imagens.length,90);
assert.equal(new Set(imagens.map(i=>i.arquivoPacote)).size,90);
for(const i of imagens)if(probes[i.grupo])i.probePrivado=probes[i.grupo];
const comum={fonteAplicacao:fonte,fontePrototipo:proto,politica:'Somente PNGs fictícias positivas inspecionadas. Proibido incluir HTML, RSC, raw, logs, traces, cookies, snapshots, seeds, negativos, arquivos não listados ou diretórios inteiros. ZERO novos binários no Git. Empacotamento e depósito remoto pelo integrador.',pendencias:['Depósito remoto confirmado e URL pelo integrador','Revisão final/publicação pelo integrador'],arquivos:imagens};
await writeFile(raiz+'/allowlist-final-4fcdc6ca.json',JSON.stringify({...comum,totais:{formalApp:26,formalPrototipo:26,virtual:18,complemento:20,total:90,bytes:imagens.reduce((s,i)=>s+i.bytes,0)}},null,2)+'\n');
const contexto = r => ({tema:r.tema,tamanho:r.tamanho,width:r.width,height:r.height,falhas:0});
const linha = x=>x?({indice:x.indice,top:x.top,bottom:x.bottom,height:x.height,width:x.width}):null;
const medicao = p=>({fase:p.fase,scrollTop:p.scrollTop,altura:p.altura,largura:p.largura,totalVirtual:p.virtual,linhasMontadas:p.linhas.length,alturasDistintas:[...new Set(p.linhas.map(x=>x.height))],primeiraVisivel:linha(p.linhas.find(x=>x.visivel)),ultimaVisivel:linha(p.linhas.filter(x=>x.visivel).at(-1)),selecionadas:p.linhas.filter(x=>x.selecionado).map(linha)});
const resumo={
 fonteAplicacao:fonte,fontePrototipo:proto,
 formal:{sessao:43844,exit:0,totais:f.totais,estados:['conversa','filtros','seletor-numero','nova-conversa','celular-lista'],inspecao:'26APP atuais inspecionadas em5pranchas;26protos imutáveis já inspecionados e hashes revalidados. Todos estados corretos. Seis GETs cancelados e recuperados pelo classificador existente; zero falhas.',fontesSeparadas:true},
 virtual:{sessao:10555,exit:0,limite:'Prova com150individuais fictícios existentes e filtro explícito; nenhum SQL/seed do DEV. Não comprova centralização da linha35; comprova seleção mantida, foco visível e geometria/âncora observadas.',contextos:v.resultados.map(r=>({...contexto(r),chips:r.chips,fases:r.fases.map(medicao),focos:r.focos.map(p=>({sentido:p.sentido,indiceFocado:Number(p.ativo?.match(/virtual-(\d+)-/)?.[1]),...medicao({...p,fase:'foco'}),tipografia:p.mono}))}))},
 complemento:{sessao:15517,exit:0,limite:'Cliques reais de linha/Link público, sem esperar POSTs assentarem antes de navegar. Após Link, captura aguarda apenas animações CSS finitas/Drawer fora da viewport. Nenhum submit/criação/envio real, nem escrita direta DB; submit mockado tem testes próprios. Não é E2E de actionNova.',contextos:c.resultados.map(r=>({...contexto(r),checks:r.checks,documentosHTTP:r.documentos.length,documentosTrace:[...new Set(r.tracePersistente.map(t=>t.documento).filter(Number.isFinite))].length,mesmoDocumentoInicial:r.tracePersistente.find(t=>Number.isFinite(t.documento))?.documento===r.navegacaoFinal.documento,linkPublico:r.linkPublico,modoNavegacao:r.modoNavegacao,rotaFinal:new URL(r.navegacaoFinal.url).pathname,focoFinal:r.navegacaoFinal.foco,sse:r.sse,diagnosticos:r.diagnosticos.length}))},
 gatesDev:{recorte:{log:'output/inbox-313-base-388-unit.log',arquivos:16,testes:369,exit:0},typescript:{sessao:11375,heapMB:8192,exit:0},lint:{sessao:'a60e94',arquivos:6,exit:0}},
 gatesIntegrador:{atribuicao:'Relato do integrador exato4f, não execução global pelo DEV',global:{sessao:37524,arquivos:877,testes:6854,exit:0},typescript:{sessao:95820,exit:0},lint:{sessao:47827,exit:0,avisosSrcHerdados:40,avisosStagingPrivado:2}},
 negativos:'Preservados localmente e excluídos desta allowlist/pacote. Comparações antigas dd141/9c e complemento20f51 são históricas; não atribuídas a4f. CorposRSC e traces causais permanecem privados, sem Git/ZIP.',
 inspecao:'Favorável em todas64PNGsAPP atuais;26protos históricos por hash imutável. Não há homologação presumida.',
};
await writeFile(raiz+'/resumo-final-4fcdc6ca.json',JSON.stringify(resumo,null,2)+'\n');
console.log(JSON.stringify({total:imagens.length,bytes:imagens.reduce((s,i)=>s+i.bytes,0),grupos:imagens.reduce((s,i)=>(s[i.grupo]=(s[i.grupo]??0)+1,s),{})}));


const arquivoResumo=raiz+'/resumo-final-4fcdc6ca.json';
const resumoBytes=await readFile(arquivoResumo);
const allowPath=raiz+'/allowlist-final-4fcdc6ca.json';
const allow=JSON.parse(await readFile(allowPath,'utf8'));
allow.metadados=[{arquivo:arquivoResumo,arquivoPacote:'resumo-final.json',bytes:resumoBytes.length,sha256:createHash('sha256').update(resumoBytes).digest('hex'),tipo:'resumo-sanitizado',fonte}];
await writeFile(allowPath,JSON.stringify(allow,null,2)+'\n');
