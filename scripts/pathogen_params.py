"""
pathogen_params.py — Literature-sourced epidemiological parameter library.

Each entry holds published consensus values used to weight the Threat Index.
These are STATIC constants from peer-reviewed literature / WHO fact sheets /
the MIDAS network — NOT estimated from Vigilo's own signal data.

Fields per pathogen:
  r0          : basic reproduction number (human-to-human). None = not
                sustained h2h (zoonotic / vector / environmental).
  cfr         : case fatality ratio as a proportion (0-1), typical/midpoint.
                Where treatment changes outcome dramatically, the
                higher untreated value is noted in `cfr_note`.
  serial_days : mean serial interval (days). None where not h2h.
  incubation_days : mean incubation period (days).
  route       : dominant transmission route.
  tier        : intrinsic hazard tier (independent of current activity).
  source      : short provenance tag.

Primary sources: WHO disease fact sheets; Biggerstaff et al. 2014 (flu);
Van Kerkhove et al. (MERS/H5N1); CDC Pink Book; MIDAS parameter
collections; published systematic reviews. Values are deliberately
conservative midpoints, not worst-case.
"""

# Keyed by the exact disease display name produced by fast_signals.py
PATHOGEN_PARAMS: dict[str, dict] = {
    "Ebola virus disease": {
        "r0": 1.8, "cfr": 0.50, "serial_days": 15.3, "incubation_days": 9.0,
        "route": "contact (body fluids)", "tier": "critical",
        "cfr_note": "25–90% by outbreak/strain; ~50% pooled (WHO)",
        "source": "WHO; WHO Ebola Response Team 2014 NEJM",
    },
    "Marburg virus disease": {
        "r0": 1.4, "cfr": 0.50, "serial_days": 9.0, "incubation_days": 7.0,
        "route": "contact (body fluids)", "tier": "critical",
        "cfr_note": "24–88% by outbreak; ~50% typical (WHO)",
        "source": "WHO Marburg fact sheet",
    },
    "Nipah virus": {
        "r0": 0.48, "cfr": 0.59, "serial_days": 13.0, "incubation_days": 9.0,
        "route": "zoonotic + limited h2h", "tier": "critical",
        "cfr_note": "40–75% by outbreak; ~59% (Nikolay 2019 NEJM)",
        "source": "WHO; Nikolay et al. 2019",
    },
    "Hendra virus": {
        "r0": None, "cfr": 0.57, "serial_days": None, "incubation_days": 12.0,
        "route": "zoonotic (equine)", "tier": "critical",
        "source": "WHO Hendra fact sheet",
    },
    "Plague": {
        "r0": 1.3, "cfr": 0.60, "serial_days": 6.0, "incubation_days": 3.0,
        "route": "vector (bubonic) / droplet (pneumonic)", "tier": "critical",
        "cfr_note": "pneumonic ~100% untreated, ~50% treated; bubonic ~10% treated",
        "source": "WHO plague fact sheet",
    },
    "Lassa fever": {
        "r0": 0.06, "cfr": 0.15, "serial_days": None, "incubation_days": 10.0,
        "route": "rodent reservoir + limited h2h", "tier": "warning",
        "cfr_note": "~1% community, ~15% hospitalized",
        "source": "WHO Lassa fact sheet",
    },
    "Crimean-Congo HF": {
        "r0": None, "cfr": 0.30, "serial_days": None, "incubation_days": 5.0,
        "route": "tick-borne + nosocomial", "tier": "critical",
        "cfr_note": "10–40% (WHO)",
        "source": "WHO CCHF fact sheet",
    },
    "Rift Valley fever": {
        "r0": None, "cfr": 0.01, "serial_days": None, "incubation_days": 4.0,
        "route": "zoonotic / mosquito", "tier": "warning",
        "cfr_note": "~1% overall; severe haemorrhagic form ~50%",
        "source": "WHO RVF fact sheet",
    },
    "Mpox": {
        "r0": 1.4, "cfr": 0.03, "serial_days": 9.0, "incubation_days": 8.5,
        "route": "contact / droplet", "tier": "warning",
        "cfr_note": "Clade I ~1–10%, Clade II ~0.2%",
        "source": "WHO mpox fact sheet 2024",
    },
    "Avian influenza": {
        "r0": 0.4, "cfr": 0.50, "serial_days": None, "incubation_days": 4.0,
        "route": "zoonotic (poultry) — sporadic h2h", "tier": "critical",
        "cfr_note": "H5N1 human ~52% cumulative (WHO); no sustained h2h",
        "source": "WHO H5N1 cumulative case data",
    },
    "COVID-19": {
        "r0": 2.9, "cfr": 0.009, "serial_days": 4.7, "incubation_days": 5.1,
        "route": "respiratory / aerosol", "tier": "alert",
        "cfr_note": "IFR ~0.5–1% population; variant-dependent",
        "source": "WHO; Lauer 2020; Rai 2022 (serial interval)",
    },
    "Influenza": {
        "r0": 1.3, "cfr": 0.001, "serial_days": 3.0, "incubation_days": 2.0,
        "route": "respiratory / droplet", "tier": "monitoring",
        "cfr_note": "seasonal <0.1%; pandemic strains higher",
        "source": "Biggerstaff et al. 2014 BMC ID",
    },
    "Measles": {
        "r0": 15.0, "cfr": 0.02, "serial_days": 12.0, "incubation_days": 12.5,
        "route": "airborne", "tier": "alert",
        "cfr_note": "0.1–0.2% high-income; 3–6% low-resource settings",
        "source": "CDC Pink Book; WHO measles fact sheet",
    },
    "Polio": {
        "r0": 6.0, "cfr": 0.05, "serial_days": 14.0, "incubation_days": 10.0,
        "route": "faecal-oral", "tier": "alert",
        "cfr_note": "2–5% of paralytic cases (children); higher in adults",
        "source": "CDC Pink Book; WHO polio fact sheet",
    },
    "Cholera": {
        "r0": 2.0, "cfr": 0.02, "serial_days": 5.0, "incubation_days": 1.4,
        "route": "faecal-oral (water)", "tier": "alert",
        "cfr_note": "<1% with treatment; up to 50% untreated severe",
        "source": "WHO cholera fact sheet",
    },
    "Dengue fever": {
        "r0": 4.0, "cfr": 0.01, "serial_days": 15.0, "incubation_days": 6.0,
        "route": "mosquito (Aedes)", "tier": "alert",
        "cfr_note": "<1% treated; severe dengue up to 13% untreated",
        "source": "WHO dengue fact sheet",
    },
    "Yellow fever": {
        "r0": None, "cfr": 0.30, "serial_days": None, "incubation_days": 4.5,
        "route": "mosquito (Aedes/Haemagogus)", "tier": "critical",
        "cfr_note": "~30–50% of those entering toxic phase",
        "source": "WHO yellow fever fact sheet",
    },
    "Zika virus": {
        "r0": 2.5, "cfr": 0.0001, "serial_days": 14.0, "incubation_days": 6.0,
        "route": "mosquito + sexual + vertical", "tier": "warning",
        "cfr_note": "low direct mortality; burden = congenital/GBS",
        "source": "WHO Zika fact sheet",
    },
    "Chikungunya": {
        "r0": 3.0, "cfr": 0.001, "serial_days": 14.0, "incubation_days": 5.0,
        "route": "mosquito (Aedes)", "tier": "warning",
        "source": "WHO chikungunya fact sheet",
    },
    "West Nile virus": {
        "r0": None, "cfr": 0.04, "serial_days": None, "incubation_days": 6.0,
        "route": "mosquito (Culex)", "tier": "warning",
        "cfr_note": "~3–15% of neuroinvasive cases",
        "source": "CDC West Nile",
    },
    "Malaria": {
        "r0": None, "cfr": 0.002, "serial_days": None, "incubation_days": 12.0,
        "route": "mosquito (Anopheles)", "tier": "alert",
        "cfr_note": "severe falciparum much higher; ~0.2% overall reported",
        "source": "WHO World Malaria Report",
    },
    "Meningitis": {
        "r0": 1.3, "cfr": 0.12, "serial_days": 4.0, "incubation_days": 4.0,
        "route": "respiratory / droplet (meningococcal)", "tier": "alert",
        "cfr_note": "~10–15% treated; ~50% untreated",
        "source": "WHO meningococcal fact sheet",
    },
    "Diphtheria": {
        "r0": 6.5, "cfr": 0.07, "serial_days": 15.0, "incubation_days": 3.0,
        "route": "respiratory / droplet", "tier": "alert",
        "cfr_note": "5–10% even with treatment",
        "source": "CDC Pink Book",
    },
    "Pertussis": {
        "r0": 14.0, "cfr": 0.002, "serial_days": 14.0, "incubation_days": 9.0,
        "route": "respiratory / droplet", "tier": "warning",
        "cfr_note": "<1% overall; infants substantially higher",
        "source": "CDC Pink Book",
    },
    "Typhoid fever": {
        "r0": 2.5, "cfr": 0.01, "serial_days": 14.0, "incubation_days": 12.0,
        "route": "faecal-oral", "tier": "warning",
        "cfr_note": "<1% treated; 10–20% untreated",
        "source": "WHO typhoid fact sheet",
    },
    "Tuberculosis": {
        "r0": 2.0, "cfr": 0.15, "serial_days": 365.0, "incubation_days": 42.0,
        "route": "airborne", "tier": "alert",
        "cfr_note": "~45% untreated; ~15% with current programmes",
        "source": "WHO Global TB Report",
    },
    "Hepatitis": {
        "r0": 2.0, "cfr": 0.005, "serial_days": 28.0, "incubation_days": 28.0,
        "route": "faecal-oral (A/E) / blood (B/C)", "tier": "warning",
        "cfr_note": "Hep A <1%; Hep E in pregnancy up to 25%",
        "source": "WHO hepatitis fact sheets",
    },
    "Salmonellosis": {
        "r0": None, "cfr": 0.001, "serial_days": None, "incubation_days": 1.5,
        "route": "foodborne", "tier": "monitoring",
        "source": "CDC / WHO foodborne estimates",
    },
    "E. coli": {
        "r0": None, "cfr": 0.015, "serial_days": None, "incubation_days": 3.5,
        "route": "foodborne (STEC)", "tier": "warning",
        "cfr_note": "~1–2%; higher with HUS in children",
        "source": "WHO E. coli fact sheet",
    },
    "Listeriosis": {
        "r0": None, "cfr": 0.25, "serial_days": None, "incubation_days": 8.0,
        "route": "foodborne", "tier": "alert",
        "cfr_note": "~20–30% invasive listeriosis",
        "source": "WHO listeriosis fact sheet",
    },
    "Anthrax": {
        "r0": None, "cfr": 0.45, "serial_days": None, "incubation_days": 5.0,
        "route": "zoonotic / spores", "tier": "critical",
        "cfr_note": "inhalational ~45–90%; cutaneous ~20% untreated",
        "source": "CDC anthrax",
    },
    "Brucellosis": {
        "r0": None, "cfr": 0.02, "serial_days": None, "incubation_days": 21.0,
        "route": "zoonotic (livestock/dairy)", "tier": "monitoring",
        "source": "WHO brucellosis fact sheet",
    },
    "Tularemia": {
        "r0": None, "cfr": 0.02, "serial_days": None, "incubation_days": 4.0,
        "route": "zoonotic / vector", "tier": "warning",
        "cfr_note": "~2% treated; up to 30% untreated pneumonic",
        "source": "CDC tularemia",
    },
    "Rabies": {
        "r0": None, "cfr": 0.99, "serial_days": None, "incubation_days": 60.0,
        "route": "zoonotic (bite)", "tier": "critical",
        "cfr_note": "~100% once symptomatic; preventable pre-symptom",
        "source": "WHO rabies fact sheet",
    },
    "Hantavirus": {
        "r0": None, "cfr": 0.38, "serial_days": None, "incubation_days": 21.0,
        "route": "rodent reservoir (aerosolised excreta)", "tier": "alert",
        "cfr_note": "HPS ~35–40%; HFRS ~1–15%; Andes virus rare h2h",
        "source": "CDC hantavirus",
    },
}

# Generic fallback for any disease not explicitly tabulated.
DEFAULT_PARAMS = {
    "r0": 1.5, "cfr": 0.02, "serial_days": 7.0, "incubation_days": 7.0,
    "route": "unspecified", "tier": "warning",
    "cfr_note": "generic fallback — no pathogen-specific data",
    "source": "fallback",
}


def get_params(disease: str) -> dict:
    """Return the parameter dict for a disease name (with safe fallback)."""
    p = PATHOGEN_PARAMS.get(disease)
    if p is None:
        out = dict(DEFAULT_PARAMS)
        out["fallback"] = True
        return out
    out = dict(p)
    out["fallback"] = False
    return out
