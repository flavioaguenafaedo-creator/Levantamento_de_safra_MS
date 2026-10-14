# Levantamento de Safras MS · Painel

Painel geoespacial de apoio ao levantamento de safras da CONAB/SUREG-MS (SEGeo).
O painel é publicado pelo GitHub Pages a partir da pasta `docs/` e é **alimentado automaticamente**
pelos arquivos colocados em `dados/entrada/`.

## Como atualizar o painel

1. Coloque (ou substitua) os arquivos na subpasta certa de `dados/entrada/`.
2. Faça o commit/upload pelo GitHub.
3. A rotina **Atualizar painel** (aba *Actions*) processa os arquivos e publica as camadas em `docs/dados/`.
   Em 1 a 2 minutos o painel já mostra a versão nova.

| Pasta | O que colocar | Situação |
|---|---|---|
| `dados/entrada/limites/` | Shapefile dos municípios (com campo `CD_MUN`). Opcional: limite estadual. | ativo |
| `dados/entrada/solos/` | Shapefile de solos (Embrapa/IBGE) com classe e textura | ativo |
| `dados/entrada/uso_solo/` | Shapefile(s) de uso e ocupação. Cada arquivo vira uma camada; a cor é pelo campo `CLASSE` (ou o 1º campo de texto) | ativo |
| `dados/entrada/clima_inmet/` | CSVs históricos das estações INMET | etapa 4 |
| `dados/entrada/plantio/` | Planilha semanal de plantio | etapa 2 |
| `dados/entrada/fotos/` | Fotos de campo com GPS no EXIF | etapa 3 |
| `dados/entrada/relatos/` | Relatos de viagem | etapa 3 |

**Shapefile é um conjunto de arquivos**: envie sempre `.shp`, `.shx`, `.dbf`, `.prj` e `.cpg` com o mesmo nome.
Sem `.prj` o processamento assume SIRGAS 2000 (EPSG:4674).

## Primeira configuração (uma vez só)

1. *Settings → Pages*: em **Source** escolha *Deploy from a branch*, branch `main`, pasta `/docs`.
2. *Settings → Actions → General → Workflow permissions*: marque **Read and write permissions**.
3. O endereço do painel será `https://<usuario>.github.io/Levantamento_de_safra_MS/`.

## Rodar no computador (opcional)

```bash
pip install -r requirements.txt
python scripts/processar_camadas.py
python -m http.server -d docs 8000   # abrir http://localhost:8000
```

## Limitações que o painel deve deixar explícitas

- Solos `Solos_5000`: escala **1:5.000.000**, leitura regional. Para análises por município, substituir pelo
  mapa de pedologia IBGE/BDiA **1:250.000** (mesmos campos de classe e textura; basta trocar o arquivo).
- O percentual de solos por município é calculado pela sobreposição dos polígonos simplificados e é aproximado.
- O GitHub Pages é público: avaliar antes de publicar fotos com coordenadas de propriedades e relatos que citem produtores.
