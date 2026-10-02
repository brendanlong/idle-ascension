import { useState } from 'preact/hooks';
import { stageName } from '../../content/realms';
import { formatDuration } from '../../engine/format';
import { exportSave, importSave } from '../../engine/save';
import { createInitialState, type NumberFormat, type TrialAssist } from '../../engine/state';
import { game } from '../game';

const TRIAL_ASSISTS: { id: TrialAssist; label: string; help: string }[] = [
  {
    id: 'off',
    label: 'Off',
    help: 'Trials and tribulations are real-time mouse or touch challenges.',
  },
  {
    id: 'easier',
    label: 'Slower and easier',
    help: 'Trials run at 60% speed, and tribulation pass marks are 15 points lower.',
  },
  {
    id: 'skip',
    label: 'Skip trials',
    help: 'Tribulations pass automatically, and optional trials give their reward for a 50% score without being played.',
  },
];

const NUMBER_FORMATS: { id: NumberFormat; label: string }[] = [
  { id: 'short', label: '1.5M, 2.3B' },
  { id: 'myriad', label: '150万, 23亿 (Chinese myriads)' },
  { id: 'scientific', label: '1.5e6' },
];

export function SettingsTab() {
  const { state } = game;
  const [saveText, setSaveText] = useState('');
  const [message, setMessage] = useState('');
  const [resetArmed, setResetArmed] = useState(false);
  const s = state.stats;

  const doExport = async () => {
    const text = exportSave(game.state);
    setSaveText(text);
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Save copied to your clipboard.');
    } catch {
      setMessage("Couldn't copy automatically. Copy the text below instead.");
    }
  };

  const doImport = () => {
    try {
      game.replaceState(importSave(saveText), { freshStart: true });
      setMessage('Save imported.');
    } catch (e) {
      setMessage(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <div class="tab-body">
      <h3>Numbers</h3>
      <select
        value={state.settings.numberFormat}
        onChange={(e) =>
          game.act((st) => {
            st.settings.numberFormat = (e.target as HTMLSelectElement).value as NumberFormat;
          })
        }
      >
        {NUMBER_FORMATS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>

      <h3>Trial assistance</h3>
      <select
        aria-describedby="trial-assist-help"
        value={state.settings.trialAssist}
        onChange={(e) =>
          game.act((st) => {
            st.settings.trialAssist = (e.target as HTMLSelectElement).value as TrialAssist;
          })
        }
      >
        {TRIAL_ASSISTS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
      <p id="trial-assist-help" class="muted small">
        {TRIAL_ASSISTS.find((a) => a.id === state.settings.trialAssist)!.help}
      </p>

      <h3>Statistics</h3>
      <dl class="stat-list">
        <dt>Time cultivating</dt>
        <dd>{formatDuration(s.playTime)}</dd>
        <dt>This life</dt>
        <dd>{formatDuration(s.loopTime)}</dd>
        <dt>Qi gathered (all lives)</dt>
        <dd>{game.fmt(state.qiEarnedTotal)}</dd>
        <dt>Qi gathered (this life)</dt>
        <dd>{game.fmt(state.qiEarnedThisLoop)}</dd>
        <dt>Dantian presses</dt>
        <dd>{game.fmt(s.totalClicks)}</dd>
        <dt>Qi motes absorbed</dt>
        <dd>{game.fmt(s.motesAbsorbed)}</dd>
        <dt>Encounters</dt>
        <dd>{s.encountersClaimed}</dd>
        <dt>Tribulations survived / failed</dt>
        <dd>
          {s.tribulationsSurvived} / {s.tribulationsFailed}
        </dd>
        <dt>Highest realm</dt>
        <dd>{stageName(s.bestStage)}</dd>
      </dl>

      <h3>Save</h3>
      <div class="save-buttons">
        <button onClick={() => (game.save(), setMessage('Saved.'))}>Save now</button>
        <button onClick={doExport}>Export</button>
        <button onClick={doImport} disabled={!saveText.trim()}>
          Import
        </button>
      </div>
      <textarea
        rows={4}
        value={saveText}
        onInput={(e) => setSaveText((e.target as HTMLTextAreaElement).value)}
        placeholder="Export a save here, or paste one to import"
      />
      {message && <p class="muted small">{message}</p>}

      <h3>Danger</h3>
      {!resetArmed ? (
        <button class="danger" onClick={() => setResetArmed(true)}>
          Hard reset
        </button>
      ) : (
        <div class="confirm">
          <p>Erase everything, including Memories? This cannot be undone.</p>
          <button
            class="primary danger"
            onClick={() => {
              game.replaceState(createInitialState(), { freshStart: true });
              setResetArmed(false);
            }}
          >
            Erase everything
          </button>{' '}
          <button onClick={() => setResetArmed(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
