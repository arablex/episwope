# Vigilo → Predictive Risk Intelligence (CDO architecture)

Date 2026-05-17 · From reactive aggregator → predictive intelligence.
Solo-dev-feasible. Builds on the shipped engine (fast_signals.py,
risk_aggregate.py, risk_scoring.py, /api/v1/risk).

## 1. Predictive data feeds + bio-climate coupling

Feeds to add (all have free tiers):
- **Climate** — Copernicus CDS / ERA5 reanalysis + ECMWF forecast,
  NOAA GFS, Open-Meteo (free, no key) for T, precip, RH, soil-moisture
  by lat/lng. Pull daily, 0.25° grid, aggregate to admin1.
- **Hydro/flood** — Copernicus GloFAS, NASA GPM IMERG precip.
- **Transport** — OpenSky (already) + ADS-B Exchange (air), AISStream /
  MarineTraffic free tier (maritime choke points), FlightAware AeroAPI
  (paid, enterprise tier only).
- **Satellite/fire/AQI** — NASA FIRMS (active fire), Sentinel-5P (NO2/SO2),
  OpenAQ + IQAir (AQI).
- **Mobility proxy** — Wikipedia pageview spikes per country/disease,
  Google Trends, GDELT GKG tone (already).

**Bio-climate lead model (Dengue / Cholera, 7–14 d ahead).**
Vectors and waterborne pathogens are climate-forced with a known lag.
Build a per-(admin1, pathogen) hazard index:

```
# 8-week rolling climate window → standardised anomalies (z over 10-y clim)
zT  = (T  - μT ) / σT
zP  = (P  - μP ) / σP          # precip
zRH = (RH - μRH) / σRH

Dengue suitability (Aedes): unimodal in T, lagged precip+RH
  S_dengue = w1·g(T; 26,32) + w2·zP(lag 4–6w) + w3·zRH(lag 2–4w)
    g(T;a,b) = thermal-performance bell (0 outside ~16–34°C, peak ~29°C)

Cholera (Vibrio): SST/temp + heavy-rain flush + low elevation + prior burden
  S_cholera = c1·zT + c2·max(zP,0)(lag 1–3w) + c3·flood_flag + c4·endemic_w
```
Pathogen lags from literature (already have pathogen_params.py — add a
`climate_lag_weeks` and `clim_betas` field). The suitability S feeds the
predictive delta (block 2) as an exogenous regressor. Validation: backtest
against historical WHO DON onset dates → measure mean lead-time and ROC.
Honest framing: S is a **leading hazard signal**, not a case forecast.

## 2. Trend projection model (7-day Δ)

Solo-dev stack: **gradient-boosted quantile regression (LightGBM)** for
the point + interval forecast, **STL/EWMA** for the seasonal-trend
decomposition baseline, **Isolation Forest** for novelty flags. No LSTM
(data too sparse/short, ops cost not worth it for a solo dev; GBM beats
RNNs on tabular signal panels).

Feature vector per (geo, category, t):
```
x_t = [ signal_count_t, EWMA(7,28), slope_7/slope_28,
        spike_ratio, source_diversity, official_ratio,
        S_climate(lagged), wiki_pageview_z, gdelt_tone,
        neighbour_risk_mean, day-of-year sin/cos, endemic_prior ]
```
Targets: y = CompositeRiskScore at t+7. Train 3 LightGBM quantile models
(τ=0.1/0.5/0.9) → median + band.

**Delta Prediction algorithm**
```
1. assemble x_t from feature store (the JSON blobs we already write)
2. ŷ50,ŷ10,ŷ90 = LGBM_τ(x_t)              # 7-day projected composite
3. Δ = ŷ50 − Score_t                       # predictive delta
4. trend = sign(Δ) · min(|Δ|/Score_scale, 1)
5. iso_score = IsolationForest.decision(x_t)   # regime-break detector
6. if iso_score < thr → confidence_penalty, flag "novel pattern"
7. emit {score_now, proj_7d:ŷ50, band:[ŷ10,ŷ90], delta:Δ,
         trend, drivers: top-SHAP(x_t)}      # explainability via SHAP
```
SHAP top-k gives the "why" string for Enterprise (auditable, not a black
box). Retrain weekly in the GitHub Actions cron; model artefact committed
as a small `.txt`/`.onnx` (LightGBM ~KBs). Inference is pure-Python at
batch time → endpoint stays a static-blob filter (no infra change).

