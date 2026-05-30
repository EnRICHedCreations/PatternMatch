/* ===== PatternMatch — Analysis Engine ===== */

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

/* ── Build regex list from category ── */
PM.buildRegexes = function (category) {
  const regexes = [];
  const data = PM.playbook.categories[category];

  // Literal phrase patterns (case-insensitive, word boundaries where sensible)
  if (data.patterns) {
    for (const phrase of data.patterns) {
      try {
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regexes.push(new RegExp(escaped, 'gi'));
      } catch (e) {}
    }
  }

  // Explicit regex patterns
  if (data.regex_patterns) {
    for (const pat of data.regex_patterns) {
      try {
        regexes.push(new RegExp(pat, 'gi'));
      } catch (e) {}
    }
  }

  return regexes;
};

/* ── Find all matches in text ── */
PM.findMatches = function (text) {
  if (!PM.playbook) return [];
  const matches = [];

  for (const [catKey, catData] of Object.entries(PM.playbook.categories)) {
    const regexes = PM.buildRegexes(catKey);
    for (const re of regexes) {
      let m;
      while ((m = re.exec(text)) !== null) {
        matches.push({
          start: m.index,
          end: m.index + m[0].length,
          text: m[0],
          category: catKey,
          label: catData.label,
          color: catData.color
        });
      }
    }
  }

  // Sort by position
  matches.sort((a, b) => a.start - b.start);

  // Merge overlapping
  const merged = [];
  for (const m of matches) {
    if (merged.length && m.start < merged[merged.length - 1].end) {
      const prev = merged[merged.length - 1];
      if (m.end > prev.end) prev.end = m.end;
      // prefer higher severity category
    } else {
      merged.push({ ...m });
    }
  }

  return merged;
};

/* ── Build annotated HTML ── */
PM.annotate = function (text, matches) {
  let html = '';
  let cursor = 0;

  for (const m of matches) {
    if (m.start > cursor) {
      html += PM.escape(text.slice(cursor, m.start));
    }
    const catClass = 'tok-' + m.category;
    const label = PM.escape(m.label);
    html += `<span class="tok ${catClass}" title="${label}: ${PM.escape(m.text)}">${PM.escape(text.slice(m.start, m.end))}</span>`;
    cursor = m.end;
  }

  if (cursor < text.length) {
    html += PM.escape(text.slice(cursor));
  }

  // Preserve line breaks
  return html.replace(/\n/g, '<br>');
};

/* ── Pronoun analysis ── */
PM.analyzePronouns = function (text) {
  const lower = text.toLowerCase();
  const words = lower.split(/[\s,\.!?;:]+/).filter(Boolean);

  const you   = words.filter(w => /^(you|your|you'?re|you'?ve|you'?ll|you'?d|yourself)$/.test(w)).length;
  const i     = words.filter(w => /^(i|i'?m|i'?ve|i'?ll|i'?d|myself|me|my)$/.test(w)).length;
  const we    = words.filter(w => /^(we|we'?re|us|our|ourselves)$/.test(w)).length;
  const they  = words.filter(w => /^(they|them|their|they'?re|they'?ve)$/.test(w)).length;

  const ratio = i > 0 ? (you / i).toFixed(1) : (you > 0 ? '∞' : '—');

  return { you, i, we, they, ratio };
};

/* ── Urgency scoring ── */
PM.scoreUrgency = function (text) {
  let score = 0;
  const urgencyTerms = ['right now','immediately','answer me','last chance','final warning',
    'decide now','hurry','tonight','this instant','right this second','now now','do it now',
    'not waiting','i won\'t wait','i\'m not going to wait'];
  const lower = text.toLowerCase();
  for (const t of urgencyTerms) {
    const count = (lower.split(t).length - 1);
    score += count * 18;
  }
  // Caps words
  const capsMatches = text.match(/\b[A-Z]{2,}\b/g) || [];
  score += capsMatches.length * 8;
  // Exclamation marks
  const excl = (text.match(/!/g) || []).length;
  score += excl * 12;
  // Multiple question marks
  const qmarks = (text.match(/\?\?+/g) || []).length;
  score += qmarks * 10;
  return Math.min(100, score);
};

/* ── Per-category flag counts ── */
PM.countByCategory = function (matches) {
  const counts = {};
  for (const m of matches) {
    counts[m.category] = (counts[m.category] || 0) + 1;
  }
  return counts;
};

/* ── Overall risk score ── */
PM.riskScore = function (matches, pronouns, urgency) {
  const cats = PM.countByCategory(matches);
  const highRisk = ['ultimatum','gaslighting','isolation','blame_shift','surveillance'];
  let score = 0;
  for (const cat of highRisk) {
    score += (cats[cat] || 0) * 20;
  }
  score += (cats['love_bombing'] || 0) * 12;
  if (pronouns.you > 4) score += 15;
  if (pronouns.ratio !== '—' && pronouns.ratio !== '∞' && parseFloat(pronouns.ratio) > 3) score += 10;
  score += urgency * 0.25;
  return Math.min(100, Math.round(score));
};

/* ── Full analysis ── */
PM.analyze = async function (text) {
  await PM.loadPlaybook();

  const matches   = PM.findMatches(text);
  const pronouns  = PM.analyzePronouns(text);
  const urgency   = PM.scoreUrgency(text);
  const catCounts = PM.countByCategory(matches);
  const overall   = PM.riskScore(matches, pronouns, urgency);

  const scores = {
    urgency,
    isolation:   Math.min(100, (catCounts.isolation    || 0) * 32),
    blame_shift: Math.min(100, (catCounts.blame_shift  || 0) * 28 + (pronouns.you > 3 ? 18 : 0)),
    gaslighting: Math.min(100, (catCounts.gaslighting  || 0) * 32),
    surveillance:Math.min(100, (catCounts.surveillance || 0) * 32),
    overall
  };

  const verdictLevel = overall === 0 ? 'none' : overall < 25 ? 'low' : overall < 55 ? 'medium' : 'high';

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
    verdictMessage: verdictMessages[verdictLevel],
    annotatedHTML: PM.annotate(text, matches),
    flagList: PM.buildFlagList(matches)
  };
};

/* ── Deduplicated flag list ── */
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

/* ── Category badge color class ── */
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
    try {
      return JSON.parse(localStorage.getItem(this.key) || '[]');
    } catch { return []; }
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

  clear: function () {
    localStorage.removeItem(this.key);
  }
};

/* ── Safety checklist storage ── */
PM.checklist = {
  key: 'pm_checklist',

  getChecked: function () {
    try {
      return JSON.parse(localStorage.getItem(this.key) || '[]');
    } catch { return []; }
  },

  toggle: function (id) {
    const checked = this.getChecked();
    const idx = checked.indexOf(id);
    if (idx === -1) checked.push(id);
    else checked.splice(idx, 1);
    localStorage.setItem(this.key, JSON.stringify(checked));
    return checked.includes(id);
  },

  isChecked: function (id) {
    return this.getChecked().includes(id);
  }
};
