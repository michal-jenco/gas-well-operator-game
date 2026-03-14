/* ════════════════════════════════════════════════════════
   CHRISTMAS TREE OPERATOR — Replay System
   Records player inputs during gameplay, stores replays
   in localStorage, plays them back at variable speed.
   Loaded before game.js — singletons on window.*.
════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────
   REPLAY RECORDER
   Captures a snapshot (RNG seed) + timestamped player
   inputs. Timestamps use GS.elapsed (game-tick time,
   0.25s resolution) so replays are frame-perfect.
──────────────────────────────────────────────────── */
var ReplayRecorder = (function() {
  'use strict';

  var _recording = false;
  var _events    = [];
  var _gameId    = null;
  var _snapshot  = null;

  function start(snapshot) {
    _recording = true;
    _gameId    = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    _snapshot  = JSON.parse(JSON.stringify(snapshot));
    _events    = [];
  }

  function recordAction(type, data) {
    if (!_recording) return;
    var t = window._replayGetElapsed ? window._replayGetElapsed() : 0;

    // Deduplicate choke events within the same tick — keep last value only
    if (type === 'choke' && _events.length > 0) {
      var last = _events[_events.length - 1];
      if (last.type === 'choke' && last.t === t) {
        last.d = data;
        return;
      }
    }

    _events.push({ t: t, type: type, d: data !== undefined ? data : null });
  }

  function stop() {
    if (!_recording) return null;
    _recording = false;

    // Trim idle lead-in: shift timestamps so the first event starts at ≤0.5s
    var evts = _events.slice();
    if (evts.length > 0) {
      var offset = Math.max(0, evts[0].t - 0.5);
      if (offset > 0) {
        for (var i = 0; i < evts.length; i++) {
          evts[i] = { t: +(evts[i].t - offset).toFixed(2), type: evts[i].type, d: evts[i].d };
        }
      }
    }

    return {
      gameId:   _gameId,
      date:     new Date().toISOString(),
      version:  1,
      snapshot: _snapshot,
      events:   evts,
    };
  }

  function isRecording() { return _recording; }
  function getGameId()   { return _gameId; }

  return {
    start:        start,
    recordAction: recordAction,
    stop:         stop,
    isRecording:  isRecording,
    getGameId:    getGameId,
  };
})();


