# Audit MIS Report

**Period:** 2026-02-01 to 2026-07-04 · **Prepared:** 2026-11-16
**Source:** local copy of the plant databases (data ends 4 Jul 2026) · **Live version:** WRL Dashboard → Audit Report → Audits → **Audit MIS**

**Rules used**
- Required: 1 audit per model per production day (day = 08:00 to 08:00)
- Completed: Submitted, approved, rejected or sent for rework
- Failed: Any checkpoint other than Pass (Fail, Warning, NA, pending), or rejected / sent for rework; photo items excluded
- Audit time: Audit time = opened (StartedAt) to submitted

---

## 1. Summary

| KPI | Value |
|---|---:|
| Quantity produced (FG) | 2,26,080 |
| Models produced | 347 |
| Models audited | 3 |
| Audits required (model-days) | 3,959 |
| Audits completed | 10 (covering 3 model-days) |
| **Pending audits** | **3,956** |
| **Audit completion** | **0.1%** |
| Quantity produced with no audit | 2,25,482 (99.7%) |
| Audits still in draft | 8 |
| Passed / failed audits | 4 / 6 |
| **Pass %** | **40.0%** |
| Checkpoints checked / not passed | 722 / 10 (1.4%) |
| Audit time (avg / min / max) | 6.3 min / 0.2 min / 15.7 min (7 timed audits) |
| Avg time from submission to decision | 128.9 h |

**Key messages**
1. **Audit coverage is 0.1%.** Only 3 of 347 models produced were audited, and 99.7% of the quantity built was never covered by an audit. 3,956 model-days are pending.
2. **60.0% of completed audits failed** (6 of 10). Most failures come from rejections / rework and from checkpoints left blank, not from many checkpoints marked Fail. Only 5 checkpoint results were "Fail" against 5 left blank.
3. **All audit activity sits in a few days** (2026-02: 1, 2026-05: 9). There is no routine audit rhythm yet.
4. **An audit takes about 6.3 min** (range 0.2 min–15.7 min). Audits submitted in under a minute should be checked: AUD2026050015, AUD2026050018.
5. **The decision step is slow:** 128.9 h on average between submission and approval / rejection.

---

## 2. Model-wise audit summary

Models with audits in the period:

| Model | Qty produced | Required | Completed | Pending | Completion % | Passed | Failed | Pass % | Avg time |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| D350H224-GAINGMXXWH-XX6 | 13,983 | 92 | 4 | 91 | 1.1% | 0 | 4 | 0.0% | 5.2 min |
| D525H223-DAINGMXXWH-XX6 | 11,261 | 83 | 5 | 81 | 2.4% | 3 | 2 | 60.0% | 7.7 min |
| S F450GT23-DAINMWMWWH-XX6 | 0 | 0 | 1 | 0 | — | 1 | 0 | 100.0% | — |

The full list of all 348 models is in the dashboard (Model Summary tab → Excel).

---

## 3. Model-wise failure analysis and top failure models

| Rank | Model | Audits | Failed | Failure % | Rejected | Rework | Checks not passed | Most failed checkpoint |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | D350H224-GAINGMXXWH-XX6 | 4 | 4 | 100.0% | 2 | 2 | 5 | Cabinet Loading (1) |
| 2 | D525H223-DAINGMXXWH-XX6 | 5 | 2 | 40.0% | 0 | 0 | 5 | bcvb v (1) |

Per-audit detail:

| Audit | Day | Model | Status | Result | Checks | Not pass | Time | Failed checkpoints |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| AUD2026020001 | 2026-02-23 | S F450GT23-DAINMWMWWH-XX6 | approved | Passed | 93 | 0 | — | — |
| AUD2026050001 | 2026-05-18 | D525H223-DAINGMXXWH-XX6 | approved | Passed | 3 | 0 | — | — |
| AUD2026050002 | 2026-05-19 | D525H223-DAINGMXXWH-XX6 | approved | **Failed** | 3 | 3 | — | bcvb v; cbvb; cbcvb c |
| AUD2026050003 | 2026-05-19 | D525H223-DAINGMXXWH-XX6 | approved | Passed | 89 | 0 | 9.2 min | — |
| AUD2026050005 | 2026-05-19 | D525H223-DAINGMXXWH-XX6 | approved | **Failed** | 89 | 2 | 7.9 min | Decal Graphics; Hinge cover |
| AUD2026050006 | 2026-05-19 | D525H223-DAINGMXXWH-XX6 | approved | Passed | 89 | 0 | 5.9 min | — |
| AUD2026050013 | 2026-05-22 | D350H224-GAINGMXXWH-XX6 | rejected | **Failed** | 89 | 0 | 15.7 min | — |
| AUD2026050015 | 2026-05-22 | D350H224-GAINGMXXWH-XX6 | rework | **Failed** | 89 | 3 | 0.6 min | Cabinet Loading; Evaporator Type; Decal Pasting Alignment |
| AUD2026050016 | 2026-05-24 | D350H224-GAINGMXXWH-XX6 | rejected | **Failed** | 89 | 0 | 4.4 min | — |
| AUD2026050018 | 2026-05-27 | D350H224-GAINGMXXWH-XX6 | rework | **Failed** | 89 | 2 | 0.2 min | Inlet/outlet Position; Center partition |

