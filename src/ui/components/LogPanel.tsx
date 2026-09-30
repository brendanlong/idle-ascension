import { game } from '../game';

export function LogPanel() {
  return (
    <section class="panel log" aria-live="polite">
      {game.log.length === 0 && (
        <p class="muted small">Your story will be written here as you cultivate.</p>
      )}
      <ul>
        {game.log.map((entry) => (
          <li key={entry.id} class={`tone-${entry.tone}`}>
            {entry.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