/* ────────────────────────────────────────────────────
   REPLAY STORAGE
   Persists replay objects in localStorage.
──────────────────────────────────────────────────── */
var ReplayStorage = (function() {
  'use strict';

  var KEY = 'gasWellReplays';
  var MAX = 30;

  function getAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }

  function save(replay) {
    var arr = getAll();
    arr.unshift(replay);
    if (arr.length > MAX) arr.length = MAX;
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) { /* quota */ }
  }

  function getByGameId(id) {
    return getAll().find(function(r) { return r.gameId === id; }) || null;
  }

  function remove(gameId) {
    var arr = getAll().filter(function(r) { return r.gameId !== gameId; });
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {}
  }

  function clear() { localStorage.removeItem(KEY); }

  function exportReplay(gameId) {
    var r = getByGameId(gameId);
    if (!r) { alert('Replay not found.'); return; }
    var blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'gas-well-replay-' + (r.date || '').slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importReplay(onLoaded) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function() {
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        try {
          var r = JSON.parse(reader.result);
          if (!r.snapshot || !Array.isArray(r.events)) {
            alert('Invalid replay file — missing snapshot or events.'); return;
          }
          if (!confirm('Import replay with ' + r.events.length + ' events?\nPlayback will start immediately.')) return;
          if (onLoaded) onLoaded(r);
        } catch (e) {
          alert('Could not parse file — invalid JSON.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  return {
    getAll:       getAll,
    save:         save,
    getByGameId:  getByGameId,
    remove:       remove,
    clear:        clear,
    exportReplay: exportReplay,
    importReplay: importReplay,
    MAX:          MAX,
  };
})();


/* ────────────────────────────────────────────────────
   REPLAY PLAYER
   Drives playback by hooking into the 250ms game loop.
   Uses GS.elapsed-based scheduling — on each physics
   tick, all events whose t ≤ elapsed are applied.
   Speed control adjusts the setInterval timing.
──────────────────────────────────────────────────── */
var ReplayPlayer = (function() {
  'use strict';

  var _playing  = false;
  var _paused   = false;
  var _replay   = null;
  var _eventIndex = 0;
  var _speed    = 4;
  var _pausedByVisibility = false;
  var _finished = false;
  var SPEEDS    = [1, 2, 4, 8, 16];

  /* ── Getters ── */
  function isPlaying() { return _playing; }
  function isPaused()  { return _paused; }
  function getSpeed()  { return _speed; }

  /* ── Start playback ── */
  function start(replay) {
    if (_playing) stop();
    _replay     = replay;
    _eventIndex = 0;
    _paused     = false;
    _playing    = true;
    _finished   = false;

    // Set replay seed — game.js reads this when starting
    window._replaySeed = replay.snapshot.seed;
    window._replayMode = true;

    // Reset game state and start
    if (window.gameReset) window.gameReset();

    // Hook into tick loop — set before gameStart so the first tick is captured
    window._replayTickHook = _processTick;

    // Hook game-end detection
    window._replayOnGameEnd = _onGameEnd;

    if (window.gameStart) window.gameStart();

    // Apply speed (creates faster interval)
    _applySpeed();

    // Show overlay
    _showOverlay();
    _updateSpeedUI();
    _updatePauseUI();
    _updateProgressUI();
  }

  /* ── Tick processor — called after each physicsTick ── */
  function _processTick() {
    if (!_playing || _paused || !_replay) return;
    var elapsed = window._replayGetElapsed ? window._replayGetElapsed() : 0;

    // Process all events due at or before current elapsed time
    while (_eventIndex < _replay.events.length) {
      var ev = _replay.events[_eventIndex];
      if (ev.t > elapsed) break;
      _applyEvent(ev);
      _eventIndex++;
    }

    _updateProgressUI();
  }

  /* ── Apply a single replay event ── */
  function _applyEvent(ev) {
    // Set flag so action functions skip recording + replay guards
    window._inReplayAction = true;
    switch (ev.type) {
      case 'valve':
        if (window.gameToggleValve) window.gameToggleValve(ev.d);
        break;
      case 'choke':
        if (window.gameSetChoke) window.gameSetChoke(ev.d);
        break;
      case 'compressor':
        if (window.gameToggleCompressor) window.gameToggleCompressor();
        break;
      case 'stop':
        if (window.gameStop) window.gameStop();
        break;
    }
    window._inReplayAction = false;
  }

  /* ── Game end detected (from showSessionReport hook) ── */
  function _onGameEnd() {
    if (!_playing) return;
    _finished = true;
    _updateProgressUI();
    _updatePauseUI();

    // Update overlay to show completion
    var statusEl = document.getElementById('gReplayStatus');
    if (statusEl) { statusEl.textContent = 'Replay Complete!'; statusEl.style.color = '#00e676'; }

    var restartBtn = document.getElementById('gReplayRestartBtn');
    if (restartBtn) restartBtn.style.display = 'inline-block';
  }

  /* ── Pause / Resume ── */
  function pause() {
    if (!_playing || _paused || _finished) return;
    _paused = true;
    // Pause the game engine
    if (window.gamePause) window.gamePause();
    _updatePauseUI();
  }

  function resume() {
    if (!_playing || !_paused || _finished) return;
    _paused = false;
    // Resume the game engine (gamePause toggles)
    if (window.gamePause) window.gamePause();
    _updatePauseUI();
  }

  function togglePause() {
    if (_paused) resume(); else pause();
  }

  /* ── Speed control ── */
  function setSpeed(s) {
    _speed = s;
    _applySpeed();
    _updateSpeedUI();
  }

  function cycleSpeed() {
    var idx = SPEEDS.indexOf(_speed);
    _speed = SPEEDS[(idx + 1) % SPEEDS.length];
    _applySpeed();
    _updateSpeedUI();
  }

  function _applySpeed() {
    if (window._replaySetSpeed) window._replaySetSpeed(_speed);
  }

  /* ── Stop playback ── */
  function stop() {
    _playing  = false;
    _paused   = false;
    _finished = false;
    _replay   = null;
    _eventIndex = 0;

    window._replayTickHook  = null;
    window._replayOnGameEnd = null;
    window._replayMode      = false;
    window._replaySeed      = null;
    window._inReplayAction  = false;

    // Restore normal speed
    if (window._replaySetSpeed) window._replaySetSpeed(1);

    _hideOverlay();
  }

  /* ── Restart ── */
  function restart() {
    if (!_replay) return;
    var r = _replay;
    var spd = _speed;
    stop();
    _speed = spd;
    start(r);
  }

  /* ── Progress ── */
  function getProgress() {
    if (!_replay || !_replay.events.length) return 0;
    return Math.min(1, _eventIndex / _replay.events.length);
  }

  function getProgressTime() {
    if (!_replay || !_replay.events.length) return { current: 0, total: 0 };
    var total = _replay.events[_replay.events.length - 1].t;
    var current = _eventIndex < _replay.events.length
      ? _replay.events[Math.min(_eventIndex, _replay.events.length - 1)].t
      : total;
    return { current: current, total: total };
  }

  function _fmtTime(s) {
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  /* ── Overlay UI ── */
  function _showOverlay() {
    var ov = document.getElementById('gReplayOverlay');
    if (ov) ov.style.display = 'block';
  }

  function _hideOverlay() {
    var ov = document.getElementById('gReplayOverlay');
    if (ov) ov.style.display = 'none';
  }

  function _updateProgressUI() {
    var bar   = document.getElementById('gReplayProgressBar');
    var label = document.getElementById('gReplayProgressLbl');
    var pct   = getProgress() * 100;
    var pt    = getProgressTime();
    if (bar) bar.style.width = Math.min(100, pct) + '%';
    if (label) label.textContent = _fmtTime(pt.current) + ' / ' + _fmtTime(pt.total);
  }

  function _updateSpeedUI() {
    var btn = document.getElementById('gReplaySpeedBtn');
    if (btn) btn.textContent = '⚡ ' + _speed + '×';
  }

  function _updatePauseUI() {
    var btn = document.getElementById('gReplayPauseBtn');
    if (!btn) return;
    if (_finished) {
      btn.textContent = '⏸ Pause';
      btn.disabled = true;
      btn.style.opacity = '0.4';
    } else if (_paused) {
      btn.textContent = '▶ Resume';
      btn.disabled = false;
      btn.style.opacity = '1';
    } else {
      btn.textContent = '⏸ Pause';
      btn.disabled = false;
      btn.style.opacity = '1';
    }

    // Show restart button only when finished
    var restartBtn = document.getElementById('gReplayRestartBtn');
    if (restartBtn) restartBtn.style.display = _finished ? 'inline-block' : 'none';
  }

  /* ── Background tab auto-pause ── */
  document.addEventListener('visibilitychange', function() {
    if (!_playing) return;
    if (document.hidden) {
      if (!_paused && !_finished) {
        pause();
        _pausedByVisibility = true;
      }
    } else {
      if (_pausedByVisibility && _paused) {
        resume();
        _pausedByVisibility = false;
      }
    }
  });

  return {
    start:        start,
    stop:         stop,
    restart:      restart,
    pause:        pause,
    resume:       resume,
    togglePause:  togglePause,
    setSpeed:     setSpeed,
    cycleSpeed:   cycleSpeed,
    isPlaying:    isPlaying,
    isPaused:     isPaused,
    getSpeed:     getSpeed,
    getProgress:  getProgress,
    getProgressTime: getProgressTime,
  };
})();


/* ────────────────────────────────────────────────────
   REPLAY UI HELPERS
   Modal renderers, launcher, post-game hooks.
──────────────────────────────────────────────────── */

/* ── Launch replay by gameId ── */
function startReplayByGameId(gameId) {
  var replay = ReplayStorage.getByGameId(gameId);
  if (!replay) { alert('Replay not found — it may have been cleared or is from an older session.'); return; }
  // Close any open modals
  var hist = document.getElementById('gHistoryModal');
  if (hist) hist.style.display = 'none';
  ReplayPlayer.start(replay);
}

/* ── Open history modal ── */
function openHistoryModal() {
  var modal = document.getElementById('gHistoryModal');
  if (!modal) return;
  modal.style.display = 'flex';
  GameHistory.renderLifetimeStats('gHistoryStats');
  GameHistory.renderHistoryTable('gHistoryTableWrap');
}

function closeHistoryModal() {
  var modal = document.getElementById('gHistoryModal');
  if (modal) modal.style.display = 'none';
}

/* ── Clear all data ── */
function clearAllGameData() {
  if (!confirm('Delete ALL game history and saved replays? This cannot be undone.')) return;
  GameHistory.clear();
  ReplayStorage.clear();
  // Refresh modal if open
  GameHistory.renderLifetimeStats('gHistoryStats');
  GameHistory.renderHistoryTable('gHistoryTableWrap');
}

/* ── Export current replay by gameId ── */
function exportReplayByGameId(gameId) {
  ReplayStorage.exportReplay(gameId);
}

/* ── Import replay ── */
function importAndPlayReplay() {
  ReplayStorage.importReplay(function(replay) {
    closeHistoryModal();
    ReplayPlayer.start(replay);
  });
}

/* ── Stop replay and start fresh game ── */
function stopReplayAndReset() {
  ReplayPlayer.stop();
  if (window.gameReset) window.gameReset();
}