---

## 4. Checkpoint-wise failure analysis

| Checkpoint | Section › Stage | Checked | Failures | Failure % | Share of all failures | Fail | NA | Blank | Models |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| bcvb v | cvb vb › cbvb | 2 | 1 | 50.0% | 10.0% | 0 | 0 | 1 | 1 |
| cbvb | cvb vb › cbvb | 2 | 1 | 50.0% | 10.0% | 0 | 0 | 1 | 1 |
| cbcvb c | cvb vb › vcb v | 2 | 1 | 50.0% | 10.0% | 0 | 0 | 1 | 1 |
| Center partition | Final Assembly › Foam Body Loading | 7 | 1 | 14.3% | 10.0% | 1 | 0 | 0 | 1 |
| Hinge cover | Final Assembly › Accessories | 7 | 1 | 14.3% | 10.0% | 0 | 0 | 1 | 1 |
| Cabinet Loading | Final Assembly › Foam Body Loading | 8 | 1 | 12.5% | 10.0% | 1 | 0 | 0 | 1 |
| Evaporator Type | Final Assembly › Foam Body Loading | 8 | 1 | 12.5% | 10.0% | 1 | 0 | 0 | 1 |
| Inlet/outlet Position | Final Assembly › Foam Body Loading | 8 | 1 | 12.5% | 10.0% | 1 | 0 | 0 | 1 |
| Decal Graphics | Final Assembly › Foam Body Loading | 8 | 1 | 12.5% | 10.0% | 0 | 0 | 1 | 1 |
| Decal Pasting Alignment | Final Assembly › Foam Body Loading | 8 | 1 | 12.5% | 10.0% | 1 | 0 | 0 | 1 |

> **Data note:** 3 of these checkpoints (e.g. "bcvb v" in section "cvb vb") are test entries from a trial template. Delete that template / its audits so they stop appearing in the analysis.

---

## 5. Model vs checkpoint

| Model | Checkpoint | Section › Stage | Checked | Failures | Failure % |
|---|---:|---:|---:|---:|---:|
| D525H223-DAINGMXXWH-XX6 | bcvb v | cvb vb › cbvb | 2 | 1 | 50.0% |
| D525H223-DAINGMXXWH-XX6 | cbvb | cvb vb › cbvb | 2 | 1 | 50.0% |
| D525H223-DAINGMXXWH-XX6 | cbcvb c | cvb vb › vcb v | 2 | 1 | 50.0% |
| D525H223-DAINGMXXWH-XX6 | Decal Graphics | Final Assembly › Foam Body Loading | 3 | 1 | 33.3% |
| D525H223-DAINGMXXWH-XX6 | Hinge cover | Final Assembly › Accessories | 3 | 1 | 33.3% |
| D350H224-GAINGMXXWH-XX6 | Cabinet Loading | Final Assembly › Foam Body Loading | 4 | 1 | 25.0% |
| D350H224-GAINGMXXWH-XX6 | Evaporator Type | Final Assembly › Foam Body Loading | 4 | 1 | 25.0% |
| D350H224-GAINGMXXWH-XX6 | Inlet/outlet Position | Final Assembly › Foam Body Loading | 4 | 1 | 25.0% |
| D350H224-GAINGMXXWH-XX6 | Center partition | Final Assembly › Foam Body Loading | 4 | 1 | 25.0% |
| D350H224-GAINGMXXWH-XX6 | Decal Pasting Alignment | Final Assembly › Foam Body Loading | 4 | 1 | 25.0% |

---

## 6. Audit time

| Model | Timed audits | Average | Minimum | Maximum |
|---|---:|---:|---:|---:|
| D350H224-GAINGMXXWH-XX6 | 4 | 5.2 min | 0.2 min | 15.7 min |
| D525H223-DAINGMXXWH-XX6 | 3 | 7.7 min | 5.9 min | 9.2 min |

Audits without a start time (older records) are not timed.

---

## 7. Audit performance trends

**Monthly**

| Month | Required | Completed | Pending | Completion % | Passed | Failed | Pass % | Checkpoint fail % | Avg time |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026-02 | 932 | 1 | 932 | 0.0% | 1 | 0 | 100.0% | 0.0% | — |
| 2026-03 | 852 | 0 | 852 | 0.0% | 0 | 0 | — | — | — |
| 2026-04 | 664 | 0 | 664 | 0.0% | 0 | 0 | — | — | — |
| 2026-05 | 747 | 9 | 744 | 0.4% | 3 | 6 | 33.3% | 1.6% | 6.3 min |
| 2026-06 | 657 | 0 | 657 | 0.0% | 0 | 0 | — | — | — |
| 2026-07 | 107 | 0 | 107 | 0.0% | 0 | 0 | — | — | — |

