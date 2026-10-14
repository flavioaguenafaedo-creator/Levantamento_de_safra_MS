"""
Processa os shapefiles colocados em dados/entrada/ e gera camadas leves
(GeoJSON em WGS84, recortadas para MS e simplificadas) em docs/dados/,
que é o que o painel (docs/index.html) lê.

Roda automaticamente pelo GitHub Actions a cada envio de arquivo.
Para rodar no computador:  pip install geopandas pyogrio  &&  python scripts/processar_camadas.py
"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("SHAPE_RESTORE_SHX", "YES")  # recupera .shx ausente
import geopandas as gpd
import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
ENT = RAIZ / "dados" / "entrada"
SAI = RAIZ / "docs" / "dados"
SAI.mkdir(parents=True, exist_ok=True)

# Tolerância de simplificação em graus (~0,001° ≈ 100 m). Ajuste se ficar pesado.
TOL_MUN = 0.0015
TOL_SOLO = 0.002
TOL_USO = 0.001
CRS_PADRAO = "EPSG:4674"  # SIRGAS 2000, usado quando o .prj está ausente

log = []


def ler(caminho: Path) -> gpd.GeoDataFrame:
    g = gpd.read_file(caminho)
    # sem .cpg o texto pode vir em Latin-1 lido como UTF-8 ("Ã§"): relê com a codificação certa
    txt = g.select_dtypes(include=["object", "string"]).astype(str)
    if not caminho.with_suffix(".cpg").exists() and txt.apply(lambda c: c.str.contains("Ã|Â", regex=True)).any().any():
        g = gpd.read_file(caminho, encoding="utf-8")
        log.append(f"{caminho.name}: texto relido em UTF-8 (codificação declarada incorreta)")
    if g.crs is None:
        log.append(f"AVISO: {caminho.name} sem .prj; assumido {CRS_PADRAO}")
        g = g.set_crs(CRS_PADRAO)
    g = g.to_crs(4326)
    g["geometry"] = g.geometry.make_valid()
    return g[~g.geometry.is_empty & g.geometry.notna()]


def salvar(g: gpd.GeoDataFrame, nome: str, tol: float, decimais: int = 5):
    g = g.copy()
    g["geometry"] = g.geometry.simplify(tol, preserve_topology=True)
    g = g[~g.geometry.is_empty]
    destino = SAI / f"{nome}.geojson"
    g.to_file(destino, driver="GeoJSON", COORDINATE_PRECISION=decimais)
    kb = destino.stat().st_size / 1024
    log.append(f"{nome}: {len(g)} feições, {kb:,.0f} KB")
    return destino


def shps(pasta: str):
    return sorted((ENT / pasta).glob("*.shp"))


def coluna(g, *candidatos):
    cols = {c.upper(): c for c in g.columns}
    for c in candidatos:
        if c.upper() in cols:
            return cols[c.upper()]
    return None


# ---------------------------------------------------------------- limites
municipios, limite_uf = None, None
for f in shps("limites"):
    g = ler(f)
    if coluna(g, "CD_MUN") and len(g) > 1:
        municipios = g
    else:
        limite_uf = g

if municipios is None:
    sys.exit("ERRO: nenhum shapefile de municípios (com campo CD_MUN) em dados/entrada/limites/")

manter = [c for c in ["CD_MUN", "NM_MUN", "NM_RGI", "NM_RGINT", "AREA_KM2"] if c in municipios.columns]
municipios = municipios[manter + ["geometry"]]
salvar(municipios, "municipios", TOL_MUN)

if limite_uf is None:  # gera o limite estadual dissolvendo os municípios
    limite_uf = gpd.GeoDataFrame({"nome": ["Mato Grosso do Sul"]},
                                 geometry=[municipios.union_all()], crs=4326)
    log.append("limite_ms: gerado a partir dos municípios")
else:
    limite_uf = gpd.GeoDataFrame({"nome": ["Mato Grosso do Sul"]},
                                 geometry=[limite_uf.union_all()], crs=4326)
salvar(limite_uf, "limite_ms", TOL_MUN)
area_ms = limite_uf.geometry.iloc[0].buffer(0)

# ------------------------------------------------------------------ solos
ORDENS = ["Latossolo", "Argissolo", "Argilossolo", "Neossolo", "Planossolo", "Gleissolo",
          "Nitossolo", "Vertissolo", "Plintossolo", "Espodossolo", "Luvissolo",
          "Chernossolo", "Organossolo", "Cambissolo"]


def ordem(texto):
    if not isinstance(texto, str):
        return "Outros"
    for o in ORDENS:
        if texto.lower().startswith(o.lower()):
            return "Argissolo" if o == "Argilossolo" else o
    if "agua" in texto.lower() or "água" in texto.lower():
        return "Corpo d'água"
    return "Outros"


def textura(t):
    if not isinstance(t, str) or not t.strip():
        return "Sem informação"
    t = t.lower()
    if "muito argilosa" in t or "argilosa" in t:
        return "Argilosa / muito argilosa"
    if "média" in t or "media" in t:
        return "Média"
    if "arenosa" in t:
        return "Arenosa"
    if "siltosa" in t:
        return "Siltosa"
    return "Indiscriminada"


SOLOS_MS = None
for f in shps("solos")[:1]:
    g = ler(f)
    g = g[g.intersects(area_ms)]
    g = gpd.clip(g, area_ms)
    c_classe = coluna(g, "DSC_COMPON", "LEGENDA", "COMPONENTE", "NOME_UNIDA", "CLASSE")
    c_tex = coluna(g, "DSC_TEXTUR", "TEXTURA")
    c_c2 = coluna(g, "DSC_COMPO1")
    c_c3 = coluna(g, "DSC_COMPO2")
    c_cod = coluna(g, "COD_SIMBOL", "COD_LEGEND", "SIMBOLO")
    s = gpd.GeoDataFrame(geometry=g.geometry, crs=4326)
    s["classe"] = g[c_classe] if c_classe else None
    s["ordem"] = s["classe"].map(ordem)
    s["textura_orig"] = g[c_tex] if c_tex else None
    s["textura"] = s["textura_orig"].map(textura)
    s["comp2"] = g[c_c2] if c_c2 else None
    s["comp3"] = g[c_c3] if c_c3 else None
    s["simbolo"] = g[c_cod] if c_cod else None
    s = s.explode(index_parts=False)
    s = s[s.geom_type.isin(["Polygon", "MultiPolygon"])]
    salvar(s, "solos", TOL_SOLO)
    SOLOS_MS = s[s.ordem != "Corpo d'água"].copy()
    log.append(f"solos: fonte {f.name}")

# ------------------------------------------------------------ uso do solo
CODIGOS_USO = {"SOJ": "Soja", "CAN": "Cana-de-açúcar", "MIL": "Milho", "PST": "Pastagem", "REM": "Remanescente/vegetação",
               "EUC": "Eucalipto", "PIN": "Pinus", "SER": "Seringueira", "OUT": "Outros usos"}
USO_BRUTO = []
for f in shps("uso_solo"):
    g = ler(f)
    g = gpd.clip(g[g.intersects(area_ms)], area_ms)
    c = coluna(g, "UCS", "CLASSE", "CLASS", "USO", "CULTURA", "DESCRICAO")
    classe = g[c].astype(str).str.strip().str.upper().map(lambda v: CODIGOS_USO.get(v, v.title())) if c else f.stem
    g = g.assign(classe=classe)[["classe", "geometry"]]
    USO_BRUTO.append((f.name, g.copy()))
    # área em ha (projeção equivalente) antes de simplificar
    g["area_ha"] = g.to_crs("ESRI:102033").area / 1e4
    g = g.dissolve("classe", as_index=False, aggfunc={"area_ha": "sum"})
    g["area_ha"] = g["area_ha"].round(0)
    salvar(g, f"uso_{f.stem.lower()}", TOL_USO)


# ------------------------------------------------- solos ocupados por cada cultura (uso x solos x municípios)
# Área (ha, projeção equivalente) de cada classe de uso agrícola por classe e textura de solo, por município e no estado.
CULTURAS_USO = {"Soja", "Cana-de-açúcar", "Milho", "Algodão", "Arroz", "Feijão", "Sorgo", "Trigo", "Aveia", "Amendoim"}
if SOLOS_MS is not None and USO_BRUTO:
    EQ = "ESRI:102033"
    unid = gpd.overlay(SOLOS_MS[["ordem", "textura", "geometry"]].to_crs(EQ),
                       municipios[["CD_MUN", "geometry"]].to_crs(EQ), how="intersection", keep_geom_type=True)
    saida = {"descricao": "Área (ha) de cada cultura mapeada por classe e textura de solo. Solos: IBGE/Embrapa 1:5.000.000; uso: arquivos de dados/entrada/uso_solo.",
             "gerado": datetime.now(timezone.utc).isoformat(timespec="seconds"), "culturas": {}}
    for arq, g in USO_BRUTO:
        for cl in sorted(set(g["classe"]) & CULTURAS_USO):
            u = g[g["classe"] == cl].to_crs(EQ)
            x = gpd.overlay(u[["geometry"]], unid, how="intersection", keep_geom_type=True)
            x["ha"] = x.area / 1e4
            res = saida["culturas"].setdefault(cl, {"arquivos": [], "estado": {"area": 0, "ordem": {}, "textura": {}}, "mun": {}})
            res["arquivos"].append(arq)
            for (cd, ordem_, tex), ha in x.groupby(["CD_MUN", "ordem", "textura"])["ha"].sum().items():
                cd = str(int(cd)); m = res["mun"].setdefault(cd, {"area": 0, "ordem": {}, "textura": {}})
                for alvo in (m, res["estado"]):
                    alvo["area"] += ha
                    alvo["ordem"][ordem_] = alvo["ordem"].get(ordem_, 0) + ha
                    alvo["textura"][tex] = alvo["textura"].get(tex, 0) + ha
            log.append(f"solo_cultura: {cl} ({arq}) {res['estado']['area']:,.0f} ha cruzados com solos")
    def arred(o):
        return {k: (round(v) if isinstance(v, float) else arred(v) if isinstance(v, dict) else v) for k, v in o.items()}
    (SAI / "solo_cultura.json").write_text(json.dumps({**saida, "culturas": {k: arred(v) for k, v in saida["culturas"].items()}}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

# ------------------------------------------------------- infraestrutura (rodovias etc.)
for f in shps("infraestrutura"):
    g = ler(f)
    g = g[g.intersects(area_ms.buffer(0.05))]
    manter = [c for c in g.columns if c != "geometry" and c.upper() in ("NOME", "JURD", "COBE", "TIPO", "EXTENSA_KM")]
    g = g[manter + ["geometry"]]
    g.columns = [c.lower() if c != "geometry" else c for c in g.columns]
    if "nome" in g.columns:
        g["nome"] = g["nome"].astype(str).str.replace(r"\s+", " ", regex=True).str.strip()
    salvar(g, f"infra_{f.stem.lower()}", 0.0005)

# --------------------------------------------------------------- manifesto
camadas = sorted(p.stem for p in SAI.glob("*.geojson"))
manifesto = {
    "atualizado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "camadas": camadas,
    "log": log,
}
(SAI / "manifesto.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=2), encoding="utf-8")
print("\n".join(log))
