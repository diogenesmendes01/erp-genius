// Executar SOMENTE contra a instancia local dedicada, com o banco de teste fixo abaixo.
// Usa login real, sem mock de autenticacao; nao envia WhatsApp.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
import path from 'node:path';
const db = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:teste@localhost:54329/erp_genius_test' } } });
const base = 'http://127.0.0.1:3017';
const jar = new Map();
async function request(route, options = {}) {
  const response = await fetch(base + route, { ...options, redirect: 'manual', headers: {
    ...options.headers, cookie: [...jar].map(([k,v]) => `${k}=${v}`).join('; '),
  } });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';')[0], eq = pair.indexOf('=');
    jar.set(pair.slice(0,eq), pair.slice(eq+1));
  }
  return response;
}
(async () => {
  const password = 'Somente-Auditoria-Local-2026!';
  const u = await db.usuario.upsert({ where: { email: 'http-auditoria@example.test' },
    create: { nome: 'Professor HTTP Auditoria', email: 'http-auditoria@example.test', senhaHash: await bcrypt.hash(password, 10), papeis: ['PROFESSOR'] },
    update: { ativo: true, papeis: ['PROFESSOR'], senhaHash: await bcrypt.hash(password, 10) },
  });
  const marker = 'PAIS_PRIVADO_AUDITORIA_20260907';
  const pais = await db.pais.findFirstOrThrow();
  await db.pais.update({ where: { id: pais.id }, data: { nome: marker } });
  const csrf = await (await request('/api/auth/csrf')).json();
  const login = await request('/api/auth/callback/credentials', { method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: u.email, senha: password, callbackUrl: base + '/home' }),
  });
  const session = await (await request('/api/auth/session')).json();
  if (session.user?.email !== u.email) throw new Error('Login real falhou: HTTP ' + login.status);
  const results = [{ id: 'H00', cenario: 'Login real de professor', passou: true }];
  for (const route of ['/configuracao/paises', '/configuracao/catalogo', '/configuracao/usuarios']) {
    const r = await request(route), html = await r.text();
    results.push({ id: route, status: r.status, dadosPrivadosNoHTML: html.includes(marker), acessoNegado: /acesso negado|sem permiss[aã]o/i.test(html) });
  }
  await db.usuario.update({ where: { id: u.id }, data: { ativo: false } });
  const form = new FormData();
  form.set('file', new File(['%PDF-1.4\n%arquivo ficticio de auditoria\n%%EOF'], 'auditoria-inativo.pdf', { type: 'application/pdf' }));
  const upload = await request('/api/upload', { method: 'POST', body: form });
  const uploaded = await upload.json();
  results.push({ id: 'H04', cenario: 'Upload com usuario desativado e cookie anterior', status: upload.status, uploadAceito: !!uploaded.url });
  if (uploaded.url) {
    const read = await request(uploaded.url);
    results.push({ id: 'H05', cenario: 'Leitura do arquivo com mesmo usuario desativado', status: read.status });
    const root = path.resolve('data/uploads');
    const target = path.resolve(root, path.basename(uploaded.url));
    if (!target.startsWith(root + path.sep)) throw new Error('Caminho fora do storage de teste');
    await fs.unlink(target);
  }
  await fs.writeFile('docs/auditoria-2026-09-http.json', JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
