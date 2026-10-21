
/**
 * Fandom & Wikipedia Automatic Image Fetcher and Responsive Carousel
 * Supports any *.fandom.com and *.wikia.com wikis, plus wikipedia.org
 */

(function () {
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
  const load = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };

  // Parse Fandom or Wikia URLs
  function parseFandomUrl(raw) {
    try {
      const u = new URL(String(raw || '').trim());
      const host = u.hostname.toLowerCase();
      if (!host.endsWith('.fandom.com') && !host.endsWith('.wikia.com') && !host.endsWith('.wikia.org')) {
        return null;
      }

      // Check /wiki/ or /<lang>/wiki/
      const match = u.pathname.match(/^(?:\/([a-z]{2,5}))?\/wiki\/(.+)$/i);
      if (!match) return null;

      const langPrefix = match[1] ? '/' + match[1] : '';
      let rawTitle = decodeURIComponent(match[2].split('/')[0] || '').replace(/_/g, ' ').trim();

      // Check ?file= query parameter or File: prefix
      let targetFile = u.searchParams.get('file') || '';
      if (!targetFile && /^file:/i.test(rawTitle)) {
        targetFile = rawTitle.replace(/^file:\s*/i, '');
      }

      const cleanTitle = rawTitle.replace(/^file:\s*/i, '');

      return {
        isFandom: true,
        host,
        langPrefix,
        title: cleanTitle,
        targetFile,
        fullUrl: u.href
      };
    } catch (_) {
      return null;
    }
  }

  // Parse Wikipedia or Wikimedia URLs
  function parseWikiUrl(raw) {
    try {
      const u = new URL(String(raw || '').trim());
      const host = u.hostname.toLowerCase();
      if (!host.includes('wikipedia.org') && !host.includes('wikimedia.org') && !host.includes('wikiwand.com')) {
        return null;
      }

      const m = u.pathname.match(/\/wiki\/(?:[^#?]*#\/media\/|)(File:[^?#]+|[^?#]+)/i);
      if (!m) return null;

      let title = decodeURIComponent(m[1]).replace(/_/g, ' ').trim();
      let targetFile = '';
      if (/^file:/i.test(title)) {
        targetFile = title.replace(/^file:/i, '');
      }

      return {
        isWiki: true,
        host: host.includes('wikiwand') ? 'en.wikipedia.org' : host,
        title: title.replace(/^file:/i, ''),
        targetFile,
        fullUrl: u.href
      };
    } catch (_) {
      return null;
    }
  }

  // Filter out unwanted mediawiki icons and logos
  function isUsefulImage(fileName, width, height) {
    if (!fileName) return false;
    const lower = fileName.toLowerCase();
    if (/\.(svg|ogg|mp3|webm|mp4)$/i.test(lower)) return false;
    if (/icon|logo|bullet|rating|badge|button|edit-|arrow|transparent|wiki-wordmark|favicon/i.test(lower)) {
      return false;
    }
    if (width && height && (width < 90 || height < 90)) {
      return false;
    }
    return true;
  }

  // Fetch all images from a Fandom article
  async function fetchFandomImagesRaw(info) {
    let netFailed = false;
    const cacheKey = 'fd_v2:' + info.host + (info.langPrefix || '') + '/' + info.title;
    const cached = load(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch (_) {}
    }

    const apiBase = `https://${info.host}${info.langPrefix || ''}/api.php`;
    const items = [];
    const seenFiles = new Set();

    // If a specific target file was requested (e.g., ?file=Superman-kirkalyn.jpg)
    if (info.targetFile) {
      try {
        const fileRes = await fetch(
          `${apiBase}?action=query&titles=${encodeURIComponent('File:' + info.targetFile)}&prop=imageinfo&iiprop=url|size&iiurlwidth=720&format=json&origin=*`
        );
        if (fileRes.ok) {
          const data = await fileRes.json();
          const page = Object.values(data.query?.pages || {})[0];
          const ii = page?.imageinfo?.[0];
          if (ii) {
            const cleanName = info.targetFile.replace(/_/g, ' ').replace(/\.[^.]+$/, '');
            items.push({
              title: cleanName,
              file: info.targetFile,
              url: ii.thumburl || ii.url,
              fullUrl: ii.url,
              width: ii.thumbwidth || ii.width,
              height: ii.thumbheight || ii.height
            });
            seenFiles.add(info.targetFile.toLowerCase());
          }
        }
      } catch (err) {
        console.warn('[FandomCarousel] Failed to fetch specific file:', err, (err && err.name === 'TypeError' && (netFailed = true)));
      }
    }

    // Generator query: fetch images attached to the article
    try {
      const genUrl = `${apiBase}?action=query&generator=images&titles=${encodeURIComponent(info.title)}&gimlimit=12&prop=imageinfo&iiprop=url|size&iiurlwidth=720&format=json&origin=*`;
      if (netFailed) throw new TypeError('skipped after network failure'); const genRes = await fetch(genUrl);
      if (genRes.ok) {
        const genData = await genRes.json();
        const pages = Object.values(genData.query?.pages || {});
        for (const p of pages) {
          const rawFile = (p.title || '').replace(/^File:/i, '');
          if (!rawFile || seenFiles.has(rawFile.toLowerCase())) continue;
          const ii = p.imageinfo?.[0];
          if (!ii) continue;

          if (!isUsefulImage(rawFile, ii.width, ii.height)) continue;

          const cleanName = rawFile.replace(/_/g, ' ').replace(/\.[^.]+$/, '');
          items.push({
            title: cleanName,
            file: rawFile,
            url: ii.thumburl || ii.url,
            fullUrl: ii.url,
            width: ii.thumbwidth || ii.width,
            height: ii.thumbheight || ii.height
          });
          seenFiles.add(rawFile.toLowerCase());
          if (items.length >= 8) break;
        }
      }
    } catch (err) {
      { if (err && err.name === 'TypeError') netFailed = true; } console.warn('[FandomCarousel] Generator query error:', err && err.name, err && err.message, '| host=' + info.host, '| online=' + navigator.onLine);
    }

    // Fallback: if generator query returned few items, query pageimages
    if (items.length === 0 && !netFailed) {
      try {
        const piUrl = `${apiBase}?action=query&titles=${encodeURIComponent(info.title)}&prop=pageimages|images&pithumbsize=720&imlimit=30&format=json&origin=*`;
        const piRes = await fetch(piUrl);
        if (piRes.ok) {
          const piData = await piRes.json();
          const page = Object.values(piData.query?.pages || {})[0];
          if (page?.thumbnail?.source) {
            items.push({
              title: info.title,
              file: info.title + '.jpg',
              url: page.thumbnail.source,
              fullUrl: page.thumbnail.source,
              width: page.thumbnail.width,
              height: page.thumbnail.height
            });
          }
          // Also construct Special:FilePath for image titles listed in page.images
          const rawImages = page?.images || [];
          for (const imgObj of rawImages) {
            const rawFile = (imgObj.title || '').replace(/^File:/i, '');
            if (!rawFile || seenFiles.has(rawFile.toLowerCase())) continue;
            if (!isUsefulImage(rawFile)) continue;

            const filePath = `https://${info.host}${info.langPrefix || ''}/wiki/Special:FilePath/${encodeURIComponent(rawFile)}?width=720`;
            const cleanName = rawFile.replace(/_/g, ' ').replace(/\.[^.]+$/, '');
            items.push({
              title: cleanName,
              file: rawFile,
              url: filePath,
              fullUrl: filePath
            });
            seenFiles.add(rawFile.toLowerCase());
            if (items.length >= 12) break;
          }
        }
      } catch (err) {
        console.warn('[FandomCarousel] Pageimages fallback error:', err && err.name, err && err.message, '| host=' + info.host, '| online=' + navigator.onLine);
      }
    }

    if (items.length > 0) {
      store(cacheKey, JSON.stringify(items));
    }
    return items;
  }

  // Fetch Wikipedia images for an article
  async function fetchWikipediaImages(info) {
    const cacheKey = 'wg_v2:' + info.title;
    const cached = load(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch (_) {}
    }

    const items = [];
    try {
      const r = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(info.title)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (r.ok) {
        const j = await r.json();
        for (const it of j.items || []) {
          if (it.type !== 'image' || !it.title || it.showInGallery === false) continue;
          const rawFile = it.title.replace(/^File:/i, '').replace(/ /g, '_');
          if (/\.svg$/i.test(rawFile)) continue;
          const cleanName = ((it.caption?.text || '').replace(/\s+/g, ' ').trim() || rawFile.replace(/\.[^.]+$/, '')).slice(0, 110);
          items.push({
            title: cleanName,
            file: rawFile,
            url: `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(rawFile)}?width=720`,
            fullUrl: `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(rawFile)}`
          });
          if (items.length >= 14) break;
        }
      }
    } catch (_) {}

    // Fallback: summary thumbnail
    if (!items.length) {
      try {
        const r = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(info.title)}`,
          { headers: { Accept: 'application/json' } }
        );
        if (r.ok) {
          const j = await r.json();
          if (j.thumbnail?.source) {
            const u = j.thumbnail.source.replace(/\/\d+px-/, '/720px-');
            items.push({
              title: info.title,
              file: info.title,
              url: u,
              fullUrl: u
            });
          }
        }
      } catch (_) {}
    }

    if (items.length) {
      store(cacheKey, JSON.stringify(items));
    }
    return items;
  }

  // Native loading="lazy" support check
  const supportsNativeLazy = typeof HTMLImageElement !== 'undefined' && 'loading' in HTMLImageElement.prototype;

  // IntersectionObserver fallback for browsers without native loading="lazy"
  let carouselLazyObserver = null;
  if (!supportsNativeLazy && typeof IntersectionObserver !== 'undefined') {
    carouselLazyObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            delete img.dataset.src;
          }
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '200px 0px',
      threshold: 0.01
    });
  }

  // Apply lazy loading with loading="lazy" attribute and IntersectionObserver fallback
  function applyLazyLoading(img, url, isImmediate = false) {
    img.setAttribute('loading', 'lazy');
    img.loading = 'lazy';

    if (isImmediate) {
      img.src = url;
      return;
    }

    if (supportsNativeLazy) {
      img.src = url;
    } else if (carouselLazyObserver) {
      img.dataset.src = url;
      carouselLazyObserver.observe(img);
    } else {
      img.src = url;
    }
  }

  // Build the complete interactive carousel component
  function createCarouselElement(items, info) {
    const container = document.createElement('div');
    container.className = 'fandom-carousel';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', `Slideshow: ${info.title}`);

    let currentIndex = 0;
    let autoInterval = null;
    let isAutoPlaying = load('pf-carauto') === '1';

    // 1. Header
    const header = document.createElement('div');
    header.className = 'car-header';

    const titleBadge = document.createElement('div');
    titleBadge.className = 'car-title-badge';
    titleBadge.innerHTML = `<span class="fandom-icon">${info.isFandom ? 'FANDOM' : 'WIKI'}</span> <span>${info.title}</span>`;

    const actions = document.createElement('div');
    actions.className = 'car-actions';

    const autoBtn = document.createElement('button');
    autoBtn.type = 'button';
    autoBtn.className = 'car-btn' + (isAutoPlaying ? ' car-btn-active' : '');
    autoBtn.innerHTML = isAutoPlaying ? '⏸ Auto' : '▶ Auto';
    autoBtn.title = 'Toggle automatic slide progression';

    const openLink = document.createElement('a');
    openLink.className = 'car-btn';
    openLink.href = info.fullUrl;
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    openLink.innerHTML = '↗ Open Page';

    actions.append(autoBtn, openLink);
    header.append(titleBadge, actions);

    // 2. Stage & Viewport
    const stage = document.createElement('div');
    stage.className = 'car-stage';

    const viewport = document.createElement('div');
    viewport.className = 'car-viewport';

    const track = document.createElement('div');
    track.className = 'car-track';

    items.forEach((item, idx) => {
      const slide = document.createElement('div');
      slide.className = 'car-slide' + (idx === 0 ? '' : ' loading');

      const img = document.createElement('img');
      img.alt = item.title || `Slide ${idx + 1}`;
      if (item.width && item.height) { img.setAttribute('width', item.width); img.setAttribute('height', item.height); }
      img.setAttribute('loading', 'lazy');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';

      // Lazy load slide images; first slide is immediate
      applyLazyLoading(img, item.url, idx === 0);

      img.onload = () => slide.classList.remove('loading');
      img.onerror = () => {
        slide.classList.remove('loading');
        img.style.opacity = '0.3';
      };

      // Lightbox view on click
      img.onclick = () => openLightbox(item.fullUrl || item.url, item.title);

      slide.appendChild(img);
      track.appendChild(slide);
    });

    viewport.appendChild(track);

    // Navigation buttons
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'car-nav-btn car-prev';
    prevBtn.setAttribute('aria-label', 'Previous slide');
    prevBtn.textContent = '‹';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'car-nav-btn car-next';
    nextBtn.setAttribute('aria-label', 'Next slide');
    nextBtn.textContent = '›';

    stage.append(viewport, prevBtn, nextBtn);

    // 3. Footer with caption, counter, and dots
    const footer = document.createElement('div');
    footer.className = 'car-footer';

    const captionRow = document.createElement('div');
    captionRow.className = 'car-caption-row';

    const captionText = document.createElement('span');
    captionText.className = 'car-caption-text';
    captionText.textContent = items[0]?.title || info.title;

    const counter = document.createElement('span');
    counter.className = 'car-counter';
    counter.textContent = `1 / ${items.length}`;

    captionRow.append(captionText, counter);

    // Dots
    const dotsWrap = document.createElement('div');
    dotsWrap.className = 'car-dots';

    items.forEach((_, idx) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'car-dot' + (idx === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Go to slide ${idx + 1}`);
      dot.onclick = () => goToSlide(idx);
      dotsWrap.appendChild(dot);
    });

    // Thumbnails strip
    const thumbsStrip = document.createElement('div');
    thumbsStrip.className = 'car-thumbs-strip';

    items.forEach((item, idx) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'car-thumb-item' + (idx === 0 ? ' active' : '');
      thumb.setAttribute('aria-label', `Thumbnail ${idx + 1}`);

      const thumbImg = document.createElement('img');
      thumbImg.alt = item.title || `Thumbnail ${idx + 1}`;
      thumbImg.setAttribute('width', 54); thumbImg.setAttribute('height', 44);
      thumbImg.setAttribute('loading', 'lazy');
      thumbImg.loading = 'lazy';
      thumbImg.referrerPolicy = 'no-referrer';

      // Lazy load thumbnail images (first 4 visible immediately, rest lazily loaded)
      applyLazyLoading(thumbImg, item.url, idx < 4);

      thumb.appendChild(thumbImg);
      thumb.onclick = () => goToSlide(idx);
      thumbsStrip.appendChild(thumb);
    });

    footer.append(captionRow, dotsWrap, thumbsStrip);
    container.append(header, stage, footer);

    // Slide navigation logic
    function goToSlide(newIdx) {
      currentIndex = (newIdx + items.length) % items.length;
      track.style.transform = `translateX(-${currentIndex * 100}%)`;

      // Hydrate current, next, and previous slide images immediately on slide change
      [currentIndex, (currentIndex + 1) % items.length, (currentIndex - 1 + items.length) % items.length].forEach(i => {
        const slideImg = track.children[i]?.querySelector('img');
        if (slideImg && slideImg.dataset.src && !slideImg.src) {
          slideImg.src = slideImg.dataset.src;
          if (carouselLazyObserver) {
            carouselLazyObserver.unobserve(slideImg);
          }
          delete slideImg.dataset.src;
        }
      });

      // Update caption & counter
      captionText.textContent = items[currentIndex]?.title || info.title;
      counter.textContent = `${currentIndex + 1} / ${items.length}`;

      // Update dots
      dotsWrap.querySelectorAll('.car-dot').forEach((dot, idx) => {
        dot.classList.toggle('active', idx === currentIndex);
      });

      // Update thumbnails
      thumbsStrip.querySelectorAll('.car-thumb-item').forEach((thumb, idx) => {
        thumb.classList.toggle('active', idx === currentIndex);
        if (idx === currentIndex) {
          thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      });
    }

    prevBtn.onclick = () => { goToSlide(currentIndex - 1); resetAutoPlay(); };
    nextBtn.onclick = () => { goToSlide(currentIndex + 1); resetAutoPlay(); };

    // Touch & swipe handling
    let touchStartX = 0;
    let touchEndX = 0;
    stage.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].screenX;
      pauseAutoPlay();
    }, { passive: true });

    stage.addEventListener('touchend', e => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchEndX - touchStartX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) goToSlide(currentIndex - 1);
        else goToSlide(currentIndex + 1);
      }
      resetAutoPlay();
    }, { passive: true });

    // Auto-play timer
    function startAutoPlay() {
      if (autoInterval) clearInterval(autoInterval);
      autoInterval = setInterval(() => {
        goToSlide(currentIndex + 1);
      }, 4200);
    }

    function pauseAutoPlay() {
      if (autoInterval) {
        clearInterval(autoInterval);
        autoInterval = null;
      }
    }

    function resetAutoPlay() {
      if (isAutoPlaying) {
        startAutoPlay();
      }
    }

    autoBtn.onclick = () => {
      isAutoPlaying = !isAutoPlaying;
      store('pf-carauto', isAutoPlaying ? '1' : '0');
      autoBtn.innerHTML = isAutoPlaying ? '⏸ Auto' : '▶ Auto';
      autoBtn.classList.toggle('car-btn-active', isAutoPlaying);
      if (isAutoPlaying) startAutoPlay();
      else pauseAutoPlay();
    };

    if (isAutoPlaying) {
      startAutoPlay();
    }

    stage.addEventListener('mouseenter', pauseAutoPlay);
    stage.addEventListener('mouseleave', resetAutoPlay);

    // Lightbox modal helper
    function openLightbox(imgSrc, title) {
      const box = document.createElement('div');
      box.className = 'car-lightbox';
      box.innerHTML = `
        <button type="button" class="car-lightbox-close" aria-label="Close">✕</button>
        <img src="${imgSrc}" alt="${title || ''}" />
        <p style="color: #fff; margin-top: 10px; font-size: 13px;">${title || ''}</p>
      `;
      box.querySelector('.car-lightbox-close').onclick = () => box.remove();
      box.onclick = e => { if (e.target === box) box.remove(); };
      document.body.appendChild(box);
    }

    return container;
  }

  // Scanner function to upgrade Fandom/Wikipedia links into carousels
  const fdMem = new Map();
  function fetchFandomImages(info) {
    const key = 'fdm:' + info.host + (info.langPrefix || '') + '/' + info.title + '|' + (info.targetFile || '');
    if (fdMem.has(key)) return fdMem.get(key);
    const p = fetchFandomImagesRaw(info).then(items => { if (!items.length) fdMem.delete(key); return items; });
    fdMem.set(key, p);
    return p;
  }

  async function scanAndUpgradeCarousels(rootEl) {
    if (!rootEl) return;
    const prefPicsOn = load('pf-wp') !== '0';
    if (!prefPicsOn) return;

    // Scan all <details> and paragraphs with fandom or wikipedia links
    const candidates = Array.from(rootEl.querySelectorAll('details, p')).filter(c =>
      !(c.tagName === 'DETAILS' && c.querySelector('p a[href*="fandom.com/"], p a[href*="wikia.com/"]')));
    const nearView = (el) => new Promise(res => {
      if (!('IntersectionObserver' in window)) return res();
      const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); res(); } }, { rootMargin: '400px 0px' });
      io.observe(el);
    });
    candidates.forEach(container => (async () => {
      if (container._carDone || container._wpDone) return;
      if (container.querySelector('.mdimg img[alt^="Reference card"]')) return;

      const links = Array.from(container.querySelectorAll('a[href]'));
      links.sort((a, b) => (/[?&]file=/.test(a.getAttribute('href') || '') ? 0 : 1) - (/[?&]file=/.test(b.getAttribute('href') || '') ? 0 : 1));
      if (!links.length) return;

      let foundInfo = null;
      let matchedLink = null;

      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const fInfo = parseFandomUrl(href);
        if (fInfo) {
          foundInfo = fInfo;
          matchedLink = link;
          break;
        }
      }

      if (!foundInfo) return;
      container._carDone = true;
      await nearView(container);

      // Ask permission via netAsk if available
      if (typeof window.netAsk === 'function') {
        const ok = await window.netAsk(
          foundInfo.host,
          `Load pictures and slides for "${foundInfo.title}" from ${foundInfo.host}.`,
          `https://${foundInfo.host}`
        );
        if (!ok) return;
      }

      // Fetch items
      let items = [];
      if (foundInfo.isFandom) {
        items = await fetchFandomImages(foundInfo);
      } else if (foundInfo.isWiki) {
        items = await fetchWikipediaImages(foundInfo);
      }

      if (items.length > 0) {
        const carousel = createCarouselElement(items, foundInfo);

        // If container is a <details>, insert right after summary or replace reference card
        if (container.tagName.toLowerCase() === 'details') {
          const refImg = container.querySelector('.mdimg, img');
          if (refImg) {
            refImg.replaceWith(carousel);
          } else {
            const summary = container.querySelector('summary');
            if (summary && summary.nextSibling) {
              container.insertBefore(carousel, summary.nextSibling);
            } else {
              container.appendChild(carousel);
            }
          }
        } else {
          // If in a normal paragraph
          container.parentNode.insertBefore(carousel, container.nextSibling);
        }
      }
    })());
  }

  // Export to window
  window.scanAndUpgradeCarousels = scanAndUpgradeCarousels;
  window.fetchFandomImages = fetchFandomImages;
  window.parseFandomUrl = parseFandomUrl;

  // Auto-scan observer
  let scanTimer = 0;
  function triggerScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      const doc = document.getElementById('doc');
      if (doc) scanAndUpgradeCarousels(doc);
    }, 200);
  }

  document.addEventListener('DOMContentLoaded', triggerScan);
  const observer = new MutationObserver(triggerScan);
  const doc = document.getElementById('doc');
  if (doc) observer.observe(doc, { childList: true, subtree: true });

  // Hook reload button
  const reloadBtn = document.getElementById('picReload');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => {
      // Clear carousel caches
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('fd_v2:') || k.startsWith('wg_v2:')) {
          localStorage.removeItem(k);
        }
      });
      document.querySelectorAll('.fandom-carousel').forEach(c => c.remove());
      document.querySelectorAll('#doc details, #doc p').forEach(el => { el._carDone = false; });
      triggerScan();
    });
  }
})();

