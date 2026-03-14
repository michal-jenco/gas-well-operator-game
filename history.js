/* ════════════════════════════════════════════════════════
   CHRISTMAS TREE OPERATOR — Game History
   Persistent session history with lifetime stats,
   sortable table, JSON export/import.
   Loaded before game.js — singleton on window.GameHistory.
════════════════════════════════════════════════════════ */
var GameHistory = (function() {
  'use strict';

  const KEY = 'gasWellHistory';
  const MAX = 500;

  /* ── Core CRUD ── */

  function getAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }

  function save(record) {
    var h = getAll();
    h.unshift(record);
    if (h.length > MAX) h.length = MAX;
    try { localStorage.setItem(KEY, JSON.stringify(h)); } catch (e) { /* quota */ }
  }

  function clear() { localStorage.removeItem(KEY); }

  /* ── Lifetime stats ── */

  function getLifetimeStats() {
    var h = getAll();
    if (!h.length) return {
      totalGames: 0, lifetimeScore: 0, bestScore: 0,
      totalEventsResolved: 0, totalEventsFailed: 0,
      legendCount: 0, heroicCount: 0,
      avgPerf: 0, bestPerf: 0,
      avgDuration: 0, longestSession: 0,
    };
    return {
      totalGames: h.length,
      lifetimeScore: h.reduce(function(s, r) { return s + (r.score || 0); }, 0),
      bestScore: Math.max.apply(null, h.map(function(r) { return r.score || 0; })),
      totalEventsResolved: h.reduce(function(s, r) { return s + (r.eventsResolved || 0); }, 0),
      totalEventsFailed: h.reduce(function(s, r) { return s + (r.eventsFailed || 0); }, 0),
      legendCount: h.filter(function(r) { return r.isLegend; }).length,
      heroicCount: h.filter(function(r) { return r.isHeroic; }).length,
      avgPerf: Math.round(h.reduce(function(s, r) { return s + (r.perf || 0); }, 0) / h.length),
      bestPerf: Math.max.apply(null, h.map(function(r) { return r.perf || 0; })),
      avgDuration: Math.round(h.reduce(function(s, r) { return s + (r.elapsed || 0); }, 0) / h.length),
      longestSession: Math.max.apply(null, h.map(function(r) { return r.elapsed || 0; })),
    };
  }

  /* ── JSON export ── */

  function exportJSON() {
    var data = {
      exportDate: new Date().toISOString(),
      lifetimeStats: getLifetimeStats(),
      gameHistory: getAll(),
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'gas-well-history-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── JSON import ── */

  function importJSON(onDone) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function() {
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        try {
          var parsed = JSON.parse(reader.result);
          var arr = Array.isArray(parsed) ? parsed : (parsed.gameHistory || []);
          arr = arr.filter(function(r) { return typeof r.score === 'number' && r.date; });
          if (!arr.length) { alert('No valid history records found in file.'); return; }
          if (!confirm('Import ' + arr.length + ' records? This will replace your current history.')) return;
          if (arr.length > MAX) arr.length = MAX;
          localStorage.setItem(KEY, JSON.stringify(arr));
          if (onDone) onDone();
        } catch (e) {
          alert('Could not parse file — invalid JSON.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  /* ── Sortable history table renderer ── */

  var _sortField = 'date';
  var _sortAsc = false;

  function _fmtDuration(s) {
    if (!s && s !== 0) return '--';
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  }

  function renderHistoryTable(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var h = getAll();

    var cols = [
      { key: 'date',     label: 'Date',      fmt: function(v) { return v ? v.slice(0, 10) : '--'; } },
      { key: 'score',    label: 'Score',      fmt: function(v) { return typeof v === 'number' ? v.toLocaleString() : '--'; } },
      { key: 'elapsed',  label: 'Duration',   fmt: _fmtDuration },
      { key: 'eventsResolved', label: 'Events ✓', fmt: function(v, r) { return (r.eventsResolved || 0) + '/' + (r.eventsTriggered || 0); } },
      { key: 'onTargetPct', label: 'On-Target', fmt: function(v) { return (v || 0) + '%'; } },
      { key: 'perf',     label: 'Perf %',     fmt: function(v) { return (v || 0) + '%'; } },
      { key: 'rating',   label: 'Rating',     fmt: function(v) { return v || '--'; } },
    ];

    // Sort
    var sorted = h.slice().sort(function(a, b) {
      var va = a[_sortField], vb = b[_sortField];
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb + '').toLowerCase(); }
      var cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return _sortAsc ? cmp : -cmp;
    });

    var html = '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">';
    // Header
    html += '<thead><tr>';
    cols.forEach(function(c) {
      var arrow = _sortField === c.key ? (_sortAsc ? ' ▲' : ' ▼') : '';
      var color = _sortField === c.key ? '#00d2ff' : 'var(--silver)';
      html += '<th data-sort="' + c.key + '" style="padding:8px 6px;text-align:left;color:' + color + ';cursor:pointer;font-family:var(--font-display);font-size:0.7rem;letter-spacing:1.2px;text-transform:uppercase;border-bottom:1px solid var(--border);white-space:nowrap;user-select:none;">' + c.label + arrow + '</th>';
    });
    // Extra column for replay button
    html += '<th style="padding:8px 6px;border-bottom:1px solid var(--border);"></th>';
    html += '</tr></thead><tbody>';

    if (!sorted.length) {
      html += '<tr><td colspan="' + (cols.length + 1) + '" style="padding:24px;text-align:center;color:#555577;">No games played yet.</td></tr>';
    }

    sorted.forEach(function(r, i) {
      var bg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';
      html += '<tr style="background:' + bg + ';">';
      cols.forEach(function(c) {
        html += '<td style="padding:6px;color:var(--text);border-bottom:1px solid rgba(28,28,72,0.5);">' + c.fmt(r[c.key], r) + '</td>';
      });
      // Replay + export buttons
      var hasReplay = r.gameId ? 'true' : '';
      html += '<td style="padding:6px;border-bottom:1px solid rgba(28,28,72,0.5);white-space:nowrap;">';
      if (hasReplay) {
        html += '<button onclick="startReplayByGameId(\'' + r.gameId + '\')" style="padding:3px 8px;background:transparent;color:var(--cyan);border:1px solid var(--cyan);border-radius:3px;font-size:0.72rem;cursor:pointer;font-family:var(--font-display);letter-spacing:1px;" title="Watch replay">▶</button> ';
        html += '<button onclick="exportReplayByGameId(\'' + r.gameId + '\')" style="padding:3px 8px;background:transparent;color:#00e676;border:1px solid #00e676;border-radius:3px;font-size:0.72rem;cursor:pointer;font-family:var(--font-display);letter-spacing:1px;" title="Export replay">📤</button>';
      }
      html += '</td></tr>';
    });

    html += '</tbody></table>';
    el.innerHTML = html;

    // Attach sort handlers
    el.querySelectorAll('th[data-sort]').forEach(function(th) {
      th.addEventListener('click', function() {
        var key = th.getAttribute('data-sort');
        if (_sortField === key) { _sortAsc = !_sortAsc; }
        else { _sortField = key; _sortAsc = false; }
        renderHistoryTable(containerId);
      });
    });
  }

  /* ── Stats cards renderer ── */

  function renderLifetimeStats(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var s = getLifetimeStats();
    var cards = [
      { label: 'Games Played',   value: s.totalGames,              color: 'var(--cyan)' },
      { label: 'Lifetime Score', value: s.lifetimeScore.toLocaleString(), color: 'var(--orange)' },
      { label: 'Best Score',     value: s.bestScore.toLocaleString(),     color: '#ffd200' },
      { label: 'Events Resolved',value: s.totalEventsResolved,     color: '#00e676' },
      { label: 'Avg Performance',value: s.avgPerf + '%',           color: s.avgPerf >= 65 ? '#00e676' : '#ffd200' },
      { label: 'Best Performance',value: s.bestPerf + '%',         color: '#ffd200' },
      { label: '🏆 Legends',     value: s.legendCount,             color: '#ffd200' },
      { label: '⭐ Heroic Shut-Ins', value: s.heroicCount,         color: '#ffd200' },
      { label: 'Avg Duration',   value: _fmtDuration(s.avgDuration), color: 'var(--cyan)' },
      { label: 'Longest Session', value: _fmtDuration(s.longestSession), color: 'var(--cyan)' },
    ];
    el.innerHTML = cards.map(function(c) {
      return '<div style="background:#08082a;border:1px solid var(--border);border-radius:6px;padding:10px 8px;text-align:center;">' +
        '<div style="font-family:var(--font-display);font-size:0.58rem;letter-spacing:1.2px;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">' + c.label + '</div>' +
        '<div style="font-family:var(--font-display);font-size:1.05rem;font-weight:800;color:' + c.color + ';">' + c.value + '</div>' +
      '</div>';
    }).join('');
  }

  return {
    getAll: getAll,
    save: save,
    clear: clear,
    getLifetimeStats: getLifetimeStats,
    exportJSON: exportJSON,
    importJSON: importJSON,
    renderHistoryTable: renderHistoryTable,
    renderLifetimeStats: renderLifetimeStats,
    MAX: MAX,
  };
})();
