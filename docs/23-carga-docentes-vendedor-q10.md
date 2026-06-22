# 23 — Carga única: docentes + vendedor (Q10)

> **Natureza:** carga **única** (one-shot). Fonte: `data/Docentes.xlsx` (11) + decisão do usuário
> sobre o vendedor histórico. Scripts descartáveis removidos após rodar.

> ✅ **EXECUTADA.** **8 professores atualizados + 3 criados** (12 total); vendedor **Henrique**
> criado; **56 comissões PAGA** (uma por matrícula).

## 1. Schema (migration `usuario_dados_professor`)
`Usuario` ganhou campos **opcionais**: `telefoneE164`, `documento`, `nascimento`, `genero`
(reusa enum `Genero`). Permite guardar os dados pessoais do professor sem virar perfil de RH.

## 2. Docentes (`Docentes.xlsx`, 11)
- **Match** com os 8 já criados (na carga de turmas, doc 20): tokens do nome atual ⊆ nome completo
  do docente → **atualiza** (nome completo, e-mail real, telefone, documento, nascimento, gênero).
- **3 sem correspondência → criados:** Vitor Falcao Avila, Erbesson Rodrigues De Lima,
  Larissa Araújo Pereira Avila. (Papel PROFESSOR; e-mail real como login; senha padrão.)
- 🔎 "Vitor Falcao Avila" é o "Avila" que havia sido importado por engano como **aluno** (doc 21,
  removido) — agora entra no lugar certo, como **docente**.

## 3. Vendedor + comissão (decisão do usuário)
- Os alunos antigos foram **todos matriculados pelo vendedor Henrique** → criado
  `Usuario` "Henrique (vendas)" (papel VENDEDOR, `limiteDescontoPct` 10).
- **56 comissões** criadas (1 por matrícula), `status = PAGA` (já quitadas).
- ⚠️ A fonte **não traz valor de comissão nem taxa** → `percentual` e `valor` gravados como **0**
  (registro do vínculo + "pago", não do montante). Evento `ComissaoImportada` documenta isso.

## 4. Fora de escopo (futuro)
- Dia/horário das turmas; valores reais das comissões; os 30 da cobrança sem aluno na base.
