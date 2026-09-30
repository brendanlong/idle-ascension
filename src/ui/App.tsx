import { useRef, useState } from 'preact/hooks';
import { INTRO_TEXT, VICTORY_TEXT } from '../content/lore';
import { firstStageOfRealm } from '../content/realms';
import { formatDuration } from '../engine/format';
import { AboutTab } from './components/AboutTab';
import { CoresTab } from './components/CoresTab';
import {
  BreakthroughBox,
  Conditions,
  CultivationPanel,
  CultivationStats,
  RealmSummary,
} from './components/CultivationPanel';
import { LogPanel } from './components/LogPanel';
import { Modal, StoryModal } from './components/Modal';
import { QiField } from './components/QiField';
import { RegressionTab } from './components/RegressionTab';
import { ResourcesTab, type BuyAmount } from './components/ResourcesTab';
import { SettingsTab } from './components/SettingsTab';
import { TechniquesTab } from './components/TechniquesTab';
import { TreasuresTab } from './components/TreasuresTab';
import { useDynamicFavicon } from './favicon';
import { game, useGame } from './game';
import { useMediaQuery } from './useMediaQuery';
import { currentTribulationTrial } from '../engine/breakthrough';

/** Below this width, the game switches to a tabbed single-column layout. */
const MOBILE_QUERY = '(max-width: 760px)';

type TabId =
  | 'cultivate'
  | 'resources'
  | 'techniques'
  | 'cores'
  | 'treasures'
  | 'regression'
  | 'settings'
  | 'about';

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
  tabs.push({ id: 'settings', label: 'Settings' }, { id: 'about', label: 'About' });
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

function TabBar({
  tabs,
  selected,
  onSelect,
  isDisabled = () => false,
  alert = null,
  class: className,
}: {
  tabs: { id: TabId; label: string }[];
  selected: TabId;
  onSelect: (id: TabId) => void;
  isDisabled?: (id: TabId) => boolean;
  /** A tab to mark as needing attention. */
  alert?: TabId | null;
  class?: string;
}) {
  return (
    <nav role="tablist" class={className}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={selected === t.id}
          class={selected === t.id ? 'active' : ''}
          disabled={isDisabled(t.id)}
          onClick={() => onSelect(t.id)}
        >
          {t.label}
          {alert === t.id && (
            <>
              <span class="tab-alert" aria-hidden="true" />
              <span class="sr-only"> (an encounter or trial is waiting)</span>
            </>
          )}
        </button>
      ))}
    </nav>
  );
}

export function App() {
  useGame();
  useDynamicFavicon(game.state);
  const { state } = game;
  // A running trial lives in the qi field. Switching layout (e.g. rotating a
  // phone past the breakpoint) or leaving the Cultivate tab would remount it
  // and restart the trial, so both wait until the trial is over.
  const trialRunning = Boolean(currentTribulationTrial(state) || state.trial.active);
  const wantsMobile = useMediaQuery(MOBILE_QUERY);
  const layout = useRef(wantsMobile);
  if (!trialRunning) layout.current = wantsMobile;
  const mobile = layout.current;
  const [tab, setTab] = useState<TabId>('cultivate');
  const [regressionStory, setRegressionStory] = useState<string[] | null>(null);
  const [buyAmount, setBuyAmount] = useState<BuyAmount>(1);
  const tabs = visibleTabs();
  const mobileTabs: { id: TabId; label: string }[] = [
    { id: 'cultivate', label: '气 Cultivate' },
    ...tabs,
  ];
  const available = mobile ? mobileTabs : tabs;
  const activeTab = available.some((t) => t.id === tab) ? tab : available[0].id;

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
  } else if (regressionStory) {
    modal = (
      <StoryModal
        title="Return"
        paragraphs={regressionStory}
        closeLabel="Begin again"
        onClose={() => setRegressionStory(null)}
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

  const tabContent = (
    <>
      {activeTab === 'resources' && (
        <ResourcesTab amount={buyAmount} onAmountChange={setBuyAmount} />
      )}
      {activeTab === 'techniques' && <TechniquesTab />}
      {activeTab === 'cores' && <CoresTab />}
      {activeTab === 'treasures' && <TreasuresTab />}
      {activeTab === 'regression' && (
        <RegressionTab
          onRegressed={(story) => {
            setRegressionStory(story);
            setBuyAmount(1);
          }}
        />
      )}
      {activeTab === 'settings' && <SettingsTab />}
      {activeTab === 'about' && <AboutTab />}
    </>
  );

  if (mobile) {
    const shown = trialRunning ? 'cultivate' : activeTab;
    const needsAttention = Boolean(state.encounter.active || state.trial.offer);
    return (
      <div class="app mobile">
        <div class="mobile-top">
          <Header />
          <TabBar
            class="mobile-tabs"
            tabs={mobileTabs}
            selected={shown}
            onSelect={setTab}
            isDisabled={(id) => trialRunning && id !== 'cultivate'}
            alert={needsAttention && shown !== 'cultivate' ? 'cultivate' : null}
          />
        </div>
        {shown === 'cultivate' ? (
          <main class="mobile-cultivate">
            <section class="panel cultivation">
              <RealmSummary compact />
              <BreakthroughBox />
            </section>
            <QiField />
            <section class="panel cultivation">
              <Conditions />
              <details>
                <summary>Cultivation stats</summary>
                <CultivationStats />
              </details>
            </section>
            <LogPanel />
          </main>
        ) : (
          <main class="panel mobile-panel">{tabContent}</main>
        )}
        {modal}
      </div>
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
          <TabBar tabs={tabs} selected={activeTab} onSelect={setTab} />
          {tabContent}
        </section>
      </main>
      {modal}
    </div>
  );
}
