import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { autenticarApp } from './espera-app.mjs';
import { configurarEntrada, abrirEntradaApp } from './entradas-inbox.mjs';

test('Contatos320 conserva documento contido, atalhos44 e Nova oportunidade alcançável', async () => {
  const base = process.env.INBOX_VISUAL_BASE;
  assert.ok(base && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base), 'Exige preview local coordenado.');
  assert.ok(process.env.INBOX_VISUAL_EMAIL && process.env.INBOX_VISUAL_SENHA && process.env.PW_CHROMIUM, 'Exige login fictício e Chrome local.');
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, headless: true });
  try {
    const contexto = await browser.newContext({ viewport: { width: 320, height: 500 }, locale: 'pt-BR' });
    try {
      await autenticarApp(contexto, base, process.env.INBOX_VISUAL_EMAIL, process.env.INBOX_VISUAL_SENHA);
      const pagina = await contexto.newPage();
      await abrirEntradaApp(pagina, base, configurarEntrada('entrada-contatos'));
      assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth), 320);
      const controle = pagina.getByRole('button', { name: 'Nova oportunidade', exact: true });
      const caixa = await controle.boundingBox();
      assert.ok(caixa && caixa.x >= 0 && caixa.x + caixa.width <= 321 && caixa.y >= 0 && caixa.y + caixa.height <= 501, 'Ação inteira no viewport, sem ocultá-la.');
      let alcancavel = false;
      for (let n = 0; n < 100; n++) {
        await pagina.keyboard.press('Tab');
        if (await controle.evaluate(e => e === document.activeElement)) { alcancavel = true; break; }
      }
      assert.ok(alcancavel, 'Ação existente alcançável por Tab, sem executá-la.');
    } finally { await contexto.close(); }
  } finally { await browser.close(); }
});
