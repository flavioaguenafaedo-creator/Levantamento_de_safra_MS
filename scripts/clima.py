"""
Busca dados meteorológicos e grava em docs/dados/clima/ para o painel.
Roda todo dia pelo GitHub Actions (e também pode rodar no computador).

1. Previsão (16 dias) e estimativa recente (92 dias) por município
   Fonte: Open-Meteo (https://open-meteo.com). Ponto = centróide do município. Uso não comercial gratuito.
   Dias passados: modelo de maior resolução para o local (best match, um modelo; não é média).
   Próximos 16 dias: média de 6 modelos globais (ECMWF, GFS, ICON, GEM, JMA, UKMO), com a faixa entre eles.
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


def baixar(url, timeout=120, tentativas=4):
    """Baixa com novas tentativas. Limite gratuito do Open-Meteo: 600 chamadas/min, 5.000/h, 10.000/dia
    (pedidos longos ou com muitos pontos contam como várias chamadas): em caso de 429, espera e tenta de novo."""
    import time, urllib.error
    for t in range(tentativas):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or t == tentativas - 1:
                raise
            espera = 65 if e.code == 429 else 15 * (t + 1)
            print(f"  HTTP {e.code}: nova tentativa em {espera} s", file=sys.stderr); time.sleep(espera)
        except (urllib.error.URLError, TimeoutError):
            if t == tentativas - 1:
                raise
            time.sleep(15 * (t + 1))


def pausa(n_pts, dias, n_vars=6):
    """Espaça os pedidos pelo 'peso' estimado (Open-Meteo: >14 dias ou >10 variáveis contam como várias chamadas)."""
    import time
    peso = n_pts * max(1.0, dias / 14) * max(1.0, n_vars / 10)
    if peso > 60:
        time.sleep(min(90, 60 * peso / 450))


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


# Modelos globais usados na média da previsão (todos disponíveis para a América do Sul no Open-Meteo).
# Horizonte de cada um: ECMWF 15 dias, GFS 16, ICON 7,5, GEM 10, JMA 11, UKMO 7. A média de cada dia usa os modelos
# que cobrem aquele dia; a faixa (mínimo–máximo) entre eles indica a concordância da previsão.
MODELOS = {"ecmwf": ("ecmwf_ifs025", "ECMWF IFS (Europa)"), "gfs": ("ncep_gfs_seamless", "NOAA GFS (EUA)"),
           "icon": ("dwd_icon_seamless", "DWD ICON (Alemanha)"), "gem": ("cmc_gem_seamless", "CMC GEM (Canadá)"),
           "jma": ("jma_seamless", "JMA GSM (Japão)"), "ukmo": ("ukmo_seamless", "UK Met Office (Reino Unido)")}
VARS_MM = ("p", "tx", "tn", "v", "et0")


def open_meteo():
    pts = centroides()
    out = {"fonte": "Open-Meteo. Dias passados: modelo de maior resolução disponível para o local (opção best match). "
                    "Próximos 16 dias: média dos modelos globais " + ", ".join(v[1] for v in MODELOS.values()) + ".",
           "nota": "Dias até ontem = estimativa de modelo, não observação de estação.",
           "gerado": AGORA.isoformat(timespec="minutes"), "unidades": {"p": "mm", "pp": "%", "tx": "°C", "tn": "°C", "v": "km/h", "et0": "mm"},
           "datas": None, "hoje": AGORA.date().isoformat(), "mun": {}}
    for i in range(0, len(pts), 40):                        # lotes de 40 pontos por requisição
        lote = pts[i:i + 40]
        if i:
            pausa(len(lote), 108)
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
    try:
        multimodelo(pts, out)
    except Exception as e:                                  # sem a média, fica a previsão do best match
        print(f"multimodelo: falhou ({e}); mantida a previsão do modelo único", file=sys.stderr)
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


def multimodelo(pts, out):
    """Previsão de 16 dias de cada modelo (um pedido por modelo) e média por dia/município.
    Grava em out['mun'][cd]: p, tx, tn, v, et0 = média dos modelos a partir de hoje; p_min, p_max, n_mod e
    'mod' = chuva diária de cada modelo (para a faixa e a concordância). Dias passados não mudam."""
    datas = out["datas"]; idx = {d: i for i, d in enumerate(datas)}; hoje = out["hoje"]
    bruto = {}                                              # bruto[cd][modelo][var] = {data: valor}
    usados = []
    for chave, (mid, _) in MODELOS.items():
        ok = 0
        for i in range(0, len(pts), 40):
            lote = pts[i:i + 40]
            pausa(len(lote), 16)
            url = ("https://api.open-meteo.com/v1/forecast?"
                   f"latitude={','.join(str(p[1]) for p in lote)}&longitude={','.join(str(p[2]) for p in lote)}"
                   f"&daily={','.join(VARS[k] for k in VARS_MM)}&models={mid}&forecast_days=16&timezone=America%2FCampo_Grande")
            try:
                resp = json.loads(baixar(url))
            except Exception as e:
                print(f"multimodelo {chave}: falhou ({e})", file=sys.stderr); continue
            resp = [resp] if isinstance(resp, dict) else resp
            for (cd, _, _), r in zip(lote, resp):
                d = r.get("daily", {})
                for k in VARS_MM:
                    nome = VARS[k]
                    serie = d.get(nome) or d.get(f"{nome}_{mid}")   # com um só modelo a resposta vem sem sufixo
                    if serie:
                        bruto.setdefault(cd, {}).setdefault(chave, {})[k] = dict(zip(d["time"], serie)); ok += 1
        if ok:
            usados.append(chave)
    if not usados:
        raise RuntimeError("nenhum modelo respondeu")
    n = len(datas)
    for cd, m in out["mun"].items():
        b = bruto.get(cd, {})
        m["mod"] = {ch: [None] * n for ch in usados}
        m["p_min"], m["p_max"], m["n_mod"] = [None] * n, [None] * n, [0] * n
        for d, i in idx.items():
            if d < hoje:
                continue
            for k in VARS_MM:
                vals = [b[ch][k].get(d) for ch in usados if k in b.get(ch, {})]
                vals = [v for v in vals if v is not None]
                if vals:
                    m[k][i] = r1(sum(vals) / len(vals))
                if k == "p" and vals:
                    m["p_min"][i], m["p_max"][i], m["n_mod"][i] = r1(min(vals)), r1(max(vals)), len(vals)
            for ch in usados:
                m["mod"][ch][i] = r1(b.get(ch, {}).get("p", {}).get(d))
    out["modelos"] = {ch: MODELOS[ch][1] for ch in usados}
    print(f"multimodelo: média de {len(usados)} modelos ({', '.join(usados)})")


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
    for i in range(0, len(pts), 10):
        lote = pts[i:i + 10]
        if i:
            pausa(len(lote), (b - a).days + 1, len(nomes))
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



# ------------------------------------------------------------- ET0 Penman-Monteith (FAO-56, diária)
import math


def et0_pm(tmax, tmin, rhmax, rhmin, u2, rs, lat, z, doy):
    """ET0 (mm/dia) pelo método FAO-56 Penman-Monteith. rs em MJ m-2 dia-1, u2 em m/s a 2 m, z em m."""
    tm = (tmax + tmin) / 2
    e0 = lambda t: 0.6108 * math.exp(17.27 * t / (t + 237.3))
    es = (e0(tmax) + e0(tmin)) / 2
    ea = (e0(tmin) * rhmax / 100 + e0(tmax) * rhmin / 100) / 2
    delta = 4098 * e0(tm) / (tm + 237.3) ** 2
    pres = 101.3 * ((293 - 0.0065 * z) / 293) ** 5.26
    gama = 0.000665 * pres
    phi = math.radians(lat)
    dr = 1 + 0.033 * math.cos(2 * math.pi * doy / 365)
    dec = 0.409 * math.sin(2 * math.pi * doy / 365 - 1.39)
    ws = math.acos(max(-1, min(1, -math.tan(phi) * math.tan(dec))))
    ra = 24 * 60 / math.pi * 0.0820 * dr * (ws * math.sin(phi) * math.sin(dec) + math.cos(phi) * math.cos(dec) * math.sin(ws))
    rso = (0.75 + 2e-5 * z) * ra
    rns = 0.77 * rs
    rnl = 4.903e-9 * ((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2 * (0.34 - 0.14 * math.sqrt(max(ea, 0))) * (1.35 * min(rs / rso, 1.0) - 0.35)
    rn = rns - rnl
    return (0.408 * delta * rn + gama * 900 / (tm + 273) * u2 * (es - ea)) / (delta + gama * (1 + 0.34 * u2))

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
    iUx, iUn, iRad = col("UMIDADE REL. MAX"), col("UMIDADE REL. MIN"), col("RADIACAO GLOBAL") or col("RADIAÇÃO GLOBAL")
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
        d = dias.setdefault(dt.date().isoformat(), {"p": [], "t": [], "tx": [], "tn": [], "v": [], "ux": [], "un": [], "rad": []})
        for k, i in (("p", iP), ("t", iT), ("tx", iTx), ("tn", iTn), ("v", iV), ("ux", iUx), ("un", iUn), ("rad", iRad)):
            if i is not None and i < len(c):
                v = num(c[i])
                if v is not None:
                    d[k].append(v)
    lat, alt = num(meta.get("LATITUDE")), num(meta.get("ALTITUDE")) or 0
    serie = {}
    for dia, d in sorted(dias.items()):
        if len(d["t"]) < 18:                                 # dia com menos de 18 h de dados: descartado
            continue
        tx, tn = max(d["tx"] or d["t"]), min(d["tn"] or d["t"])
        reg = {"p": r1(sum(d["p"])) if len(d["p"]) >= 18 else None, "tx": r1(tx), "tn": r1(tn),
               "tm": r1(sum(d["t"]) / len(d["t"])),
               "v": r1(3.6 * sum(d["v"]) / len(d["v"])) if d["v"] else None}
        # ET0 FAO-56 só com dia completo: umidade, vento (10 m -> 2 m) e radiação global (kJ/m² por hora)
        rad = [x for x in d["rad"] if x > 0]
        if lat is not None and len(d["ux"]) >= 18 and len(d["un"]) >= 18 and len(d["v"]) >= 18 and len(rad) >= 8:
            rs = sum(rad) / 1000                            # kJ/m² -> MJ/m² por dia
            u2 = (sum(d["v"]) / len(d["v"])) * 4.87 / math.log(67.8 * 10 - 5.42)
            doy = datetime.fromisoformat(dia).timetuple().tm_yday
            try:
                reg["et0"] = r1(et0_pm(tx, tn, max(d["ux"]), min(d["un"]), u2, rs, lat, alt, doy))
            except (ValueError, ZeroDivisionError):
                pass
        serie[dia] = reg
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
    try:
        validar_et0(est)
    except Exception as e:
        print(f"validação ET0: falhou ({e})", file=sys.stderr)
    limite = (AGORA - timedelta(days=150)).date().isoformat()
    for e in est.values():
        e["serie"] = {d: v for d, v in sorted(e["serie"].items()) if d >= limite}
        e["ultimo_dia"] = max(e["serie"]) if e["serie"] else None
    salvar("estacoes_inmet.json", {"fonte": "INMET · estações automáticas · dados históricos anuais",
                                   "gerado": AGORA.isoformat(timespec="minutes"),
                                   "estacoes": [e for e in est.values() if e["serie"]]})


# ------------------------------------------------------------- validação da ET0 do modelo com as estações
def _stats(pares):
    n = len(pares)
    if n < 2:
        return None
    a = [x for x, _ in pares]; b = [y for _, y in pares]
    ma, mb = sum(a) / n, sum(b) / n
    sa = math.sqrt(sum((x - ma) ** 2 for x in a)); sb = math.sqrt(sum((y - mb) ** 2 for y in b))
    r = sum((x - ma) * (y - mb) for x, y in pares) / (sa * sb) if sa and sb else None
    rmse = math.sqrt(sum((y - x) ** 2 for x, y in pares) / n)
    return {"n": n, "inmet": round(ma, 2), "modelo": round(mb, 2), "vies_mm": round(mb - ma, 2),
            "vies_pct": round(100 * (mb - ma) / ma, 1) if ma else None, "rmse": round(rmse, 2), "r": round(r, 2) if r is not None else None,
            "fator": round(min(1.3, max(0.7, ma / mb)), 3) if mb and n >= 30 else None}


def _stats_chuva(pares):
    """Chuva diária estação × modelo no ponto da estação. Só descreve (não corrige): total, viés, correlação
    diária e de somas de 7 dias, e acerto de dia com/sem chuva (limiar 1 mm)."""
    n = len(pares)
    if n < 20:
        return None
    ti, tm = sum(a for a, _ in pares), sum(b for _, b in pares)
    def corr(xs):
        k = len(xs)
        if k < 3: return None
        ma, mb = sum(a for a, _ in xs) / k, sum(b for _, b in xs) / k
        sa = math.sqrt(sum((a - ma) ** 2 for a, _ in xs)); sb = math.sqrt(sum((b - mb) ** 2 for _, b in xs))
        return round(sum((a - ma) * (b - mb) for a, b in xs) / (sa * sb), 2) if sa and sb else None
    sem = [(sum(a for a, _ in pares[i:i + 7]), sum(b for _, b in pares[i:i + 7])) for i in range(0, n - 6, 7)]
    acerto = sum((a >= 1) == (b >= 1) for a, b in pares) / n
    chuvosos = [(a, b) for a, b in pares if a >= 1]
    pod = sum(b >= 1 for _, b in chuvosos) / len(chuvosos) if chuvosos else None
    return {"n": n, "total_inmet": round(ti), "total_modelo": round(tm), "vies_pct": round(100 * (tm - ti) / ti, 1) if ti else None,
            "r_diario": corr(pares), "r_7dias": corr(sem), "acerto_dias": round(100 * acerto), "deteccao": round(100 * pod) if pod is not None else None}


def validar_et0(est):
    """Compara a ET0 Penman-Monteith das estações com a ET0 do modelo no mesmo ponto:
    (a) reanálise ERA5 (base do histórico) e (b) modelo de previsão (base do balanço hídrico recente)."""
    pts = [(cod, e["lat"], e["lon"]) for cod, e in est.items() if e.get("lat") and any("et0" in v for v in e["serie"].values())]
    if not pts:
        print("validação ET0: nenhuma estação com ET0 calculável"); return
    dias_et0 = sorted({d for cod, _, _ in pts for d, v in est[cod]["serie"].items() if "et0" in v})
    fim = min(dias_et0[-1], (AGORA - timedelta(days=6)).date().isoformat())
    ini = max(dias_et0[0], (AGORA - timedelta(days=365)).date().isoformat())
    modelo = {"era5": {}, "previsao": {}}; chuva = {"era5": {}, "previsao": {}}
    for i in range(0, len(pts), 20):
        lote = pts[i:i + 20]
        lat = ",".join(str(p[1]) for p in lote); lon = ",".join(str(p[2]) for p in lote)
        for tipo, url in (("era5", f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}&start_date={ini}&end_date={fim}&daily=et0_fao_evapotranspiration,precipitation_sum&timezone=America%2FCampo_Grande"),
                          ("previsao", f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=et0_fao_evapotranspiration,precipitation_sum&past_days=92&forecast_days=1&timezone=America%2FCampo_Grande")):
            try:
                resp = json.loads(baixar(url, 300))
            except Exception as e:
                print(f"validação ET0 ({tipo}): falhou ({e})", file=sys.stderr); continue
            pausa(len(lote), 365 if tipo == "era5" else 93, 2)
            resp = [resp] if isinstance(resp, dict) else resp
            for (cod, _, _), r in zip(lote, resp):
                modelo[tipo][cod] = dict(zip(r["daily"]["time"], r["daily"]["et0_fao_evapotranspiration"]))
                chuva[tipo][cod] = dict(zip(r["daily"]["time"], r["daily"].get("precipitation_sum", [])))
    saida = []
    for cod, la, lo in pts:
        e = est[cod]; reg = {"codigo": cod, "nome": e["nome"], "lat": la, "lon": lo}
        for tipo in ("era5", "previsao"):
            m = modelo[tipo].get(cod, {})
            reg[tipo] = _stats([(v["et0"], m[d]) for d, v in e["serie"].items() if "et0" in v and m.get(d) is not None])
            c = chuva[tipo].get(cod, {})
            reg["chuva_" + tipo] = _stats_chuva([(v["p"], c[d]) for d, v in sorted(e["serie"].items()) if v.get("p") is not None and c.get(d) is not None and d <= fim])
        saida.append(reg)
    salvar("validacao_et0.json", {"descricao": "ET0 FAO-56 Penman-Monteith calculada com dados horários das estações INMET (MS) comparada com a ET0 do modelo no ponto da estação. fator = média INMET / média modelo (aplicado só com n >= 30 dias; limitado a 0,7–1,3). chuva_*: chuva diária da estação x modelo (só descritivo, sem correção).",
                                  "gerado": AGORA.isoformat(timespec="minutes"), "periodo": [ini, fim], "estacoes": saida})


if __name__ == "__main__":
    erros = []
    for nome, fn in (("Open-Meteo", open_meteo), ("INMET", inmet)):
        try:
            fn()
        except Exception as e:
            erros.append(nome); print(f"ERRO {nome}: {e}", file=sys.stderr)
    if len(erros) == 2:
        sys.exit(1)
