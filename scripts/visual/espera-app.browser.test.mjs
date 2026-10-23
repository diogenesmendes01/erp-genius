import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from 'playwright-core';
import {esperarConteudoApp} from './espera-app.mjs';
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
