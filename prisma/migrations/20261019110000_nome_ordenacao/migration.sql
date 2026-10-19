-- D1 (#141): ordenação de nomes com acento sem ICU nem unaccent (Postgres alpine, datlocprovider=c).
-- Coluna GERADA pelo banco (STORED): o ADD COLUMN já preenche as linhas existentes e cada INSERT/UPDATE
-- recalcula, inclusive por SQL cru. Minúsculas sem acento, espaços repetidos colapsados e pontas aparadas.
-- Só translate/regexp_replace/btrim (IMMUTABLE e sem depender de locale); A-Z viram minúsculas pelo
-- próprio translate, e os diacríticos combinantes U+0300-U+036F (sem par) são apagados.
-- Fonte do mapa: src/lib/nome-ordenacao.ts; a trava nome-ordenacao.test.ts confere este arquivo.

-- Aluno
ALTER TABLE "Aluno" ADD COLUMN "nomeOrdenacao" TEXT NOT NULL GENERATED ALWAYS AS (btrim(regexp_replace(translate("primeiroNome" || ' ' || COALESCE("sobrenome", ''), 'ÁÀÂÃÄÅĀĂĄáàâãäåāăąÇĆĈĊČçćĉċčĎĐďđÉÈÊËĒĔĖĘĚéèêëēĕėęěĜĞĠĢĝğġģĤĦĥħÍÌÎÏĨĪĬĮİíìîïĩīĭįıĴĵĶķĹĻĽĿŁĺļľŀłÑŃŅŇñńņňÓÒÔÕÖØŌŎŐóòôõöøōŏőŔŖŘŕŗřŚŜŞŠȘśŝşšșŢŤŦȚţťŧțÚÙÛÜŨŪŬŮŰŲúùûüũūŭůűųŴŵÝŸŶýÿŷŹŻŽźżžABCDEFGHIJKLMNOPQRSTUVWXYZ ̴̵̶̷̸̡̢̧̨̛̖̗̘̙̜̝̞̟̠̣̤̥̦̩̪̫̬̭̮̯̰̱̲̳̹̺̻̼͇͈͉͍͎̀́̂̃̄̅̆̇̈̉̊̋̌̍̎̏̐̑̒̓̔̽̾̿̀́͂̓̈́͆͊͋͌̕̚ͅ͏͓͔͕͖͙͚͐͑͒͗͛ͣͤͥͦͧͨͩͪͫͬͭͮͯ͘͜͟͢͝͞͠͡', 'aaaaaaaaaaaaaaaaaaccccccccccddddeeeeeeeeeeeeeeeeeegggggggghhhhiiiiiiiiiiiiiiiiiijjkkllllllllllnnnnnnnnoooooooooooooooooorrrrrrssssssssssttttttttuuuuuuuuuuuuuuuuuuuuwwyyyyyyzzzzzzabcdefghijklmnopqrstuvwxyz '), '[[:space:]]+', ' ', 'g'))) STORED;
CREATE INDEX "Aluno_nomeOrdenacao_id_idx" ON "Aluno"("nomeOrdenacao", "id");

-- Pessoa
ALTER TABLE "Pessoa" ADD COLUMN "nomeOrdenacao" TEXT NOT NULL GENERATED ALWAYS AS (btrim(regexp_replace(translate("nome", 'ÁÀÂÃÄÅĀĂĄáàâãäåāăąÇĆĈĊČçćĉċčĎĐďđÉÈÊËĒĔĖĘĚéèêëēĕėęěĜĞĠĢĝğġģĤĦĥħÍÌÎÏĨĪĬĮİíìîïĩīĭįıĴĵĶķĹĻĽĿŁĺļľŀłÑŃŅŇñńņňÓÒÔÕÖØŌŎŐóòôõöøōŏőŔŖŘŕŗřŚŜŞŠȘśŝşšșŢŤŦȚţťŧțÚÙÛÜŨŪŬŮŰŲúùûüũūŭůűųŴŵÝŸŶýÿŷŹŻŽźżžABCDEFGHIJKLMNOPQRSTUVWXYZ ̴̵̶̷̸̡̢̧̨̛̖̗̘̙̜̝̞̟̠̣̤̥̦̩̪̫̬̭̮̯̰̱̲̳̹̺̻̼͇͈͉͍͎̀́̂̃̄̅̆̇̈̉̊̋̌̍̎̏̐̑̒̓̔̽̾̿̀́͂̓̈́͆͊͋͌̕̚ͅ͏͓͔͕͖͙͚͐͑͒͗͛ͣͤͥͦͧͨͩͪͫͬͭͮͯ͘͜͟͢͝͞͠͡', 'aaaaaaaaaaaaaaaaaaccccccccccddddeeeeeeeeeeeeeeeeeegggggggghhhhiiiiiiiiiiiiiiiiiijjkkllllllllllnnnnnnnnoooooooooooooooooorrrrrrssssssssssttttttttuuuuuuuuuuuuuuuuuuuuwwyyyyyyzzzzzzabcdefghijklmnopqrstuvwxyz '), '[[:space:]]+', ' ', 'g'))) STORED;
CREATE INDEX "Pessoa_nomeOrdenacao_id_idx" ON "Pessoa"("nomeOrdenacao", "id");

-- Empresa
ALTER TABLE "Empresa" ADD COLUMN "nomeOrdenacao" TEXT NOT NULL GENERATED ALWAYS AS (btrim(regexp_replace(translate("nome", 'ÁÀÂÃÄÅĀĂĄáàâãäåāăąÇĆĈĊČçćĉċčĎĐďđÉÈÊËĒĔĖĘĚéèêëēĕėęěĜĞĠĢĝğġģĤĦĥħÍÌÎÏĨĪĬĮİíìîïĩīĭįıĴĵĶķĹĻĽĿŁĺļľŀłÑŃŅŇñńņňÓÒÔÕÖØŌŎŐóòôõöøōŏőŔŖŘŕŗřŚŜŞŠȘśŝşšșŢŤŦȚţťŧțÚÙÛÜŨŪŬŮŰŲúùûüũūŭůűųŴŵÝŸŶýÿŷŹŻŽźżžABCDEFGHIJKLMNOPQRSTUVWXYZ ̴̵̶̷̸̡̢̧̨̛̖̗̘̙̜̝̞̟̠̣̤̥̦̩̪̫̬̭̮̯̰̱̲̳̹̺̻̼͇͈͉͍͎̀́̂̃̄̅̆̇̈̉̊̋̌̍̎̏̐̑̒̓̔̽̾̿̀́͂̓̈́͆͊͋͌̕̚ͅ͏͓͔͕͖͙͚͐͑͒͗͛ͣͤͥͦͧͨͩͪͫͬͭͮͯ͘͜͟͢͝͞͠͡', 'aaaaaaaaaaaaaaaaaaccccccccccddddeeeeeeeeeeeeeeeeeegggggggghhhhiiiiiiiiiiiiiiiiiijjkkllllllllllnnnnnnnnoooooooooooooooooorrrrrrssssssssssttttttttuuuuuuuuuuuuuuuuuuuuwwyyyyyyzzzzzzabcdefghijklmnopqrstuvwxyz '), '[[:space:]]+', ' ', 'g'))) STORED;
CREATE INDEX "Empresa_nomeOrdenacao_id_idx" ON "Empresa"("nomeOrdenacao", "id");
