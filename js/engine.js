/* ===== PatternMatch — Analysis Engine v1.1 ===== */
/* Merged: original full pipeline + Gemini improvements:
   normalizeInput, negation detection, weight modifiers, dedup guard */

window.PM = window.PM || {};

PM.playbook = null;
PM.loadedPatterns = false;

/* ── Load playbook ── */
PM.loadPlaybook = async function () {
  if (PM.loadedPatterns) return true;
  try {
    const res = await fetch('./data/playbook.json');
    PM.playbook = await res.json();
    PM.loadedPatterns = true;
    return true;
  } catch (e) {
    console.error('Playbook load failed:', e);
    return false;
  }
};

/* ── Escape HTML ── */
PM.escape = function (s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};

/* ── Pre-process text: normalize whitespace and punctuation clusters ── */
PM.normalizeInput = function (text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')        // collapse whitespace / tabs / line-breaks
    .replace(/(!){2,}/g, '!')    // normalize !!!! → !
    .replace(/(\?){2,}/g, '?')   // normalize ???? → ?
    .trim();
};

/* ── Build regex list from category ── */
PM.buildRegexes = function (category) {
  const regexes = [];
  const data = PM.playbook.categories[category];

  if (data.patterns) {
    for (const phrase of data.patterns) {
      try {
        // Escape special chars (fixed bracket escape)
        let escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Make apostrophes optional (catches dont vs don't)
        escaped = escaped.replace(/'/g, "'?");
        regexes.push(new RegExp(escaped, 'gi'));
      } catch (e) {
        console.error(`Regex error for phrase [${phrase}]:`, e);
      }
    }
  }

  if (data.regex_patterns) {
    for (const pat of data.regex_patterns) {
      try {
        regexes.push(new RegExp(pat, 'gi'));
      } catch (e) {
        console.error(`Regex compile error [${pat}]:`, e);
      }
    }
  }

  return regexes;
};

/* ── Negation context check ── */
/* Reads 30 chars before match index to detect masking negation.
   Returns: 'suppressive' (normal negative, reduce weight),
            'manipulative' (denying while doing = amplify),
            or null (no negation). */
PM.checkNegation = function (lowerText, matchIndex, category) {
  const window = lowerText.substring(Math.max(0, matchIndex - 30), matchIndex);
  const isNegated = /\b(not|never|don'?t|didn'?t|deny|denied|wasn'?t|isn'?t|haven'?t|no\s+way)\b/.test(window);
  if (!isNegated) return null;
  // Denying a behavior mid-sentence while executing the same syntax = deceptive framing
  if (category === 'gaslighting' || category === 'isolation' || category === 'ultimatum') {
    return 'manipulative';
  }
  return 'suppressive';
};

/* ── Find all matches in text, with weight + negation metadata ── */
PM.findMatches = function (text) {
  if (!PM.playbook) return [];
  const lowerText = text.toLowerCase();
  const rawMatches = [];

  for (const [catKey, catData] of Object.entries(PM.playbook.categories)) {
    const regexes = PM.buildRegexes(catKey);

    for (const re of regexes) {
      re.lastIndex = 0;
      let m;

      while ((m = re.exec(text)) !== null) {
        const start = m.index;
        const end   = m.index + m[0].length;

        // Dedup guard: skip if exact same index + length already captured
        if (rawMatches.some(f => f.start === start && f.end === end && f.category === catKey)) {
          if (re.lastIndex === start) re.lastIndex++;
          continue;
        }

        const negationType = PM.checkNegation(lowerText, start, catKey);
        let weight = 1.0;
        let note   = '';

        if (negationType === 'manipulative') {
          weight = 1.5;
          note   = 'Manipulative negation: denying the behavior while executing it.';
        } else if (negationType === 'suppressive') {
          weight = 0.5;
        }

        rawMatches.push({
          start,
          end,
          text:     m[0],
          category: catKey,
          label:    catData.label,
          color:    catData.color,
          severity: catData.severity,
          weight,
          note
        });

        if (re.lastIndex === start) re.lastIndex++;
      }
    }
  }

  // Sort by position
  rawMatches.sort((a, b) => a.start - b.start);

  // Merge overlapping spans (keep first/highest-weight)
  const merged = [];
  for (const m of rawMatches) {
    const prev = merged[merged.length - 1];
    if (prev && m.start < prev.end) {
      if (m.end > prev.end) prev.end = m.end;
      if (m.weight > prev.weight) {
        prev.weight   = m.weight;
        prev.note     = m.note;
        prev.category = m.category;
        prev.label    = m.label;
      }
    } else {
      merged.push({ ...m });
    }
  }

  return merged;
};

/* ── Build annotated HTML with tooltip support ── */
PM.annotate = function (text, matches) {
  let html   = '';
  let cursor = 0;

  for (const m of matches) {
    if (m.start > cursor) {
      html += PM.escape(text.slice(cursor, m.start));
    }

    const catClass = 'tok-' + m.category;
    const tipLabel = PM.escape(m.label);
    const tipText  = PM.escape(m.text);
    const noteAttr = m.note ? ` data-note="${PM.escape(m.note)}"` : '';
    const weightCls = m.weight >= 1.5 ? ' tok-amplified' : (m.weight <= 0.5 ? ' tok-muted' : '');

    html += `<span class="tok ${catClass}${weightCls}" title="${tipLabel}: ${tipText}"${noteAttr}>${PM.escape(text.slice(m.start, m.end))}</span>`;
    cursor = m.end;
  }

  if (cursor < text.length) html += PM.escape(text.slice(cursor));

  return html.replace(/\n/g, '<br>');
};

/* ── Pronoun analysis ── */
PM.analyzePronouns = function (text) {
  const lower = text.toLowerCase();
  const words = lower.match(/\b\w+'?\w*\b/g) || [];

  const you  = words.filter(w => /^(you|your|yours|you're|you've|you'll|you'd|yourself)$/.test(w)).length;
  const i    = words.filter(w => /^(i|me|my|mine|myself|i'm|i've|i'll|i'd)$/.test(w)).length;
  const we   = words.filter(w => /^(we|us|our|ours|ourselves|we're|we've)$/.test(w)).length;
  const they = words.filter(w => /^(they|them|their|they're|they've)$/.test(w)).length;

  const ratio = i > 0 ? (you / i).toFixed(1) : (you > 0 ? '∞' : '—');

  return { you, i, we, they, ratio };
};

/* ── Urgency scoring (punctuation density + keyword density) ── */
PM.scoreUrgency = function (text) {
  let score = 0;
  const urgencyTerms = [
    'right now','immediately','answer me','last chance','final warning',
    'decide now','hurry','tonight','this instant','right this second',
    'do it now','not waiting','this ends now'
  ];
  const lower = text.toLowerCase();
  for (const t of urgencyTerms) score += (lower.split(t).length - 1) * 18;

  score += (text.match(/\b[A-Z]{2,}\b/g) || []).length * 8;  // all-caps words
  score += (text.match(/!/g)             || []).length * 12;  // exclamation marks
  score += (text.match(/\?\?+/g)         || []).length * 10;  // double question marks

  return Math.min(100, score);
};

/* ── Per-category weighted hit totals ── */
PM.countByCategory = function (matches) {
  const counts = {};
  for (const m of matches) {
    counts[m.category] = (counts[m.category] || 0) + (m.weight || 1);
  }
  return counts;
};

/* ── Overall risk score with pronoun asymmetry multiplier ── */
PM.riskScore = function (catCounts, pronouns, urgency) {
  const highRisk = ['ultimatum', 'gaslighting', 'isolation', 'blame_shift', 'surveillance'];
  let score = 0;
  for (const cat of highRisk) score += (catCounts[cat] || 0) * 20;
  score += (catCounts['love_bombing'] || 0) * 12;
  score += urgency * 0.25;

  // Pronoun asymmetry multiplier (heavily you-focused = accusatory)
  let multiplier = 1.0;
  if (pronouns.you > 0 && pronouns.i > 0) {
    const ratio = pronouns.you / (pronouns.i + pronouns.we + 1);
    if (ratio > 2.0) multiplier = 1.25;
  }
  if (pronouns.you > 4 && pronouns.i === 0) multiplier = 1.35;

  return Math.min(100, Math.round(score * multiplier));
};

/* ── Full async analysis pipeline ── */
PM.analyze = async function (rawText) {
  await PM.loadPlaybook();

  const text      = PM.normalizeInput(rawText);
  const matches   = PM.findMatches(text);
  const pronouns  = PM.analyzePronouns(text);
  const urgency   = PM.scoreUrgency(text);
  const catCounts = PM.countByCategory(matches);
  const overall   = PM.riskScore(catCounts, pronouns, urgency);

  const scores = {
    urgency,
    isolation:    Math.min(100, (catCounts.isolation    || 0) * 32),
    blame_shift:  Math.min(100, (catCounts.blame_shift  || 0) * 28 + (pronouns.you > 3 ? 18 : 0)),
    gaslighting:  Math.min(100, (catCounts.gaslighting  || 0) * 32),
    surveillance: Math.min(100, (catCounts.surveillance || 0) * 32),
    overall
  };

  const verdictLevel =
    overall === 0 && matches.length === 0 ? 'none'   :
    overall >= 55 || matches.some(m => m.weight >= 1.5 && m.severity === 'high') ? 'high' :
    overall >= 25 || matches.length >= 2  ? 'medium' : 'low';

  const verdictMessages = {
    none:   '// no manipulation patterns detected in this text.',
    low:    `// low_risk — ${matches.length} pattern(s) flagged. Some concerning language present; context matters.`,
    medium: `// medium_risk — ${matches.length} pattern(s) flagged. Notable coercive tactics detected. Trust your instincts.`,
    high:   `// high_risk — ${matches.length} pattern(s) flagged. Multiple sustained coercion tactics detected. This is not normal.`
  };

  return {
    matches,
    pronouns,
    scores,
    catCounts,
    verdictLevel,
    verdictMessage:  verdictMessages[verdictLevel],
    annotatedHTML:   PM.annotate(text, matches),
    flagList:        PM.buildFlagList(matches)
  };
};

/* ── Deduplicated flag list for sidebar ── */
PM.buildFlagList = function (matches) {
  const seen  = new Set();
  const flags = [];
  for (const m of matches) {
    const key = m.category + ':' + m.text.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      flags.push(m);
    }
  }
  return flags;
};

/* ── Category badge class ── */
PM.badgeClass = function (cat) {
  const map = {
    ultimatum:    'badge-red',
    isolation:    'badge-amber',
    gaslighting:  'badge-purple',
    blame_shift:  'badge-pink',
    love_bombing: 'badge-teal',
    surveillance: 'badge-blue'
  };
  return map[cat] || 'badge-gray';
};

/* ── Local journal storage ── */
PM.journal = {
  key: 'pm_journal',

  getAll: function () {
    try { return JSON.parse(localStorage.getItem(this.key) || '[]'); }
    catch { return []; }
  },

  save: function (entry) {
    const entries = this.getAll();
    entries.unshift({ id: Date.now(), date: new Date().toISOString(), ...entry });
    localStorage.setItem(this.key, JSON.stringify(entries.slice(0, 100)));
  },

  delete: function (id) {
    const entries = this.getAll().filter(e => e.id !== id);
    localStorage.setItem(this.key, JSON.stringify(entries));
  },

  clear: function () { localStorage.removeItem(this.key); }
};

/* ── Safety checklist storage ── */
PM.checklist = {
  key: 'pm_checklist',

  getChecked: function () {
    try { return JSON.parse(localStorage.getItem(this.key) || '[]'); }
    catch { return []; }
  },

  toggle: function (id) {
    const checked = this.getChecked();
    const idx = checked.indexOf(id);
    if (idx === -1) checked.push(id);
    else checked.splice(idx, 1);
    localStorage.setItem(this.key, JSON.stringify(checked));
    return !checked.includes(id) ? false : true;
  },

  isChecked: function (id) { return this.getChecked().includes(id); },

  clear: function () { localStorage.removeItem(this.key); }
};
