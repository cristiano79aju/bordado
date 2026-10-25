# BordAI — Plano de validação isolada

Esta branch é exclusiva para preparação e testes. Não alterar a branch `main` nem publicar diretamente no site original durante esta etapa.

## 1. Segurança e isolamento
- [ ] Confirmar que o site original continua inalterado.
- [ ] Usar somente esta branch para correções experimentais.
- [ ] Manter pagamentos reais desativados em ambientes de teste (`PIX_LIVE_ENABLED=false`).
- [ ] Nunca gravar chaves Asaas, segredos ou credenciais neste repositório.
- [ ] Não usar arquivos privados de clientes como fixtures versionadas.

## 2. Verificação automatizada
Executar com Node.js 22 e dependências instaladas:

```sh
npm ci
node tests/verify.mjs
node tests/routes.mjs
node tests/digitizer.mjs
node tests/many-regions.mjs
node tests/raster.mjs
node tests/artwork-profile.mjs
npm run build:netlify
npm run test:checkout
```

Alguns testes aceitam caminhos opcionais para arquivos PES de referência. Registrar a saída completa, erros e versões usadas; não declarar aprovação se algum comando falhar.

## 3. Testes funcionais
- [ ] Importar imagens simples com poucas cores.
- [ ] Importar arte complexa e verificar detalhes pequenos, transparências, furos e regiões desconectadas.
- [ ] Verificar objetos de cetim, preenchimento e ponto corrido.
- [ ] Revisar densidade, sobreposições, largura, curvas apertadas, pulos e cortes.
- [ ] Comparar a rota original com a otimizada e confirmar que as cores e os trechos costurados permanecem corretos.
- [ ] Exportar PES e DST; reimportar e comparar coordenadas e comandos.
- [ ] Confirmar que erros geométricos bloqueiam a exportação.
- [ ] Confirmar que backups JSON podem ser restaurados.
- [ ] Em teste de checkout, confirmar que PES/DST permanecem bloqueados sem pagamento validado.

## 4. Validação externa obrigatória
- [ ] Abrir os arquivos PES/DST no Wilcom E4.2.
- [ ] Confirmar dimensões, bastidor, sequência de cores, comandos de corte e ausência de erros de leitura.
- [ ] Costurar amostras físicas em tecidos e estabilizadores apropriados.
- [ ] Registrar máquina, agulha, linha, tecido, estabilizador, tempo, quebras de linha e defeitos observados.
- [ ] Só classificar uma matriz como aprovada para produção após inspeção do bordado físico.

## 5. Critérios para publicação
Publicar apenas depois que os testes automatizados passarem, os arquivos forem abertos no Wilcom E4.2 e houver validação física documentada. Uma simulação ou revisão geométrica limpa, por si só, não certifica qualidade de bordado.

## Estado inicial
- Branch de teste criada a partir de `atelier-premium`.
- Nenhuma alteração foi feita em `main`.
- Não há confirmação de teste em máquina física nem de transação real Asaas.
