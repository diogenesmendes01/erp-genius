import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from 'playwright-core';
import {esperarConteudoApp, semanticaPainelDetalhesPronto} from './espera-app.mjs';
test('Nova aceita os nomes implícitos dos selects nativos com texto das options', async () => {
 const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:500}});page.setDefaultTimeout(1000);
  await page.setContent('<div role="dialog" aria-label="Nova conversa" style="width:360px"><form><label>Finalidade e destinatário<select><option>Selecione o atendimento</option><option>Secretaria fictícia</option></select></label><label>Canal da escola<select><option>Selecione o canal</option></select></label><button disabled>Abrir atendimento</button></form></div>');
  assert.equal(await page.getByLabel(/^Finalidade e destinatário/).count(),1);
  assert.equal(await page.getByLabel(/^Canal da escola/).count(),1);
  await esperarConteudoApp(page,'nova-conversa','celular');
 } finally {await browser.close();}
});


test('painel318 no DOM Chrome espera tags/abas atuais e rejeita modal oculto ou fora da tela', async () => {
 const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.setContent('<aside aria-label="Painel do contato" style="width:348px;height:700px"><header data-cabecalho-contato><span style="display:block;width:132px;height:132px"></span><h2>Mariana Costa</h2><div id="tags">Adulto Inglês</div></header><button aria-label="Fechar painel do contato" style="width:36px;height:36px">X</button><button role="tab" aria-selected="true">Detalhes</button></aside>');
  assert.equal(await page.evaluate(semanticaPainelDetalhesPronto),false);
  await page.locator('#tags').evaluate(e=>e.insertAdjacentHTML('beforeend','<span><i aria-label="Criada pela Aria"></i>Noite</span>'));
  assert.equal(await page.evaluate(semanticaPainelDetalhesPronto),true);
  await page.locator('aside').evaluate(e=>e.insertAdjacentHTML('beforeend','<button role="tab" id="futura">Insights</button>'));
  assert.equal(await page.evaluate(semanticaPainelDetalhesPronto),false);await page.locator('#futura').evaluate(e=>e.remove());
  await page.locator('aside').evaluate(e=>e.inert=true);assert.equal(await page.evaluate(semanticaPainelDetalhesPronto),false);await page.locator('aside').evaluate(e=>e.inert=false);
  await page.locator('aside').evaluate(e=>e.style.height='900px');assert.equal(await page.evaluate(semanticaPainelDetalhesPronto),false);
 } finally {await browser.close();}
});
