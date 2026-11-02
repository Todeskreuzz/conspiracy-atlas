// Readable version of /feed.xml. Feed readers still get the raw feed; people get this page.
// Everything from the feed is inserted as text (never as HTML).
(function () {
  var de = new URLSearchParams(location.search).get('lang') === 'de';
  var T = de
    ? {
        intro: 'Das ist ein RSS-Feed. Kopiere die Adresse unten in deinen Feed-Reader, dann bekommst du neue Fallakten und den Fall des Tages automatisch.',
        latest: 'Neueste Fallakten',
        loading: 'Lade Fallakten …',
        unavailable: 'Derzeit nicht verfügbar! Der Feed konnte gerade nicht geladen werden.',
        daily: 'Fall des Tages',
        site: 'Zur Webseite',
        raw: 'Rohdaten des Feeds öffnen',
        home: '/de/',
        feed: '/feed.xml?lang=de',
      }
    : {
        intro: 'This is an RSS feed. Copy the address below into your feed reader to get new case files and the case of the day automatically.',
        latest: 'Latest case files',
        loading: 'Loading case files …',
        unavailable: 'Currently unavailable! The feed could not be loaded right now.',
        daily: 'Case of the day',
        site: 'Go to the website',
        raw: 'Open raw feed',
        home: '/',
        feed: '/feed.xml',
      };

  function setText(id, value) {
    document.getElementById(id).textContent = value;
  }

  function safeHref(value) {
    try {
      var url = new URL(value, location.origin);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch (e) {
      return null;
    }
  }

  document.documentElement.lang = de ? 'de' : 'en';
  document.querySelectorAll('[data-t]').forEach(function (el) {
    el.textContent = T[el.getAttribute('data-t')];
  });
  var feedUrl = new URL(T.feed, location.origin).href;
  setText('feed-url', feedUrl);
  setText('status', T.loading);
  setText('raw-link', T.raw);
  document.getElementById('raw-link').href = feedUrl;
  setText('site-link', T.site);
  document.getElementById('site-link').href = T.home;

  fetch(T.feed, { headers: { Accept: 'application/rss+xml, application/xml, text/xml' } })
    .then(function (res) {
      if (!res.ok) throw new Error('feed ' + res.status);
      return res.text();
    })
    .then(function (text) {
      var doc = new DOMParser().parseFromString(text, 'application/xml');
      if (doc.querySelector('parsererror')) throw new Error('invalid feed');
      var channel = doc.querySelector('channel');
      setText('site-title', channel.querySelector('title').textContent);
      setText('site-description', channel.querySelector('description').textContent);
      document.title = channel.querySelector('title').textContent + ' – RSS';
      var list = document.getElementById('items');
      var items = channel.querySelectorAll('item');
      setText('status', '');
      items.forEach(function (item) {
        var title = item.querySelector('title').textContent;
        var li = document.createElement('li');
        var isDaily = title.indexOf('Case of the day:') === 0 || title.indexOf('Fall des Tages:') === 0;
        li.className = 'item' + (isDaily ? ' daily' : '');

        var date = document.createElement('div');
        date.className = 'date';
        date.textContent = (isDaily ? T.daily + ' · ' : '') + (item.querySelector('pubDate') || { textContent: '' }).textContent;
        li.appendChild(date);

        var head = document.createElement('div');
        head.className = 'title';
        var a = document.createElement('a');
        a.textContent = title;
        var href = safeHref(item.querySelector('link').textContent);
        if (href) a.href = href;
        head.appendChild(a);
        li.appendChild(head);

        var desc = document.createElement('p');
        desc.className = 'desc';
        desc.textContent = item.querySelector('description').textContent;
        li.appendChild(desc);

        list.appendChild(li);
      });
    })
    .catch(function () {
      setText('status', T.unavailable);
    });
})();
