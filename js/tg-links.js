/* SHARE LINKS in the trigger guide: every main season / time / animal combination as a link with
   its own Copy button (the same list as the Lake Scene Links cheat sheet). Built the first time the
   guide opens. Links use this page's own address, so they work on whatever domain hosts the site. */
(function () {
  // [label, note, words]; a string on its own starts a group.
  const ROWS = [
    'Seasons and time of day',
    ['Summer, day', 'Books tab (the default)', 'summer+day'], ['Summer, night', '', 'summer+night'],
    ['Fall, day', 'Web tab', 'fall+day'], ['Fall, night', '', 'fall+night'],
    ['Winter, day', 'Workshop tab', 'winter+day'], ['Winter, night', '', 'winter+night'],
    ['Spring, day', 'Lab tab', 'spring+day'], ['Spring, night', '', 'spring+night'],
    'Shows',
    ['Play the whole year', '', 'play'], ['Play the whole year at night', '', 'play+night'],
    ['Dark mode', 'night scene, dark page', 'darkmode'],
    'Weather, light to full',
    ['Drizzle', 'level 1: steady, tiny drops, misty and damp', 'summer+drizzle'], ['Shower', 'level 2: standard rain, distinct and steady', 'spring+shower'],
    ['Tempest', 'level 3, max: blinding rain, roaring wind, thunder and lightning', 'fall+tempest'], ['Tempest at night', 'lightning over the moonlit lake', 'summer+night+tempest'],
    ['Flurries', 'level 1: light drifting flakes that melt as they land', 'winter+flurries'], ['Snow', 'level 2: steady flakes, light accumulation', 'winter+snow'],
    ['Blizzard', 'level 3, max: blinding snow and howling wind', 'winter+blizzard'],
    'Far shore, under the mountains',
    ['Buck walking out of the trees', 'all year', 'fall+deer'], ['Doe drinking', 'spring to fall', 'summer+doe'],
    ['Elk', 'fall, winter', 'fall+elk'], ['Bear walking the shore', 'spring to fall, day', 'summer+bear'],
    ['Wolf trotting along', 'fall, winter', 'winter+wolfrun'], ['Wolf howling', 'fall and winter nights', 'winter+night+wolfhowl'],
    'Right bank, the pines and the tent',
    ['Doe or buck from behind a pine', 'all year, buck in winter', 'fall+bankdeer'], ['Hare on the bank', 'white in winter', 'winter+hare'],
    ['Marley, out of the tent', 'all year, red collar', 'summer+marley'], ['Marley at night', 'all year, glowing collar', 'summer+night+marley'],
    ['Hawk on a pine top', 'spring to fall, day', 'spring+hawk'], ['Owl on a pine top', 'spring to fall, night', 'fall+night+owl'],
    ['Snowy owl', 'winter, day or night', 'winter+night+owl'],
    'Foreground, by the big tree',
    ['Doe or buck, grazing', 'all year, buck in winter', 'spring+foredeer'], ['Elk', 'fall, winter', 'winter+foreelk'],
    ['Bear, foraging', 'spring to fall, day', 'summer+forebear'], ['Wolf, walking', 'fall, winter', 'fall+forewolf'], ['Wolf howling under the big tree', 'every night, all year', 'summer+night+forehowl'],
    ['Fox', 'all year', 'fall+fox'], ['Hare across the front', 'white in winter', 'winter+snowhare'],
    'Close-ups, peeking in by the big tree (rare)',
    ['Grizzly', 'spring to fall, day', 'summer+closebear'], ['Bull elk', 'fall, winter', 'fall+closeelk'],
    ['Doe', 'spring to fall', 'spring+closedoe'], ['Buck', 'all year', 'fall+closebuck'],
    ['Wolf', 'fall, winter', 'winter+closewolf'],
    ['Marley by day', 'all year, red collar', 'summer+closemarley'], ['Marley at night', 'all year, glowing collar', 'summer+night+closemarley'],
    'Close-ups at the left edge, shy and quick to dart away',
    ['Fox, sniffing the headline', 'all year', 'fall+closefox'], ['Hare, sniffing the headline', 'white in winter', 'winter+closehare'],
    ['Chipmunk, sniffing the headline', 'spring to fall, day', 'summer+closechipmunk'], ['Squirrel, sniffing the headline', 'spring to fall, day', 'fall+closesquirrel'],
    'Tree, rocks, lake and sky',
    ['Squirrel on the big tree', 'spring to fall, day', 'fall+squirrel'], ['Chipmunk behind the small rock', 'spring to fall, day', 'summer+chipmunk'],
    ['Fisherman in his paper boat', 'spring to fall', 'summer+fisherman'], ['Fisherman at night', 'spring to fall, with his lantern', 'fall+night+fisherman'],
    ['Eagle diving', 'all year, day', 'spring+eagle'],
  ];

  function copy(text, btn, el) {
    const done = (t) => { const old = btn.textContent; btn.textContent = t; btn.classList.add('done');
      setTimeout(() => { btn.textContent = old; btn.classList.remove('done'); }, 1400); };
    const p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject();
    p.then(() => done('Copied'), () => {
      const r = document.createRange(); r.selectNodeContents(el);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); done('Selected');
    });
  }

  let built = false;
  window.__buildTgLinks = function () {
    const host = document.getElementById('tgLinks');
    if (built || !host) return;
    built = true;
    const base = location.origin + location.pathname;
    ROWS.forEach((r) => {
      if (typeof r === 'string') {
        const g = document.createElement('div'); g.className = 'tg-lgroup'; g.textContent = r; host.appendChild(g); return;
      }
      const [label, note, q] = r, href = base + '?' + q;
      const row = document.createElement('div'); row.className = 'tg-lrow';
      const what = document.createElement('span'); what.className = 'tg-lwhat'; what.textContent = label;
      if (note) { const sm = document.createElement('small'); sm.textContent = note; what.appendChild(sm); }
      const a = document.createElement('a'); a.href = href; a.textContent = '?' + q;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tg-lcopy'; b.textContent = 'Copy';
      b.addEventListener('click', () => copy(href, b, a));
      row.append(what, a, b); host.appendChild(row);
    });
  };
})();
