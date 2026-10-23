# #307 — preparação do integrador

Base E0 final `bcc3d27a` (fonte99d045c4,845arquivos6527testes/TSC/lint0). Etapa0 da issue307: três devDependencies exatas, sem atualização das demais: playwright-core1.56.1, @babel/standalone7.29.0, lucide-static0.460.0. Manifesto/lock alterados por npm package-lock-only/ignore-scripts; flag de fsevents preservada da base para evitar alteração alheia.

Pacotes cacheados do registry e copiados fisicamente para root/DEV B/TESTER, sem symlink/junction ou execução de install scripts. O playwright extraneous1.64.1 anterior continua utilizável com sua própria cópia física aninhada de playwright-core1.64.1; o core direto é1.56.1. DEV A ainda usa o ambiente anterior, pois306 não depende desses pacotes. Após integrar307, o integrador atualizará os demais ambientes antes dos testes daquela base.

Verificação Node22: quatro testes de dependências código0 e conferência real de todas as dependências diretas contra manifesto/lock/instalado código0. Os dois clientes Playwright abriram/fecharam o Chrome local155.0.8059.85 com sucesso. No Windows, usar variável documentada `PW_CHROMIUM=C:/Program Files/Google/Chrome/Application/chrome.exe`; não fixar caminho Linux nem baixar browser pelo DEV.

Referência imutável recuperada do PR297/head8f42a15e: docs/planejamento/inbox-prototipo (HTML/JS, análises e22PNG). Os JS do protótipo são ignorados pelo ESLint apenas nessa pasta de referência; não são módulos de produção. Sem alterar bytes para satisfazer regras do app. O harness307 deve servir recursos npm locais e bloquear tráfego não previsto, guardando a lista fechada de bancos de scripts/test-profile.mjs. O código do harness, fixture/SPEC/aceite/gates completos ainda serão implementados pelo DEV B.
