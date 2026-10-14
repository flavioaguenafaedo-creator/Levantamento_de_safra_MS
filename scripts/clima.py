"""
Busca dados meteorológicos e grava em docs/dados/clima/ para o painel.
Roda todo dia pelo GitHub Actions (e também pode rodar no computador).

1. Previsão (16 dias) e estimativa recente (92 dias) por município
   Fonte: Open-Meteo (https://open-meteo.com) — combina modelos globais e regionais
   (ECMWF, GFS, ICON etc.). Ponto = centróide do município. Uso não comercial gratuito.
   Atenção: os dias passados são ESTIMATIVA DE MODELO, não observação.

2. Observações das estações automáticas do INMET em MS
   Fonte: dados históricos anuais do INMET (https://portal.inmet.gov.br/dadoshistoricos).
   O arquivo do ano corrente é atualizado pelo INMET periodicamente (pode ter semanas de atraso).

Cada parte é independente: se uma fonte falhar, a outra continua e o painel mantém o último dado.
"""
import io, json, re, sys, zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path
import urllib.request

RAIZ = Path(__file__).resolve().parents[1]
SAI = RAIZ / "docs" / "dados" / "clima"
SAI.mkdir(parents=True, exist_ok=True)
AGORA = datetime.now(timezone(timedelta(hours=-4)))
UA = {"User-Agent": "Painel-Levantamento-Safra-MS (CONAB SUREG-MS)"}


def baixar(url, timeout=120):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def salvar(nome, obj):
    (SAI / nome).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{nome}: {(SAI / nome).stat().st_size/1024:,.0f} KB")


def r1(v):
    return None if v is None else round(v, 1)


# ------------------------------------------------------------------ 1. Open-Meteo
VARS = {"p": "precipitation_sum", "pp": "precipitation_probability_max", "tx": "temperature_2m_max",
        "tn": "temperature_2m_min", "v": "wind_speed_10m_max", "et0": "et0_fao_evapotranspiration"}


