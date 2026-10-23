import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";
import { anonimizarTelefonesNoDom } from "./anonimizar-telefones.mjs";

test("anonimiza telefones no DOM renderizado sem alterar scripts, estilos ou dados fictícios", async () => {
  assert.ok(process.env.PW_CHROMIUM, "Defina PW_CHROMIUM para um Chrome local; não baixa navegador.");
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, headless: true });
  try {
    const pagina = await browser.newPage();
    await pagina.setContent(`<style>p { color: red }</style>
      <script type="application/json" id="original">{"telefone":"+5511984213307"}</script>
      <p id="nome">Mariana Costa</p><p id="telefone">+55 11 98421-3307</p>
      <p id="linha">+55 11 4002-8922</p><p id="b2b">+55 11 34321-1234</p>
      <p id="fake">+5500000000301</p><p id="falso">Data 2026-10-22, preço R$ 55,11</p>
      <a id="link" href="tel:+5511984213307" aria-label="Ligar +55 (11) 98421-3307">Ligar</a>
      <input id="campo" value="+5511984213307" placeholder="+55 11 98421-3307" title="Telefone +5511984213307">`);
    await pagina.locator("#campo").fill("+55 (11) 98421-3307");
    const original = await pagina.locator("#original").textContent();
    const estilo = await pagina.locator("style").textContent();
    const r = await pagina.evaluate(anonimizarTelefonesNoDom);
    const telefone = await pagina.locator("#telefone").textContent();
    assert.match(telefone, /^\+5500\d{9}$/);
    assert.equal(await pagina.locator("#link").getAttribute("href"), `tel:${telefone}`);
    assert.equal(await pagina.locator("#link").getAttribute("aria-label"), `Ligar ${telefone}`);
    assert.equal(await pagina.locator("#campo").inputValue(), telefone);
    assert.equal(await pagina.locator("#campo").getAttribute("value"), telefone);
    assert.equal(await pagina.locator("#campo").getAttribute("placeholder"), telefone);
    assert.equal(await pagina.locator("#campo").getAttribute("title"), `Telefone ${telefone}`);
    assert.match(await pagina.locator("#linha").textContent(), /^\+5500\d{9}$/);
    assert.notEqual(await pagina.locator("#linha").textContent(), telefone);
    assert.match(await pagina.locator("#b2b").textContent(), /^\+5500\d{9}$/);
    assert.equal(await pagina.locator("#fake").textContent(), "+5500000000301");
    assert.equal(await pagina.locator("#nome").textContent(), "Mariana Costa");
    assert.equal(await pagina.locator("#falso").textContent(), "Data 2026-10-22, preço R$ 55,11");
    assert.equal(await pagina.locator("#original").textContent(), original);
    assert.equal(await pagina.locator("style").textContent(), estilo);
    assert.equal(r.substituicoes, 9);
    assert.ok(!JSON.stringify(r).includes("98421"), "Manifesto não contém os valores originais.");
    assert.equal((await pagina.evaluate(anonimizarTelefonesNoDom)).substituicoes, 0);
  } finally { await browser.close(); }
});
