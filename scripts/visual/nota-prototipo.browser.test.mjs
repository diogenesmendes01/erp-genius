import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {chromium} from 'playwright-core';

// Executa o preparador real extraído da CLI. Evita importar main() e abrir app/DB.
const codigo=await readFile(new URL('./capturar-inbox.mjs',import.meta.url),'utf8');
const ast=ts.createSourceFile('capturar-inbox.mjs',codigo,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const declaracao=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='abrirPrototipo');
assert.ok(declaracao,'preparador real da CLI precisa existir');
const abrirPrototipo=new Function('pathToFileURL','prototipo',declaracao.getText(ast)+'; return abrirPrototipo;')(pathToFileURL,'/fixture-local-nao-navegada.html');

test('nota usa botão real com texto exato apesar do glifo no nome acessível',async()=>{
 const b=await chromium.launch({executablePath:process.env.PW_CHROMIUM??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const p=await b.newPage();p.setDefaultTimeout(700);
  await p.setContent('<style>.icon-lock::before{content:"\\e10f"}</style><div data-m="root"><main data-m="chat"><footer><button id="nota" onclick="document.querySelector(\'textarea\').placeholder=\'Nota interna · @ para mencionar\'"><i class="icon-lock"></i>Nota interna</button><textarea placeholder="Escreva uma mensagem"></textarea></footer></main></div>');
  const rodape=p.locator('footer');assert.equal(await rodape.getByRole('button',{name:'Nota interna',exact:true}).count(),0);
  assert.equal(await rodape.getByText('Nota interna',{exact:true}).count(),1);
  let cliques=0;await p.exposeFunction('registrarClique317',()=>{cliques++;});await p.locator('#nota').evaluate(e=>e.addEventListener('click',()=>window.registrarClique317()));
  const facade={goto:async()=>{},locator:p.locator.bind(p),waitForTimeout:async()=>{}};
  await abrirPrototipo(facade,'nota');
  assert.equal(await p.getByPlaceholder('Nota interna · @ para mencionar',{exact:true}).count(),1);assert.equal(cliques,1);
 }finally{await b.close();}
});

test('texto solto não é aceito como botão de nota do protótipo',async()=>{
 const b=await chromium.launch({executablePath:process.env.PW_CHROMIUM??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const p=await b.newPage();p.setDefaultTimeout(700);await p.setContent('<div data-m="root"><main data-m="chat"><footer><span>Nota interna</span><textarea placeholder="Escreva uma mensagem"></textarea></footer></main></div>');
  await assert.rejects(abrirPrototipo({goto:async()=>{},locator:p.locator.bind(p),waitForTimeout:async()=>{}},'nota'),/não é um botão/);
 }finally{await b.close();}
});
