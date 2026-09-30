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
        This game doesn't collect anything. There are no accounts, analytics, ads, cookies or
        third-party scripts, and it never sends your data anywhere. Your save lives only in this
        browser's local storage; use Settings → Export to back it up or move it to another device.
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