**Weekly (weeks with audits)**

| Week of | Required | Completed | Completion % | Passed | Failed | Pass % |
|---|---:|---:|---:|---:|---:|---:|
| 2026-02-23 | 215 | 1 | 0.0% | 1 | 0 | 100.0% |
| 2026-05-18 | 185 | 8 | 1.6% | 3 | 5 | 37.5% |
| 2026-05-25 | 169 | 1 | 0.0% | 0 | 1 | 0.0% |

**Daily (days with audits)**

| Date | Required | Completed | Passed | Failed | Pass % | Avg time |
|---|---:|---:|---:|---:|---:|---:|
| 2026-02-23 | 31 | 1 | 1 | 0 | 100.0% | — |
| 2026-05-18 | 34 | 1 | 1 | 0 | 100.0% | — |
| 2026-05-19 | 27 | 4 | 2 | 2 | 50.0% | 7.7 min |
| 2026-05-22 | 26 | 2 | 0 | 2 | 0.0% | 8.2 min |
| 2026-05-24 | 2 | 1 | 0 | 1 | 0.0% | 4.4 min |
| 2026-05-27 | 22 | 1 | 0 | 1 | 0.0% | 0.2 min |

---

## 8. Audit efficiency — biggest coverage gaps

Models ranked by quantity produced on days with no audit:

| Model | Qty produced | Required | Completed | Pending | Completion % | Unaudited qty |
|---|---:|---:|---:|---:|---:|---:|
| SRC460HC4-RI2LIBKCE | 21,952 | 99 | 0 | 99 | 0.0% | 21,952 |
| D350H224-GAINGMXXWH-XX6 | 13,983 | 92 | 4 | 91 | 1.1% | 13,818 |
| SRCL460HC6-IRECI-H | 12,270 | 60 | 0 | 60 | 0.0% | 12,270 |
| SRCL331HC6-IRECI-H | 12,103 | 81 | 0 | 81 | 0.0% | 12,103 |
| SRCL460HC6-IRECI-C | 12,005 | 73 | 0 | 73 | 0.0% | 12,005 |
| D525H223-DAINGMXXWH-XX6 | 11,261 | 83 | 5 | 81 | 2.4% | 10,828 |
| VT30HC-NSRE | 7,382 | 83 | 0 | 83 | 0.0% | 7,382 |
| SRCL331HC6-IRECI-C | 5,290 | 59 | 0 | 59 | 0.0% | 5,290 |
| SRCL331HC4-IRECI-H | 5,178 | 38 | 0 | 38 | 0.0% | 5,178 |
| SRC460HC4T-RI2LIBKCE | 4,414 | 23 | 0 | 23 | 0.0% | 4,414 |
| VT30HC-XEGCB | 3,963 | 27 | 0 | 27 | 0.0% | 3,963 |
| G200H120ECINGMXWH1 | 3,696 | 78 | 0 | 78 | 0.0% | 3,696 |
| F450GL23-DAINGMXXWH-XX6 | 3,634 | 45 | 0 | 45 | 0.0% | 3,634 |
| SRC380HCT-RI2LIBKCE | 3,443 | 61 | 0 | 61 | 0.0% | 3,443 |
| D150H163-GAINGMXXWH-XX6 | 3,381 | 44 | 0 | 44 | 0.0% | 3,381 |

---

## 9. Data issues found in the audit records

- **8 audits left in draft** (AUD2026050007, AUD2026050008, AUD2026050009, AUD2026050010, AUD2026050011, AUD2026050012, AUD2026050014, AUD2026050017). Submit or delete them.
- **Approved audits with almost no checkpoints filled:** AUD2026050001 (3 checks), AUD2026050002 (3 checks). These were approved before the completeness check was added; void or redo them.
- **Audited model names that match no production:** "S F450GT23-DAINMWMWWH-XX6" (stray prefix / typo). These audits cannot count towards any model's coverage.
- **Test checkpoints** from a trial template appear in the checkpoint analysis (see §4).

---

## 10. Recommendations

| # | Action | Owner | Target |
|---|---|---|---|
| 1 | Daily audit plan: audit every model produced that day, starting with the top 10 runners in the Coverage Gaps list. Review the Audit MIS each morning. | Line Quality Engineer | Completion ≥ 90% of model-days |
| 2 | Clear the draft backlog daily; an audit opened must be submitted the same shift. | Quality Auditors | 0 drafts older than 1 day |
| 3 | Decide submitted audits within 24 h (currently ~129 h). | Line Quality Engineer | Avg decision time ≤ 24 h |
| 4 | Treat any checkpoint failing on the same model twice as a CAPA trigger (Model × Checkpoint tab). | Quality Engineer | CAPA opened within 48 h |
| 5 | Remove the trial template and its test audits; void the two approved audits with 0–3 checkpoints. | Super Admin | Clean data |
| 6 | Investigate audits finished in under 1 minute: an 89-point checklist cannot be done that fast. | Quality Manager | No audit < 3 min |
