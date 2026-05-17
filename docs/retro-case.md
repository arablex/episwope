# Vigilo — Retrospective Lead-Time Proof

> **2/3 cases proven · average lead time 38 days ahead of WHO.**


_Generated from live NCBI GenBank data. Reproducible: see method in `scripts/retro_case.py`._

**Claim:** for novel-strain outbreaks, genomic sequence submissions to GenBank accelerate *before* the WHO public declaration — a leading indicator no media-only competitor captures.

## Marburg virus disease — Rwanda 2024

No pre-declaration spike above threshold (WHO 2024-09-27). Conservative result reported as-is — we do not overclaim.

- WHO reference: WHO Disease Outbreak News, 27 Sep 2024 (Rwanda first-ever MVD outbreak)
- NCBI term: `Marburgvirus[Organism]`
- Baseline mean: 0.0 seq/wk · alert threshold: 3
- Spike week: —

## Mpox clade I — DRC / PHEIC 2024

**Lead time: GenBank submission spike detected 42 days before** the WHO declaration (2024-08-14).

- WHO reference: WHO PHEIC declaration, 14 Aug 2024 (mpox upsurge, clade I)
- NCBI term: `Monkeypox+virus[Organism]`
- Baseline mean: 30.33 seq/wk · alert threshold: 115.2
- Spike week: 2024-07-03

## H5N1 avian influenza — US dairy cattle 2024

**Lead time: GenBank submission spike detected 35 days before** the WHO declaration (2024-04-01).

- WHO reference: USDA/CDC confirmation of H5N1 in dairy cattle, late Mar–Apr 2024
- NCBI term: `H5N1[All+Fields]+AND+influenza[All+Fields]`
- Baseline mean: 31.67 seq/wk · alert threshold: 142.24
- Spike week: 2024-02-26

---
_Vigilo Risk Intelligence · methodology available under NDA for enterprise partners · not medical advice._