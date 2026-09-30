import { useState } from 'preact/hooks';
import { INTRO_TEXT, REGRESSION_TEXT, VICTORY_TEXT } from '../content/lore';
import { firstStageOfRealm } from '../content/realms';
import { formatDuration } from '../engine/format';
import { CoresTab } from './components/CoresTab';
import { CultivationPanel } from './components/CultivationPanel';
import { LogPanel } from './components/LogPanel';
import { Modal, StoryModal } from './components/Modal';
import { QiField } from './components/QiField';
import { RegressionTab } from './components/RegressionTab';
import { ResourcesTab } from './components/ResourcesTab';
import { SettingsTab } from './components/SettingsTab';
import { TechniquesTab } from './components/TechniquesTab';
import { TreasuresTab } from './components/TreasuresTab';
import { game, useGame } from './game';

type TabId = 'resources' | 'techniques' | 'cores' | 'treasures' | 'regression' | 'settings';

function visibleTabs(): { id: TabId; label: string }[] {
  const { state } = game;
  const tabs: { id: TabId; label: string }[] = [
    { id: 'resources', label: 'Resources' },
    { id: 'techniques', label: 'Techniques' },
  ];
  if (state.stats.bestStage >= firstStageOfRealm('coreFormation')) {
    tabs.push({ id: 'cores', label: 'Cores' });
  }
  if (Object.keys(state.treasures).length > 0 || state.stats.encountersClaimed > 0) {
    tabs.push({ id: 'treasures', label: 'Treasures' });
  }
  if (state.stats.bestStage >= firstStageOfRealm('foundation') || state.prestige.loops > 0) {
    tabs.push({ id: 'regression', label: 'Regression' });
  }
  tabs.push({ id: 'settings', label: 'Settings' });
  return tabs;
}

function Header() {
  const { state, stats } = game;
  return (
    <header class="top">
      <h1>
        <span class="title-glyph">飞升</span> Idle Ascension
      </h1>
      <div class="qi-display">
        <div class="qi-amount">{game.fmt(state.qi)} qi</div>
        <div class="qi-rate">{game.fmt(stats.qps)} / second</div>
      </div>
    </header>
  );
}

export function App() {
  useGame();
  const [tab, setTab] = useState<TabId>('resources');
  const [showRegressionStory, setShowRegressionStory] = useState(false);
  const { state } = game;
  const tabs = visibleTabs();
  const activeTab = tabs.some((t) => t.id === tab) ? tab : 'resources';

  let modal = null;
  if (game.haltReason) {
    modal = (
      <Modal title="Cultivation Paused" onClose={() => location.reload()} closeLabel="Reload">
        <p>{game.haltReason}</p>
      </Modal>
    );
  } else if (!state.flags.introSeen) {
    modal = (
      <StoryModal
        title="The Trash of the Lin Clan"
        paragraphs={INTRO_TEXT}
        closeLabel="Begin cultivating"
        onClose={() => game.act((s) => (s.flags.introSeen = true))}
      />
    );
  } else if (showRegressionStory) {
    modal = (
      <StoryModal
        title="Return"
        paragraphs={REGRESSION_TEXT}
        closeLabel="Begin again"
        onClose={() => setShowRegressionStory(false)}
      />
    );
  } else if (state.flags.ascended && !state.flags.victorySeen) {
    modal = (
      <StoryModal
        title="Ascension"
        paragraphs={[
          ...VICTORY_TEXT,
          'Thank you for playing this prototype! (Isekai: coming soon.)',
        ]}
        closeLabel="Bask in godhood"
        onClose={() => game.act((s) => (s.flags.victorySeen = true))}
      />
    );
  } else if (game.offlineReport) {
    const r = game.offlineReport;
    modal = (
      <Modal title="Closed-Door Cultivation" onClose={() => game.dismissOfflineReport()}>
        <p>
          You were in seclusion for {formatDuration(r.seconds)}
          {r.cappedSeconds < r.seconds &&
            ` (only the first ${formatDuration(r.cappedSeconds)} counted)`}
          .
        </p>
        <p>
          You gathered <strong>{game.fmt(r.qi)}</strong> qi.
        </p>
      </Modal>
    );
  }

  return (
    <div class="app">
      <Header />
      <main class="layout">
        <CultivationPanel />
        <div class="center">
          <QiField />
          <LogPanel />
        </div>
        <section class="panel tabs">
          <nav role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={activeTab === t.id}
                class={activeTab === t.id ? 'active' : ''}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          {activeTab === 'resources' && <ResourcesTab />}
          {activeTab === 'techniques' && <TechniquesTab />}
          {activeTab === 'cores' && <CoresTab />}
          {activeTab === 'treasures' && <TreasuresTab />}
          {activeTab === 'regression' && (
            <RegressionTab onRegressed={() => setShowRegressionStory(true)} />
          )}
          {activeTab === 'settings' && <SettingsTab />}
        </section>
      </main>
      {modal}
    </div>
  );
}