def centroides():
    g = json.loads((RAIZ / "docs" / "dados" / "municipios.geojson").read_text(encoding="utf-8"))
    pts = []
    for f in g["features"]:
        geom = f["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        anel = max((p[0] for p in polys), key=len)          # anel externo do maior polígono
        # centróide de área (fórmula do polígono)
        a = cx = cy = 0.0
        for (x0, y0), (x1, y1) in zip(anel, anel[1:]):
            c = x0 * y1 - x1 * y0; a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c
        a *= 0.5
        x, y = (cx / (6 * a), cy / (6 * a)) if a else anel[0]
        pts.append((str(f["properties"]["CD_MUN"]), round(y, 3), round(x, 3)))
    return pts


def open_meteo():
    pts = centroides()
    out = {"fonte": "Open-Meteo (modelos ECMWF, GFS, ICON e outros, melhor combinação para o local)",
           "nota": "Dias até ontem = estimativa de modelo, não observação de estação.",
           "gerado": AGORA.isoformat(timespec="minutes"), "unidades": {"p": "mm", "pp": "%", "tx": "°C", "tn": "°C", "v": "km/h", "et0": "mm"},
           "datas": None, "hoje": AGORA.date().isoformat(), "mun": {}}
    for i in range(0, len(pts), 40):                        # lotes de 40 pontos por requisição
        lote = pts[i:i + 40]
        url = ("https://api.open-meteo.com/v1/forecast?"
               f"latitude={','.join(str(p[1]) for p in lote)}&longitude={','.join(str(p[2]) for p in lote)}"
               f"&daily={','.join(VARS.values())}&past_days=92&forecast_days=16&timezone=America%2FCampo_Grande")
        resp = json.loads(baixar(url))
        if isinstance(resp, dict):
            resp = [resp]
        for (cd, _, _), r in zip(lote, resp):
            d = r["daily"]
            out["datas"] = out["datas"] or d["time"]
            out["mun"][cd] = {k: [r1(v) for v in d.get(nome, [])] for k, nome in VARS.items()}
    salvar("modelo_municipios.json", out)


# ------------------------------------------------------------------ 2. INMET
def num(s):
    s = (s or "").strip().replace(",", ".")
    try:
        v = float(s)
    except ValueError:
        return None
    return None if v <= -9999 else v


def ler_csv_inmet(texto):
    linhas = texto.splitlines()
    meta = {}
    for ln in linhas[:8]:
        k, _, v = ln.partition(":")
        meta[k.strip().upper()] = v.strip().strip(";")
    if meta.get("UF") != "MS":
        return None
    cab_i = next(i for i, l in enumerate(linhas[:12]) if l.upper().startswith("DATA") and "HORA" in l.upper())
    cab = [c.strip().upper() for c in linhas[cab_i].split(";")]

    def col(*padroes):
        for i, c in enumerate(cab):
            if all(p in c for p in padroes):
                return i
        return None
    iP, iT, iTx, iTn, iV = (col("PRECIPITA"), col("BULBO SECO"), col("MÁXIMA NA HORA") or col("MAXIMA NA HORA"),
                            col("MÍNIMA NA HORA") or col("MINIMA NA HORA"), col("VENTO, VELOCIDADE"))
    dias = {}
    for ln in linhas[cab_i + 1:]:
        c = ln.split(";")
        if len(c) < len(cab) - 1:
            continue
        hora = re.sub(r"\D", "", c[1])[:2]
        dt = None
        for fmt in ("%Y/%m/%d", "%d/%m/%Y"):
            try:
                dt = datetime.strptime(c[0].strip().replace("-", "/"), fmt); break
            except ValueError:
                pass
        if dt is None:
            continue
        # dia local (UTC-4): horas 00-03 UTC pertencem ao dia anterior
        if hora and int(hora) < 4:
            dt -= timedelta(days=1)
        d = dias.setdefault(dt.date().isoformat(), {"p": [], "t": [], "tx": [], "tn": [], "v": []})
        for k, i in (("p", iP), ("t", iT), ("tx", iTx), ("tn", iTn), ("v", iV)):
            if i is not None and i < len(c):
                v = num(c[i])
                if v is not None:
                    d[k].append(v)
    serie = {}
    for dia, d in sorted(dias.items()):
        if len(d["t"]) < 18:                                 # dia com menos de 18 h de dados: descartado
            continue
        serie[dia] = {"p": r1(sum(d["p"])) if len(d["p"]) >= 18 else None,
                      "tx": r1(max(d["tx"] or d["t"])), "tn": r1(min(d["tn"] or d["t"])),
                      "tm": r1(sum(d["t"]) / len(d["t"])),
                      "v": r1(3.6 * sum(d["v"]) / len(d["v"])) if d["v"] else None}
    return {"codigo": meta.get("CODIGO (WMO)", ""), "nome": meta.get("ESTACAO", "").title(),
            "lat": num(meta.get("LATITUDE")), "lon": num(meta.get("LONGITUDE")), "alt": num(meta.get("ALTITUDE")),
            "serie": serie}


def inmet():
    est = {}
    anos = [AGORA.year] + ([AGORA.year - 1] if AGORA.month <= 4 else [])
    for ano in anos:
        try:
            z = zipfile.ZipFile(io.BytesIO(baixar(f"https://portal.inmet.gov.br/uploads/dadoshistoricos/{ano}.zip", 600)))
        except Exception as e:
            print(f"INMET {ano}: falhou ({e})"); continue
        for nome in z.namelist():
            if "_MS_" not in nome.upper() or not nome.upper().endswith(".CSV"):
                continue
            r = ler_csv_inmet(z.read(nome).decode("latin-1"))
            if r and r["serie"]:
                e = est.setdefault(r["codigo"], {**r, "serie": {}})
                e["serie"].update(r["serie"])
    if not est:
        raise RuntimeError("nenhuma estação lida")
    limite = (AGORA - timedelta(days=150)).date().isoformat()
    for e in est.values():
        e["serie"] = {d: v for d, v in sorted(e["serie"].items()) if d >= limite}
        e["ultimo_dia"] = max(e["serie"]) if e["serie"] else None
    salvar("estacoes_inmet.json", {"fonte": "INMET · estações automáticas · dados históricos anuais",
                                   "gerado": AGORA.isoformat(timespec="minutes"),
                                   "estacoes": [e for e in est.values() if e["serie"]]})


if __name__ == "__main__":
    erros = []
    for nome, fn in (("Open-Meteo", open_meteo), ("INMET", inmet)):
        try:
            fn()
        except Exception as e:
            erros.append(nome); print(f"ERRO {nome}: {e}", file=sys.stderr)
    if len(erros) == 2:
        sys.exit(1)
