export function AboutTab() {
  return (
    <div class="tab-body about">
      <h3>Idle Ascension 飞升</h3>
      <p>
        An idle cultivation game. You begin as the trash of the Lin clan, gather qi, survive
        heavenly tribulations, forge elemental cores and, when a life goes nowhere, let your
        mother's jade pendant send you back to start again with your memories. The goal: ascend to
        godhood.
      </p>
      <p>
        By{' '}
        <a href="https://www.brendanlong.com/pages/about-me.html" target="_blank" rel="noreferrer">
          Brendan Long
        </a>
        . The source code is on{' '}
        <a href="https://github.com/brendanlong/idle-ascension" target="_blank" rel="noreferrer">
          GitHub
        </a>
        , where you can also report bugs or suggest ideas.
      </p>

      <h3>Privacy</h3>
      <p>
        There are no accounts, ads or cookies, and the game never sends your save or anything about
        how you play. Your save lives only in this browser's local storage; use Settings → Export to
        back it up or move it to another device.
      </p>
      <p>
        To see how many people visit, the site uses{' '}
        <a href="https://www.goatcounter.com/" target="_blank" rel="noreferrer">
          GoatCounter
        </a>
        , an open-source, privacy-friendly analytics service. It doesn't use cookies or store your
        IP address. It counts page views along with the referring site, and details derived from
        your browser: browser and operating system, screen size, language, and approximate location
        (country, or state/province in some countries). These are kept as aggregate counts, not a
        profile of you. Tracker blockers usually block it, which is fine. See{' '}
        <a href="https://www.goatcounter.com/help/privacy" target="_blank" rel="noreferrer">
          GoatCounter's privacy policy
        </a>
        .
      </p>
      <p class="muted small">
        The site is hosted on GitHub Pages, which may keep standard server logs (such as IP
        addresses) under{' '}
        <a
          href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
          target="_blank"
          rel="noreferrer"
        >
          GitHub's privacy statement
        </a>
        .
      </p>
    </div>
  );
}