## 3. Agentic OSINT (AI Investigative Agents)

Trigger: a weak primary signal (GDELT cluster ≥N tone-anomaly OR a
single official low-confidence mention) where Composite < emit threshold
but novelty high → spawn an investigation job.

Pipeline (bounded, idempotent, cost-capped):
```
Orchestrator(seed) →
  ① Localise: resolve country → national-language query set
     (reuse google_news_{ru,zh}+geo_gaps; add local-lang via lang map)
  ② Harvest: fetch local media + official bulletins + 1 social proxy
     (Telegram public, Reddit) — N sources cap
  ③ Extract: LLM (Haiku) → structured claims
     {entity, event_type, geo, count, date, source_tier}
  ④ Corroborate: cluster claims; require ≥2 independent domains OR
     1 tier-1 official; cross-check dates/numbers consistency
  ⑤ Refute: LLM adversarial pass — "what would make this false?";
     check known fake/satire domains list; image/text reuse heuristic
  ⑥ Score: Confidence = f(source_diversity, official_ratio,
     corroboration_count, refutation_failures, recency)  ∈ [0,1]
  ⑦ Dossier: emit JSON {claim, evidence[], confidence, lead_time_est,
     dissent[], next_check_at}; below thr → quarantine, schedule recheck
```
State in Netlify Blobs; the loop is the existing cron + a bounded
fan-out (max agents/run, max LLM calls — reuse GROQ cap pattern).
Strictly: agents only *classify into a closed schema* and *score* — they
never publish; human/threshold gate for paid alerts. Anti-prompt-injection:
treat fetched content as untrusted, never execute instructions in it.

## 4. Killer feature — "What-If" Force-Majeure Simulator (B2B)

Product: analyst drops a synthetic trigger on the map ("Shanghai port
strike", "outbreak in a transit hub"). Backend computes the **cascade**
across adjacent regions + logistics corridors and returns the risk delta.

Technical core — a **risk propagation graph**:
```
Nodes  = {countries, major ports/airports, land corridors}
Edges  = exposure weights:
  - geographic adjacency (shared border, distance decay)
  - trade/logistics dependency (UN Comtrade, port throughput share)
  - air connectivity (OpenSky route volume)
  - supply-chain tier (sector input-output where available)

Trigger τ raises a node's category score by Δ0 (severity of scenario).
Propagation (bounded diffusion, 3 hops):
  Δ_j = Σ_i  w_ij · decay^hop · Δ_i ,  clipped, with category-specific
  transmissibility (a port strike → MOBILITY/CONTINUITY of trade
  partners; an outbreak in a hub → BIO_ENV of air-connected nodes).
Recompute Composite per affected node via risk_scoring.compose().
Return: ranked impacted geographies, corridors at risk, ETA of effect
(from decay·typical lag), and a confidence (model-based, labelled).
```
Implementation: precompute the static exposure graph (one JSON in the
repo), simulation is O(edges·hops) pure-Python at request time inside the
`/api/v1/simulate` function — fast, no infra. Inputs are sandboxed
(synthetic, never written to the live index). Sell as the Enterprise
differentiator: scenario stress-testing for underwriting / BCP.

## Build order (solo)
1. Open-Meteo + FIRMS + OpenAQ feeds → climate suitability S (cheap, big lead-time win).
2. LightGBM weekly-trained delta model + SHAP drivers in `/api/v1/risk` (`proj_7d`,`delta`,`drivers`).
3. Exposure graph + `/api/v1/simulate` (the killer demo for B2B sales).
4. Agentic OSINT last (highest complexity, gate carefully).
