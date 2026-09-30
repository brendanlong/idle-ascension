import { game } from '../game';

export function LogPanel() {
  return (
    <section class="panel log" aria-live="polite">
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
