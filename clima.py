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
    # dias já passados entram no histórico permanente (nunca é apagado)
    hoje = AGORA.date().isoformat()
    passado = {}
    for cd, m in out["mun"].items():
        for i, d in enumerate(out["datas"]):
            if d < hoje:
                passado.setdefault(d, {})[cd] = {k: m[k][i] for k in HIST_VARS if i < len(m.get(k, []))}
    gravar_historico(passado, "modelo")
    try:
        completar_era5(pts)
    except Exception as e:
        print(f"ERA5 (reanálise): falhou ({e})", file=sys.stderr)


# ------------------------------------------------------------- histórico permanente por ano
# docs/dados/clima/historico/modelo_AAAA.json — um arquivo por ano, só acrescenta/atualiza dias.
# Prioridade da fonte por dia: era5 (reanálise, mais consistente) > modelo (análise do modelo de previsão).
HIST_VARS = ("p", "tx", "tn", "v", "et0")
HIST = SAI / "historico"
INICIO_HIST = "2025-07-01"          # início do histórico de clima por município (safra 2025/26)
PRIOR = {"modelo": 1, "era5": 2}


def ler_ano(ano):
    f = HIST / f"modelo_{ano}.json"
    if not f.exists():
        return {"datas": [], "fonte": [], "mun": {}}
    return json.loads(f.read_text(encoding="utf-8"))


def gravar_historico(dias, fonte):
    """dias = {data: {cd_mun: {var: valor}}}"""
    HIST.mkdir(parents=True, exist_ok=True)
    por_ano = {}
    for d, v in dias.items():
        por_ano.setdefault(d[:4], {})[d] = v
    for ano, novos in por_ano.items():
        h = ler_ano(ano)
        idx = {d: i for i, d in enumerate(h["datas"])}
        tab = {d: {"fonte": h["fonte"][i], "mun": {cd: {k: h["mun"][cd][k][i] for k in HIST_VARS} for cd in h["mun"]}}
               for d, i in idx.items()}
        n = 0
        for d, mun in novos.items():
            atual = tab.get(d)
            if atual and PRIOR.get(atual["fonte"], 0) > PRIOR[fonte]:
                continue                       # não troca reanálise por estimativa de modelo
            tab[d] = {"fonte": fonte, "mun": {**(atual["mun"] if atual else {}), **mun}}; n += 1
        datas = sorted(tab)
        cds = sorted({cd for d in datas for cd in tab[d]["mun"]})
        h = {"descricao": "Histórico diário por município (centróide). Não apagar: base das análises de safra.",
             "unidades": {"p": "mm", "tx": "°C", "tn": "°C", "v": "km/h", "et0": "mm"},
             "datas": datas, "fonte": [tab[d]["fonte"] for d in datas],
             "mun": {cd: {k: [tab[d]["mun"].get(cd, {}).get(k) for d in datas] for k in HIST_VARS} for cd in cds}}
        (HIST / f"modelo_{ano}.json").write_text(json.dumps(h, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"historico/modelo_{ano}.json: {len(datas)} dias ({n} atualizados, fonte {fonte})")


def completar_era5(pts, max_dias=400):
    """Preenche o histórico com a reanálise ERA5 (Open-Meteo Archive), que fica disponível com ~5 dias de atraso."""
    fim = (AGORA - timedelta(days=6)).date()
    ini = datetime.fromisoformat(INICIO_HIST).date()
    tem = set()
    for ano in range(ini.year, fim.year + 1):
        h = ler_ano(ano)
        tem |= {d for d, f in zip(h["datas"], h["fonte"]) if f == "era5"}
    faltam = [d for d in (ini + timedelta(days=i) for i in range((fim - ini).days + 1)) if d.isoformat() not in tem]
    if not faltam:
        return
    a, b = faltam[0], min(faltam[-1], faltam[0] + timedelta(days=max_dias))
    dias = {}
    nomes = {k: VARS[k] for k in HIST_VARS}
    for i in range(0, len(pts), 40):
        lote = pts[i:i + 40]
        url = ("https://archive-api.open-meteo.com/v1/archive?"
               f"latitude={','.join(str(p[1]) for p in lote)}&longitude={','.join(str(p[2]) for p in lote)}"
               f"&start_date={a}&end_date={b}&daily={','.join(nomes.values())}&timezone=America%2FCampo_Grande")
        resp = json.loads(baixar(url, 300))
        if isinstance(resp, dict):
            resp = [resp]
        for (cd, _, _), r in zip(lote, resp):
            dd = r["daily"]
            for j, d in enumerate(dd["time"]):
                vals = {k: r1(dd[n][j]) for k, n in nomes.items()}
                if any(v is not None for v in vals.values()):
                    dias.setdefault(d, {})[cd] = vals
    gravar_historico(dias, "era5")


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
    # histórico permanente por ano (acrescenta, nunca apaga)
    HIST.mkdir(parents=True, exist_ok=True)
    for ano in {d[:4] for e in est.values() for d in e["serie"]}:
        f = HIST / f"inmet_{ano}.json"
        h = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {"estacoes": {}}
        for cod, e in est.items():
            he = h["estacoes"].setdefault(cod, {k: e[k] for k in ("codigo", "nome", "lat", "lon", "alt")} | {"serie": {}})
            he["serie"].update({d: v for d, v in e["serie"].items() if d[:4] == ano})
            he["serie"] = dict(sorted(he["serie"].items()))
        f.write_text(json.dumps(h, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"historico/inmet_{ano}.json: {len(h['estacoes'])} estações")
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
