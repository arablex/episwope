// netlify/functions/_lib/osint-label.mjs
//
// Closes the validation loop. The journal records what we PREDICTED;
// this records what ACTUALLY HAPPENED, so the engine can be calibrated.
//
// Honest design:
//  • Label independence — confirmation uses OFFICIAL event escalation
//    (risk_index composite/conflict/health), NOT the indirect feed
//    (currency/internet) that drove the prediction. No self-confirmation.
//  • "not_confirmed" ≠ "wrong" — could be a true covert event nobody
//    confirmed. Vocabulary stays epistemically honest.
//  • Opaque countries: absence of official confirmation is uninformative
//    (the whole reason covert detection exists) → labelled
//    `opacity_unverifiable`, NOT counted as a miss. We must not punish
//    our most valuable predictions.
//  • Recall side — also surfaces `missed`: countries that officially
//    escalated while we stayed silent. Precision without recall lies.

const MIN_WINDOW_D = 7;    // give the prediction time to play out
const MAX_WINDOW_D = 30;   // after this, verdict is final
const CONFIRM_DELTA = 1.0; // official composite rise that counts as escalation

function officialSnapshot(ri){
  const cb = ri?.category_breakdown || {};
  return {
    composite: ri?.composite_risk?.score || 0,
    health:    cb.health?.score || 0,
    conflict:  cb.conflict?.score || 0,
    unrest:    cb.civil_unrest?.score || 0,
  };
}

function ageDays(entry){
  return (Date.now() - (entry.ts || Date.parse(entry.day))) / 86400000;
}

/* Label every pending entry against the now-current official picture.
   Mutates entries in place; returns a scoring summary. */
export function labelJournal(journal, RISK_INDEX, transparencyOf){
  let confirmed=0, notConfirmed=0, opacityUnverifiable=0, pending=0;
  const leadTimes=[];

  for(const e of journal){
    if(e.outcome != null) {                       // already final
      if(e.outcome === 'confirmed' && e.lead_time_days != null) leadTimes.push(e.lead_time_days);
      e.outcome === 'confirmed' ? confirmed++
        : e.outcome === 'opacity_unverifiable' ? opacityUnverifiable++
        : notConfirmed++;
      continue;
    }
    const age = ageDays(e);
    if(age < MIN_WINDOW_D){ pending++; continue; }

    const now  = officialSnapshot(RISK_INDEX[e.iso2]);
    const base = e.officialSnapshot || { composite:e.officialActivity||0, health:0, conflict:0, unrest:0 };

    // Independent ground truth: did the OFFICIAL/event side escalate?
    const rose =
      (now.composite - base.composite) >= CONFIRM_DELTA ||
      (now.conflict  - base.conflict)  >= CONFIRM_DELTA ||
      (now.unrest    - base.unrest)    >= CONFIRM_DELTA ||
      (now.health    - base.health)    >= CONFIRM_DELTA;

    if(rose){
      e.outcome = 'confirmed';
      e.lead_time_days = +age.toFixed(1);
      e.confirmedSnapshot = now;
      confirmed++; leadTimes.push(e.lead_time_days);
    } else if(age >= MAX_WINDOW_D){
      // Window closed, no official escalation.
      const T = transparencyOf ? transparencyOf(e.iso2) : (e.transparency ?? 0.7);
      if(T <= 0.45){
        // Opaque regime: "no confirmation" tells us nothing — don't punish.
        e.outcome = 'opacity_unverifiable';
        opacityUnverifiable++;
      } else {
        e.outcome = 'not_confirmed';
        notConfirmed++;
      }
    } else {
      pending++;
    }
  }

  const scored = confirmed + notConfirmed;            // opacity excluded from precision
  const precision = scored ? +(confirmed / scored).toFixed(3) : null;
  const avgLead = leadTimes.length
    ? +(leadTimes.reduce((a,b)=>a+b,0) / leadTimes.length).toFixed(1) : null;

  return { confirmed, notConfirmed, opacityUnverifiable, pending,
           precision, avgLeadDays: avgLead, scored };
}

/* Recall side: official escalations we did NOT flag in the window before.
   Returns lightweight `missed` records (false-negative visibility). */
export function detectMissed(journal, RISK_INDEX, day){
  const recentlyFlagged = new Set(
    journal.filter(e => ageDays(e) <= MAX_WINDOW_D).map(e => e.iso2));
  const missed = [];
  for(const [iso2, ri] of Object.entries(RISK_INDEX || {})){
    const comp = ri?.composite_risk?.score || 0;
    const band = ri?.composite_risk?.band || '';
    if((comp >= 3.5 || band === 'severe' || band === 'critical')
        && !recentlyFlagged.has(iso2)){
      missed.push({ day, iso2, composite:+comp.toFixed(2), band, type:'missed' });
    }
  }
  return missed;
}

export { officialSnapshot };
