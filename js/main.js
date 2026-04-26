/**
 * ==========================================================================
 * Твори Красиво — Студия керамики
 * Главный JavaScript файл
 * ==========================================================================
 * 
 * Структура:
 * 1. Данные и состояние
 * 2. Утилиты
 * 3. Инициализация компонентов
 * 4. Навигация и мобильное меню
 * 5. Мастер-классы (динамическая генерация)
 * 6. Модальное окно записи и форма
 * 7. Отзывы
 * 8. FAQ-аккордеон
 * 9. Контакты
 * 10. Галерея и Lightbox
 * 11. Запуск приложения
 * 
 * ВАЖНО: Для подключения реальной БД/почты/CRM см. комментарии в разделе
 * отправки формы (submitBookingForm)
 */

// ==========================================================================
// 1. ДАННЫЕ И СОСТОЯНИЕ
// ==========================================================================

// Базовый URL API (пусто = тот же хост; для локальной разработки задайте window.API_BASE перед скриптом)
const API_BASE = (typeof window !== 'undefined' && window.API_BASE !== undefined) ? window.API_BASE : '';

/** Полный URL для картинки. /uploads/ отдаём как /api/uploads/, чтобы шло через тот же прокси, что и API. */
function buildImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  var p = path.startsWith('/') ? path : '/' + path;
  if (p.startsWith('/uploads/') && p.indexOf('/api/uploads/') !== 0) p = '/api' + p;
  const base = API_BASE.startsWith('http') ? API_BASE : (typeof window !== 'undefined' ? window.location.origin : '') + (API_BASE || '');
  return base + p;
}

/** Подстановка title / meta / OG / canonical с API SEO (поверх значений в index.html). */
function applySeoFromApi(seo) {
  if (!seo || typeof seo !== 'object') return;
  function setMetaByName(name, content) {
    if (content == null) return;
    var c = String(content).trim();
    if (!c) return;
    var el = document.querySelector('meta[name="' + name + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', c);
  }
  function setMetaByProperty(prop, content) {
    if (content == null) return;
    var c = String(content).trim();
    if (!c) return;
    var el = document.querySelector('meta[property="' + prop + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', prop);
      document.head.appendChild(el);
    }
    el.setAttribute('content', c);
  }
  var title = String(seo.metaTitle || '').trim();
  if (title) document.title = title;
  var md = String(seo.metaDescription || '').trim();
  if (md) setMetaByName('description', md);
  var ogt = String(seo.ogTitle || '').trim();
  if (ogt) setMetaByProperty('og:title', ogt);
  var ogd = String(seo.ogDescription || '').trim();
  if (ogd) setMetaByProperty('og:description', ogd);
  var img = seo.ogImage != null ? String(seo.ogImage).trim() : '';
  if (img) setMetaByProperty('og:image', buildImageUrl(img));
  var can = seo.canonicalUrl != null ? String(seo.canonicalUrl).trim() : '';
  var link = document.querySelector('link[rel="canonical"]');
  if (can) {
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = can;
  } else if (link) {
    link.remove();
  }
}

let workshopsData = null;
let selectedWorkshop = null;
let selectedSlot = null;
let previewWorkshopId = null;
/** Слот (дата/время) карточки, из которой открыли превью — для кнопки «Запись на мастер-класс» */
let previewSlot = null;
/** Слоты с API: { id, workshopId, date, time, startAt, durationMinutes, capacityTotal, freeSeats, status }[] */
let publicSlotsCache = [];
/** Экземпляр FullCalendar в модалке записи */
let bookingCalendar = null;

/** Проверка: выбранный слот доступен (не занят, не HELD). cache = publicSlotsCache, durationMinutes — длительность мастер-класса. */
function isSelectedSlotAvailable(cache, selectedSlot, durationMinutes) {
  if (!selectedSlot || !Array.isArray(cache)) return false;
  var dur = Math.max(1, parseInt(durationMinutes, 10) || 120);
  function timeToMinutes(t) {
    var parts = (t || '').split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }
  if (selectedSlot.id) {
    var byId = cache.find(function (s) { return s.id === selectedSlot.id; });
    if (!byId) return false;
    var f = Number(byId.freeSeats);
    if (isNaN(f)) f = 0;
    return f > 0 && String(byId.status || '').toUpperCase() === 'OPEN';
  }
  var date = selectedSlot.date;
  var time = selectedSlot.time;
  if (!date || !time) return false;
  var exact = cache.find(function (s) { return s.date === date && s.time === time; });
  if (exact) {
    var fe = Number(exact.freeSeats);
    if (isNaN(fe)) fe = 0;
    if (fe <= 0 || String(exact.status || '').toUpperCase() !== 'OPEN') return false;
  }
  var selectedStartMin = timeToMinutes(time);
  var selectedEndMin = selectedStartMin + dur;
  var overlappingSlot = cache.find(function (s) {
    if (s.date !== date) return false;
    var slotStartMin = timeToMinutes(s.time);
    var slotDur = Math.max(0, parseInt(s.durationMinutes, 10) || dur);
    var slotEndMin = slotStartMin + slotDur;
    return selectedEndMin > slotStartMin && slotEndMin > selectedStartMin;
  });
  return !overlappingSlot;
}

// ==========================================================================
// 2. УТИЛИТЫ
// ==========================================================================

/** Таймаут fetch, чтобы loadData() не зависала навсегда при недоступном API */
function fetchWithTimeout(url, options, timeoutMs) {
  timeoutMs = timeoutMs || 3000;
  if (typeof AbortController === 'undefined') {
    return Promise.race([
      fetch(url, options || {}),
      new Promise(function (_, rej) {
        setTimeout(function () {
          rej(new Error('fetch timeout'));
        }, timeoutMs);
      }),
    ]);
  }
  var ctrl = new AbortController();
  var id = setTimeout(function () {
    try {
      ctrl.abort();
    } catch (_) {}
  }, timeoutMs);
  var opts = Object.assign({}, options || {});
  opts.signal = ctrl.signal;
  return fetch(url, opts).finally(function () {
    clearTimeout(id);
  });
}

var pageLoaderHidden = false;
var pageLoaderFailsafeTimer = null;

/**
 * Дождаться загрузки всех изображений (без decode() — в части браузеров он не завершается).
 * На каждое изображение — свой таймаут, чтобы один «зависший» URL не блокировал всё.
 */
function waitForAllImagesLoaded() {
  document.querySelectorAll('img[loading="lazy"]').forEach(function (img) {
    img.loading = 'eager';
  });
  var imgs = Array.prototype.slice.call(document.querySelectorAll('img'));
  var perImageMs = 3000;
  var tasks = imgs.map(function (img) {
    var src = img.getAttribute('src');
    if (!src || String(src).trim() === '') return Promise.resolve();
    return Promise.race([
      new Promise(function (resolve) {
        if (img.complete && img.naturalWidth !== 0) {
          resolve();
          return;
        }
        if (img.complete && img.naturalWidth === 0) {
          resolve();
          return;
        }
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      }),
      new Promise(function (resolve) {
        setTimeout(resolve, perImageMs);
      }),
    ]);
  });
  return Promise.all(tasks);
}

function hidePageLoader() {
  if (pageLoaderHidden) return;
  pageLoaderHidden = true;
  if (pageLoaderFailsafeTimer) {
    clearTimeout(pageLoaderFailsafeTimer);
    pageLoaderFailsafeTimer = null;
  }
  var el = document.getElementById('pageLoader');
  document.body.classList.remove('page-loading');
  if (!el) return;
  el.setAttribute('aria-busy', 'false');
  el.classList.add('page-loader--hidden');
  var done = false;
  function cleanup() {
    if (done) return;
    done = true;
    el.removeEventListener('transitionend', onEnd);
    el.setAttribute('aria-hidden', 'true');
  }
  function onEnd(e) {
    if (e.propertyName === 'opacity') cleanup();
  }
  el.addEventListener('transitionend', onEnd);
  setTimeout(cleanup, 700);
}

/**
 * Форматирование даты в читаемый вид
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { day: 'numeric', month: 'short' };
  return date.toLocaleDateString('ru-RU', options);
}

/**
 * Форматирование цены с разделителями
 */
function formatPrice(price) {
  return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Валидация телефона (российский формат)
 */
function validatePhone(phone) {
  // Убираем все символы кроме цифр
  const digits = phone.replace(/\D/g, '');
  // Проверяем количество цифр (10-11 для российских номеров)
  return digits.length >= 10 && digits.length <= 11;
}

/** Простая проверка email (согласована с бэкендом). */
function validateEmail(email) {
  var s = String(email || '').trim();
  if (!s || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Форматирование телефона при вводе
 */
function formatPhoneInput(input) {
  let value = input.value.replace(/\D/g, '');
  let formatted = '';
  
  if (value.length > 0) {
    // Начинаем с +7
    if (value[0] === '8' || value[0] === '7') {
      value = value.substring(1);
    }
    formatted = '+7';
    
    if (value.length > 0) {
      formatted += ' (' + value.substring(0, 3);
    }
    if (value.length > 3) {
      formatted += ') ' + value.substring(3, 6);
    }
    if (value.length > 6) {
      formatted += '-' + value.substring(6, 8);
    }
    if (value.length > 8) {
      formatted += '-' + value.substring(8, 10);
    }
  }
  
  input.value = formatted;
}

/**
 * Получение инициалов из имени
 */
function getInitials(name) {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

function peopleLabel(n) {
  if (n % 10 === 1 && n % 100 !== 11) return n + ' человек';
  if ([2, 3, 4].indexOf(n % 10) !== -1 && [12, 13, 14].indexOf(n % 100) === -1) return n + ' человека';
  return n + ' человек';
}

function setParticipantsOptions(max) {
  var sel = document.getElementById('bookingParticipants');
  if (!sel) return;
  var m = Math.max(1, parseInt(String(max), 10) || 1);
  var current = parseInt(sel.value, 10);
  if (isNaN(current) || current < 1) current = 1;
  sel.innerHTML = '';
  for (var i = 1; i <= m; i++) {
    var opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = peopleLabel(i);
    sel.appendChild(opt);
  }
  sel.value = String(Math.min(Math.max(1, current), m));
}

// ==========================================================================
// 3. ИНИЦИАЛИЗАЦИЯ КОМПОНЕНТОВ
// ==========================================================================

/**
 * Загрузка данных: мастер-классы только из API, отзывы/FAQ/контакты из JSON
 */
function mapWorkshopFromApi(w) {
  const min = w.durationMinutes != null ? w.durationMinutes : 120;
  const hours = min >= 60 ? (min / 60) + ' ч' : min + ' мин';
  return {
    id: w.id,
    title: w.title,
    description: w.description,
    duration: w.duration || hours,
    durationMinutes: w.durationMinutes ?? min,
    price: w.price,
    levelText: w.levelText || 'Мастер-класс',
    tags: w.tags || [],
    result: w.result,
    image: (w.imageUrl ? buildImageUrl(w.imageUrl) : null) || w.image || 'images/workshop-1.jpg',
    maxParticipants: w.capacityPerSlot ?? w.maxParticipants ?? 6,
    capacityPerSlot: w.capacityPerSlot ?? 6,
  };
}

async function loadData() {
  let workshops = [];
  let reviews = [];
  let gallery = [];
  let faq = [];
  let contacts = {};

  var responses = await Promise.all([
    fetchWithTimeout(`${API_BASE}/api/public/workshops`).catch(function () {
      return null;
    }),
    fetchWithTimeout(`${API_BASE}/api/public/reviews`).catch(function () {
      return null;
    }),
    fetchWithTimeout(`${API_BASE}/api/public/gallery`).catch(function () {
      return null;
    }),
    fetchWithTimeout(`${API_BASE}/api/public/contacts`, { cache: 'no-store' }).catch(function () {
      return null;
    }),
    fetchWithTimeout(`${API_BASE}/api/public/seo`, { cache: 'no-store' }).catch(function () {
      return null;
    }),
    fetchWithTimeout('data/workshops.json').catch(function () {
      return null;
    }),
  ]);

  var apiRes = responses[0];
  var revRes = responses[1];
  var galRes = responses[2];
  var cRes = responses[3];
  var seoRes = responses[4];
  var legacyRes = responses[5];

  try {
    if (apiRes && apiRes.ok) {
      const list = await apiRes.json();
      workshops = (Array.isArray(list) ? list : []).map(mapWorkshopFromApi);
    }
  } catch (_) {}

  try {
    if (revRes && revRes.ok) reviews = await revRes.json();
  } catch (_) {}
  try {
    if (galRes && galRes.ok) gallery = await galRes.json();
  } catch (_) {}
  try {
    if (cRes && cRes.ok) {
      const cData = await cRes.json();
      if (cData.blocks && cData.blocks.length) {
        contacts = cData;
      }
    }
  } catch (_) {}

  try {
    if (legacyRes && legacyRes.ok) {
      const data = await legacyRes.json();
      faq = data.faq || [];
      if (!contacts.blocks || !contacts.blocks.length) {
        contacts = legacyContactsToBlocks(data.contacts || {});
      }
    }
  } catch (e) {
    console.warn('Ошибка загрузки JSON (faq/contacts):', e);
  }

  try {
    if (seoRes && seoRes.ok) {
      var seoJson = await seoRes.json();
      applySeoFromApi(seoJson);
    }
  } catch (_e) {}

  workshopsData = { workshops, reviews, gallery, faq, contacts };
  return workshopsData;
}

// ==========================================================================
// 4. НАВИГАЦИЯ И МОБИЛЬНОЕ МЕНЮ
// ==========================================================================

function initNavigation() {
  const header = document.getElementById('header');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileNav = document.getElementById('mobileNav');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
  
  // Скролл хедера
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
  });
  
  // Мобильное меню
  mobileMenuBtn.addEventListener('click', () => {
    const isActive = mobileNav.classList.toggle('active');
    mobileMenuBtn.classList.toggle('active');
    mobileMenuBtn.setAttribute('aria-expanded', isActive);
    document.body.style.overflow = isActive ? 'hidden' : '';
  });
  
  // Закрытие меню при клике на ссылку
  mobileNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('active');
      mobileMenuBtn.classList.remove('active');
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
  
  // Плавный скролл для якорных ссылок
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const headerHeight = header.offsetHeight;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ==========================================================================
// 5. МАСТЕР-КЛАССЫ
// ==========================================================================

function renderWorkshops(workshops) {
  // Список мастер-классов заменён на кнопку «Выбрать дату и мастер-класс»; открывается полноэкранная модалка с календарём и списком слотов
  (function noop() {})();
}

// ==========================================================================
// 6. МОДАЛЬНОЕ ОКНО ЗАПИСИ И ФОРМА
// ==========================================================================

function initBookingModal() {
  const modal = document.getElementById('bookingModal');
  const closeBtn = document.getElementById('closeBookingModal');
  const form = document.getElementById('bookingForm');
  const phoneInput = document.getElementById('bookingPhone');
  
  // Закрытие модалки
  closeBtn.addEventListener('click', closeBookingModal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeBookingModal();
  });
  
  // Закрытие по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeBookingModal();
    }
  });
  
  // Форматирование телефона
  phoneInput.addEventListener('input', () => formatPhoneInput(phoneInput));
  
  // Отправка формы
  form.addEventListener('submit', submitBookingForm);

  // Два этапа: шаг 1 — время, шаг 2 — данные
  var step1Next = document.getElementById('bookingStep1Next');
  var step2Back = document.getElementById('bookingStep2Back');
  if (step1Next) {
    step1Next.addEventListener('click', function () {
      if (!selectedSlot) {
        var errEl = document.getElementById('slotError');
        if (errEl) {
          errEl.textContent = 'Пожалуйста, выберите время';
          errEl.style.display = 'block';
        }
        return;
      }
      var dur = selectedWorkshop && (selectedWorkshop.durationMinutes != null) ? selectedWorkshop.durationMinutes : 120;
      if (!isSelectedSlotAvailable(publicSlotsCache, selectedSlot, dur)) {
        var errSlot = document.getElementById('slotError');
        if (errSlot) {
          errSlot.textContent = 'Это время недоступно. Выберите другое.';
          errSlot.style.display = 'block';
        }
        return;
      }
      showBookingStep(2);
    });
  }
  if (step2Back) {
    step2Back.addEventListener('click', function () {
      if (!bookingCalendar && selectedWorkshop) {
        closeBookingModal();
        openBookingModal(selectedWorkshop.id);
        return;
      }
      showBookingStep(1);
    });
  }
}

// ==========================================================================
// Модалка расписания: календарь + список слотов, по клику — детали (запись / все даты / предложить свою)
// ==========================================================================
var scheduleModalState = {
  year: null,
  month: null,
  /** Начало отображаемой недели (понедельник) YYYY-MM-DD */
  weekStart: null,
  selectedDate: null,
  /** Дата, подсвеченная при скролле (без фильтра и чипа); чип только при клике по календарю */
  highlightedDate: null,
  view: 'week', // 'week' | 'month'
  /** Пока идёт fetch слотов в openScheduleModal — иначе пустой список выглядит как «вечная загрузка» */
  slotsLoading: false,
  slotsWithWorkshop: [],
  detailWorkshop: null,
  detailSlot: null,
  listScrollCleanup: null,
  listSyncLockUntil: 0,
  listScrollRaf: 0,
  carouselIntervalId: 0,
  carouselResumeTimeoutId: 0,
  carouselCleanup: null,
  topSectionStickyCleanup: null,
  filters: {
    workshopIds: [],
    onlyAvailable: true,
    priceMin: null,
    priceMax: null,
  },
  filterDrafts: {
    workshopIds: [],
    priceMin: null,
    priceMax: null,
  },
};

function getScheduleMonthRange() {
  var d = scheduleModalState.year != null && scheduleModalState.month != null
    ? new Date(scheduleModalState.year, scheduleModalState.month, 1)
    : new Date();
  var y = d.getFullYear();
  var m = d.getMonth();
  var first = new Date(y, m, 1);
  var last = new Date(y, m + 1, 0);
  return {
    dateFrom: y + '-' + String(m + 1).padStart(2, '0') + '-01',
    dateTo: y + '-' + String(m + 1).padStart(2, '0') + '-' + String(last.getDate()).padStart(2, '0'),
    year: y,
    month: m,
  };
}

/** Понедельник недели для даты YYYY-MM-DD */
function getWeekStartForDate(dateStr) {
  var d = new Date(dateStr + 'T12:00:00');
  var day = d.getDay();
  var diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var dayNum = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dayNum;
}

/** Прибавить дни к YYYY-MM-DD */
function addDays(dateStr, days) {
  var d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var dayNum = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + dayNum;
}

function parseMoney(value) {
  if (value == null || value === '') return null;
  var n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getSchedulePriceBounds() {
  var list = scheduleModalState.slotsWithWorkshop || [];
  var prices = list
    .map(function (x) { return x && x.workshop ? Number(x.workshop.price) : NaN; })
    .filter(function (x) { return Number.isFinite(x); });
  if (!prices.length) return { min: 0, max: 0 };
  return { min: Math.min.apply(null, prices), max: Math.max.apply(null, prices) };
}

function isSlotOpenWithSeats(slot) {
  if (!slot) return false;
  var free = Number(slot.freeSeats);
  if (isNaN(free)) free = 0;
  return free > 0 && String(slot.status || '').toUpperCase() === 'OPEN';
}

function getFilteredScheduleSlots() {
  var filters = scheduleModalState.filters || {};
  var selectedIds = Array.isArray(filters.workshopIds) ? filters.workshopIds.map(String) : [];
  var hasWorkshopFilter = selectedIds.length > 0;
  var onlyAvailable = !!filters.onlyAvailable;
  var minPrice = parseMoney(filters.priceMin);
  var maxPrice = parseMoney(filters.priceMax);
  return (scheduleModalState.slotsWithWorkshop || []).filter(function (item) {
    var w = item.workshop;
    var s = item.slot;
    if (!w || !s) return false;
    if (hasWorkshopFilter && selectedIds.indexOf(String(w.id)) === -1) return false;
    if (onlyAvailable && !isSlotOpenWithSeats(s)) return false;
    var p = Number(w.price);
    if (Number.isFinite(minPrice) && Number.isFinite(p) && p < minPrice) return false;
    if (Number.isFinite(maxPrice) && Number.isFinite(p) && p > maxPrice) return false;
    return true;
  });
}

function updateScheduleFilterButtons() {
  var workshopBtn = document.getElementById('scheduleWorkshopFilterBtn');
  var availableBtn = document.getElementById('scheduleAvailabilityFilterBtn');
  var priceBtn = document.getElementById('schedulePriceFilterBtn');
  var f = scheduleModalState.filters || {};
  var workshopCount = Array.isArray(f.workshopIds) ? f.workshopIds.length : 0;
  if (workshopBtn) {
    var label = 'Мастер-классы';
    if (workshopCount) {
      label += ' (' + workshopCount + ')';
      workshopBtn.innerHTML = '<span class="schedule-filter-chip__label">' + label + '</span><span class="schedule-filter-chip__clear" aria-label="Сбросить фильтр" role="button">×</span>';
    } else {
      workshopBtn.textContent = label;
    }
    workshopBtn.classList.toggle('is-active', workshopCount > 0);
  }
  if (availableBtn) availableBtn.classList.toggle('is-active', !!f.onlyAvailable);
  if (priceBtn) {
    var hasPrice = f.priceMin != null || f.priceMax != null;
    var label = 'Цена';
    if (hasPrice) {
      var minText = f.priceMin != null ? String(f.priceMin) : '0';
      var maxText = f.priceMax != null ? String(f.priceMax) : '∞';
      label = 'Цена: ' + minText + '-' + maxText;
      priceBtn.innerHTML = '<span class="schedule-filter-chip__label">' + label + '</span><span class="schedule-filter-chip__clear" aria-label="Сбросить фильтр цены" role="button">×</span>';
    } else {
      priceBtn.textContent = label;
    }
    priceBtn.classList.toggle('is-active', hasPrice);
  }
}

function updateScheduleDateChip() {
  var wrap = document.getElementById('scheduleDateChipWrap');
  if (!wrap) return;
  var selectedDate = scheduleModalState && scheduleModalState.selectedDate;
  if (!selectedDate) {
    wrap.innerHTML = '';
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';
  wrap.innerHTML =
    '<span class="schedule-filter-chip schedule-filter-chip--date is-active">' +
      '<span class="schedule-filter-chip__label">' + formatDateShort(selectedDate) + '</span>' +
      '<span class="schedule-filter-chip__clear" aria-label="Сбросить дату" role="button" data-clear="date">×</span>' +
    '</span>';
}

function lockScheduleListSync(ms) {
  scheduleModalState.listSyncLockUntil = Date.now() + (ms || 0);
}

function findClosestScheduleDateWithSlots(dateStr) {
  var list = getFilteredScheduleSlots();
  var dates = Array.from(new Set(list.map(function (x) { return x && x.slot ? x.slot.date : null; }).filter(Boolean))).sort();
  if (!dates.length) return null;
  if (!dateStr) return dates[0];
  var sameOrAfter = dates.find(function (d) { return d >= dateStr; });
  return sameOrAfter || dates[dates.length - 1];
}

function hasFilteredSlotsForDate(dateStr) {
  if (!dateStr) return false;
  return getFilteredScheduleSlots().some(function (x) {
    return x && x.slot && x.slot.date === dateStr;
  });
}

function scrollScheduleListToDate(dateStr, smooth) {
  var overlay = document.getElementById('scheduleModalOverlay');
  var listWrap = document.getElementById('scheduleListWrap');
  if (!overlay || !listWrap || !dateStr) return;
  var groups = Array.from(listWrap.querySelectorAll('.schedule-slot-group[data-date]'));
  if (!groups.length) return;
  var target = groups.find(function (g) { return g.getAttribute('data-date') === dateStr; });
  if (!target) {
    target = groups.find(function (g) { return g.getAttribute('data-date') > dateStr; }) || groups[groups.length - 1];
  }
  if (!target) return;
  lockScheduleListSync(220);
  var overlayRect = overlay.getBoundingClientRect();
  var targetRect = target.getBoundingClientRect();
  var calendar = document.querySelector('.schedule-modal__top-section');
  var stickyHeight = calendar ? calendar.getBoundingClientRect().height : 220;
  var newScrollTop = overlay.scrollTop + (targetRect.top - overlayRect.top) - stickyHeight - 4;
  overlay.scrollTo({
    top: Math.max(0, newScrollTop),
    behavior: smooth ? 'smooth' : 'auto',
  });
}

function syncScheduleDateFromScroll() {
  var overlay = document.getElementById('scheduleModalOverlay');
  var listWrap = document.getElementById('scheduleListWrap');
  if (!overlay || !listWrap) return;
  if (Date.now() < (scheduleModalState.listSyncLockUntil || 0)) return;

  var topSection = document.getElementById('scheduleTopSection');
  var targetY = topSection ? topSection.getBoundingClientRect().bottom + 8 : window.innerHeight * 0.25;

  // Источник истины: карточки слотов (по ним в YCLIENTS и меняется выбранная дата)
  var cardsWithDate = Array.from(listWrap.querySelectorAll('.schedule-slot-card[data-slot-date]'));
  var candidates = cardsWithDate.map(function (el) {
    return { dateStr: el.getAttribute('data-slot-date'), top: el.getBoundingClientRect().top };
  });
  if (!candidates.length) return;

  candidates.sort(function (a, b) { return a.top - b.top; });
  var active = candidates[0];
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i].top <= targetY) active = candidates[i];
  }
  var dateStr = active.dateStr;
  if (!dateStr) return;
  /* При скролле только подсвечиваем дату в календаре; selectedDate и чип — только по клику */
  scheduleModalState.highlightedDate = dateStr;
  var newWeekStart = getWeekStartForDate(dateStr);
  if (newWeekStart !== scheduleModalState.weekStart) {
    scheduleModalState.weekStart = newWeekStart;
  }
  renderScheduleCalendar();
}

function bindScheduleListScrollSync() {
  if (typeof scheduleModalState.listScrollCleanup === 'function') {
    scheduleModalState.listScrollCleanup();
    scheduleModalState.listScrollCleanup = null;
  }
  var overlay = document.getElementById('scheduleModalOverlay');
  if (!overlay) return;
  function onScroll() {
    if (scheduleModalState.listScrollRaf) return;
    scheduleModalState.listScrollRaf = requestAnimationFrame(function () {
      scheduleModalState.listScrollRaf = 0;
      syncScheduleDateFromScroll();
    });
  }
  overlay.addEventListener('scroll', onScroll, { passive: true });
  scheduleModalState.listScrollCleanup = function () {
    overlay.removeEventListener('scroll', onScroll);
  };
}

function renderScheduleCalendar() {
  var weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  var monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  var view = scheduleModalState.view || 'week';
  var todayStr = new Date().toISOString().slice(0, 10);
  var monthEl = document.getElementById('scheduleCalendarMonth');
  var wdEl = document.getElementById('scheduleWeekdays');
  var datesEl = document.getElementById('scheduleCalendarDates');
  if (!datesEl) return;

  if (wdEl) wdEl.innerHTML = weekdays.map(function (w) { return '<span class="schedule-weekday">' + w + '</span>'; }).join('');

  var y, m;
  var selectedDate = scheduleModalState.selectedDate;
  /** Подсветка в календаре: либо выбранная по клику дата, либо дата по скроллу */
  var dateToHighlight = selectedDate || scheduleModalState.highlightedDate;

  if (view === 'week') {
    var weekStart = scheduleModalState.weekStart;
    if (!weekStart) {
      weekStart = getWeekStartForDate(selectedDate || todayStr);
      scheduleModalState.weekStart = weekStart;
    }
    var weekDates = [];
    for (var i = 0; i < 7; i++) {
      weekDates.push(addDays(weekStart, i));
    }
    var firstDate = new Date(weekDates[0] + 'T12:00:00');
    y = firstDate.getFullYear();
    m = firstDate.getMonth();
    if (monthEl) monthEl.textContent = monthNames[m] + ' ' + y;

    datesEl.innerHTML = weekDates.map(function (dateStr) {
      var d = new Date(dateStr + 'T12:00:00');
      var day = d.getDate();
      var isSelected = dateToHighlight === dateStr;
      var hasSlots = getFilteredScheduleSlots().some(function (x) {
        return x.slot && x.slot.date === dateStr && isSlotOpenWithSeats(x.slot);
      });
      var cls = 'schedule-date schedule-date--day';
      if (isSelected) cls += ' schedule-date--selected';
      if (hasSlots) cls += ' schedule-date--has-slots';
      return '<button type="button" class="' + cls + '" data-date="' + dateStr + '">' + day + '</button>';
    }).join('');
  } else {
    var range = getScheduleMonthRange();
    y = range.year;
    m = range.month;
    if (monthEl) monthEl.textContent = monthNames[m] + ' ' + y;
    var firstOfMonth = new Date(y, m, 1);
    var startDow = firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1; // 0 = Пн
    var totalCells = 42; // 6 недель
    var cellsHtml = [];
    for (var idx = 0; idx < totalCells; idx++) {
      var cellDate = new Date(y, m, 1 - startDow + idx);
      var cy = cellDate.getFullYear();
      var cm = cellDate.getMonth();
      var cd = cellDate.getDate();
      var dateStr = cy + '-' + String(cm + 1).padStart(2, '0') + '-' + String(cd).padStart(2, '0');
      var isSelectedMonth = dateToHighlight === dateStr;
      var hasSlotsMonth = getFilteredScheduleSlots().some(function (x) {
        return x.slot && x.slot.date === dateStr && isSlotOpenWithSeats(x.slot);
      });
      var isPast = dateStr < todayStr;
      var cls = 'schedule-date schedule-date--day';
      if (isSelectedMonth) cls += ' schedule-date--selected';
      if (hasSlotsMonth) cls += ' schedule-date--has-slots';
      if (cm !== m) cls += ' schedule-date--outside';
      if (isPast) cls += ' schedule-date--past';
      cellsHtml.push('<button type="button" class="' + cls + '" data-date="' + dateStr + '">' + cd + '</button>');
    }
    datesEl.innerHTML = cellsHtml.join('');
  }

  datesEl.querySelectorAll('.schedule-date--day').forEach(function (btn) {
    var dateStr = btn.getAttribute('data-date');
    btn.addEventListener('click', function () {
      if (btn.classList.contains('schedule-date--past')) return;
      scheduleModalState.selectedDate = dateStr;
      scheduleModalState.highlightedDate = null; /* подсветка от скролла сбрасывается, остаётся только выбранная дата */
      scheduleModalState.weekStart = getWeekStartForDate(dateStr);
      scheduleModalState.view = 'week';
      renderScheduleCalendar();
      renderScheduleSlotList();
      if (hasFilteredSlotsForDate(dateStr)) {
        scrollScheduleListToDate(dateStr, true);
      }
    });
  });

  updateScheduleDateChip();
}

function renderScheduleSlotList() {
  var listEl = document.getElementById('scheduleSlotList');
  var hintEl = document.getElementById('scheduleListHint');
  if (!listEl) return;
  var allList = (scheduleModalState.slotsWithWorkshop || []).slice();
  var list = getFilteredScheduleSlots().slice();
  list.sort(function (a, b) {
    var d1 = (a.slot && a.slot.date) ? a.slot.date : '';
    var d2 = (b.slot && b.slot.date) ? b.slot.date : '';
    if (d1 !== d2) return d1.localeCompare(d2);
    var t1 = (a.slot && a.slot.time) ? a.slot.time : '';
    var t2 = (b.slot && b.slot.time) ? b.slot.time : '';
    return t1.localeCompare(t2);
  });

  var selectedDate = scheduleModalState.selectedDate;
  var slotsOnSelectedDate = selectedDate
    ? list.filter(function (x) { return x && x.slot && x.slot.date === selectedDate; })
    : [];
  var noSlotsForSelectedDate = Boolean(selectedDate && allList.length && !slotsOnSelectedDate.length);

  if (noSlotsForSelectedDate) {
    list = [];
  }

  /* Когда выбрана дата — показываем только слоты на эту дату; без выбора даты — все слоты */
  if (selectedDate && list.length) {
    list = list.filter(function (x) { return x && x.slot && x.slot.date === selectedDate; });
  }

  var noSlotsAfterFilters = allList.length > 0 && !list.length;
  var workshopCount = (workshopsData && workshopsData.workshops) ? workshopsData.workshops.length : 0;
  if (hintEl) {
    if (scheduleModalState.slotsLoading) {
      hintEl.style.display = 'block';
      hintEl.textContent = 'Загрузка слотов…';
    } else if (!allList.length) {
      hintEl.style.display = 'block';
      if (workshopCount === 0) {
        hintEl.textContent = 'Нет доступных мастер-классов';
      } else {
        hintEl.innerHTML =
          '<p class="schedule-modal__list-hint-text">Пока нет открытых слотов на выбранный период</p>' +
          '<button type="button" class="schedule-request-btn" id="scheduleRequestBtn">Хочу мастер-класс</button>';
      }
    } else if (noSlotsForSelectedDate || noSlotsAfterFilters) {
      hintEl.style.display = 'block';
      hintEl.innerHTML =
        '<p class="schedule-modal__list-hint-text">Нет слотов по выбранным фильтрам</p>' +
        '<button type="button" class="schedule-request-btn" id="scheduleRequestBtn">Хочу мастер-класс</button>';
    } else {
      hintEl.style.display = 'none';
      hintEl.textContent = '';
    }
  }

  var byDate = {};
  list.forEach(function (item) {
    var d = item && item.slot ? item.slot.date : null;
    if (!d) return;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(item);
  });
  var dates = Object.keys(byDate).sort();

  listEl.innerHTML = dates.map(function (dateKey) {
    var slots = byDate[dateKey] || [];
    var cards = slots.map(function (item) {
      var w = item.workshop;
      var s = item.slot;
      if (!w || !s) return '';
      var free = typeof s.freeSeats === 'number' ? s.freeSeats : 0;
      var busy = free <= 0 || String(s.status || '').toUpperCase() !== 'OPEN';
      var placesText = busy ? 'Нет мест' : (free === 1 ? 'Осталось 1 место' : 'Осталось ' + free + ' мест');
      return (
        '<article class="schedule-slot-card" data-workshop-id="' + w.id + '" data-slot-id="' + (s.id || '') + '" data-slot-date="' + (s.date || '') + '" data-slot-time="' + (s.time || '') + '" role="button" tabindex="0">' +
          '<div class="schedule-slot-card__header">' +
            '<span class="schedule-slot-card__datetime">' + formatDateShort(s.date) + ' в ' + (s.time ? s.time.slice(0, 5) : '') + '</span>' +
            '<span class="schedule-slot-card__places schedule-slot-card__places--' + (busy ? 'busy' : 'free') + '">' + placesText + '</span>' +
            '<button type="button" class="schedule-slot-card__view-btn schedule-slot-card__more-chip" aria-label="Узнать подробнее о мастер-классе">' +
              '<span class="schedule-slot-card__more-chip-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>' +
              '<span class="schedule-slot-card__more-chip-text">Узнать подробнее</span>' +
            '</button>' +
          '</div>' +
          '<h3 class="schedule-slot-card__title">' + (w.title || '') + '</h3>' +
          '<div class="schedule-slot-card__meta">' +
            (w.duration ? '<span>' + w.duration + '</span>' : '') +
            (w.levelText ? '<span>' + w.levelText + '</span>' : '') +
          '</div>' +
          '<div class="schedule-slot-card__price">' + formatPrice(w.price || 0) + ' ₽</div>' +
        '</article>'
      );
    }).join('');
    return (
      '<section class="schedule-slot-group" data-date="' + dateKey + '">' +
        '<div class="schedule-slot-day-divider">' + formatDateShort(dateKey) + '</div>' +
        cards +
      '</section>'
    );
  }).join('');

  listEl.querySelectorAll('.schedule-slot-card').forEach(function (card) {
    var workshopId = card.getAttribute('data-workshop-id');
    var slotId = card.getAttribute('data-slot-id');
    var slotDate = card.getAttribute('data-slot-date');
    var slotTime = card.getAttribute('data-slot-time');
    var workshop = workshopsData && workshopsData.workshops ? workshopsData.workshops.find(function (w) { return w.id === workshopId; }) : null;
    var slot = (scheduleModalState.slotsWithWorkshop || []).map(function (x) { return x.slot; }).find(function (s) {
      if (s.id && slotId) return s.id === slotId;
      return s.date === slotDate && s.time === slotTime;
    });
    if (!workshop || !slot) return;
    function openBookingFromSlot(e) {
      if (e && e.target && e.target.closest && e.target.closest('.schedule-slot-card__view-btn')) {
        e.preventDefault();
        e.stopPropagation();
        openWorkshopPreviewModal(workshop, slot);
        return;
      }
      var free = typeof slot.freeSeats === 'number' ? slot.freeSeats : 0;
      var busy = free <= 0 || String(slot.status || '').toUpperCase() !== 'OPEN';
      if (busy) return; /* запись на слот без мест — ничего не делаем */
      openBookingModalForSlot(workshop, slot);
    }
    card.addEventListener('click', openBookingFromSlot);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBookingFromSlot(e); }
    });
  });

  bindScheduleListScrollSync();
}

function applyScheduleFiltersAndRefresh(keepScroll) {
  if (!scheduleModalState.selectedDate) {
    var firstDate = findClosestScheduleDateWithSlots(null);
    if (firstDate) {
      scheduleModalState.weekStart = getWeekStartForDate(firstDate);
    }
  }
  updateScheduleFilterButtons();
  renderScheduleCalendar();
  renderScheduleSlotList();
  if (!keepScroll && scheduleModalState.selectedDate && hasFilteredSlotsForDate(scheduleModalState.selectedDate)) {
    scrollScheduleListToDate(scheduleModalState.selectedDate, false);
  }
}

function showScheduleDetailScreen() {
  var screenList = document.getElementById('scheduleScreenList');
  var screenDetail = document.getElementById('scheduleScreenDetail');
  var bodyEl = document.getElementById('scheduleDetailBody');
  if (!screenList || !screenDetail || !bodyEl) return;
  var w = scheduleModalState.detailWorkshop;
  var s = scheduleModalState.detailSlot;
  if (!w || !s) return;
  var free = typeof s.freeSeats === 'number' ? s.freeSeats : 0;
  var cap = typeof s.capacityTotal === 'number' ? s.capacityTotal : (w.capacityPerSlot || 6);
  var startAt = s.startAt || (s.date && s.time ? s.date + 'T' + s.time + ':00' : '');
  var dur = w.durationMinutes != null ? w.durationMinutes : 120;
  var timeStr = s.time ? s.time.slice(0, 5) : '';
  bodyEl.innerHTML =
    '<h3 class="schedule-detail-title">' + (w.title || '') + '</h3>' +
    '<div class="schedule-detail-slot">' +
      '<p><strong>Дата:</strong> ' + formatDateShort(s.date) + '</p>' +
      '<p><strong>Время:</strong> ' + timeStr + '</p>' +
      '<p><strong>Осталось мест:</strong> ' + free + ' из ' + cap + '</p>' +
      '<p class="schedule-detail-price">' + formatPrice(w.price || 0) + ' ₽</p>' +
    '</div>';
  screenList.hidden = true;
  screenDetail.hidden = false;
}

function hideScheduleDetailScreen() {
  var screenList = document.getElementById('scheduleScreenList');
  var screenDetail = document.getElementById('scheduleScreenDetail');
  if (screenList) screenList.hidden = false;
  if (screenDetail) screenDetail.hidden = true;
}

function stopScheduleCarouselAutoScroll() {
  if (scheduleModalState && scheduleModalState.carouselResumeTimeoutId) {
    clearTimeout(scheduleModalState.carouselResumeTimeoutId);
    scheduleModalState.carouselResumeTimeoutId = 0;
  }
  if (scheduleModalState && scheduleModalState.carouselIntervalId) {
    clearInterval(scheduleModalState.carouselIntervalId);
    scheduleModalState.carouselIntervalId = 0;
  }
  if (scheduleModalState && typeof scheduleModalState.carouselCleanup === 'function') {
    scheduleModalState.carouselCleanup();
    scheduleModalState.carouselCleanup = null;
  }
}

function startScheduleCarouselAutoScroll() {
  var carousel = document.getElementById('scheduleDetailCarousel');
  if (!carousel) return;
  var items = carousel.querySelectorAll('.schedule-detail-carousel__item');
  if (items.length < 2) return;

  stopScheduleCarouselAutoScroll();
  carousel.scrollLeft = 0;

  var drag = { active: false, startX: 0, startScrollLeft: 0, moved: false, lastDx: 0 };
  var dragThreshold = 8;
  var wrapThreshold = 25;

  function getClosestIndex() {
    var left = carousel.scrollLeft;
    var bestIndex = 0;
    var bestDiff = Infinity;
    for (var i = 0; i < items.length; i++) {
      var diff = Math.abs(items[i].offsetLeft - left);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  function tick() {
    if (!document.body.contains(carousel)) {
      stopScheduleCarouselAutoScroll();
      return;
    }
    var currentIndex = getClosestIndex();
    var nextIndex = (currentIndex + 1) % items.length;
    carousel.scrollTo({ left: items[nextIndex].offsetLeft, behavior: 'smooth' });
  }

  function resumeAfterDelay() {
    if (scheduleModalState.carouselResumeTimeoutId) clearTimeout(scheduleModalState.carouselResumeTimeoutId);
    if (scheduleModalState.carouselIntervalId) clearInterval(scheduleModalState.carouselIntervalId);
    scheduleModalState.carouselIntervalId = 0;
    scheduleModalState.carouselResumeTimeoutId = window.setTimeout(function () {
      scheduleModalState.carouselIntervalId = window.setInterval(tick, 3000);
      scheduleModalState.carouselResumeTimeoutId = 0;
    }, 1800);
  }

  function stopAutoOnly() {
    if (scheduleModalState.carouselResumeTimeoutId) clearTimeout(scheduleModalState.carouselResumeTimeoutId);
    if (scheduleModalState.carouselIntervalId) clearInterval(scheduleModalState.carouselIntervalId);
    scheduleModalState.carouselIntervalId = 0;
    scheduleModalState.carouselResumeTimeoutId = 0;
  }

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    stopAutoOnly();
    drag.active = true;
    drag.moved = false;
    drag.startX = e.clientX;
    drag.startScrollLeft = carousel.scrollLeft;
    drag.targetLink = e.target.closest ? e.target.closest('a') : null;
    try { carousel.setPointerCapture(e.pointerId); } catch (err) {}
    carousel.addEventListener('pointermove', onPointerMove, { passive: false });
    carousel.addEventListener('pointerup', onPointerUp, true);
    carousel.addEventListener('pointercancel', onPointerUp, true);
  }

  function onPointerMove(e) {
    if (!drag.active) return;
    e.preventDefault();
    var dx = drag.startX - e.clientX;
    drag.lastDx = dx;
    if (!drag.moved && Math.abs(dx) > dragThreshold) drag.moved = true;
    var maxScroll = carousel.scrollWidth - carousel.clientWidth;
    carousel.scrollLeft = Math.max(0, Math.min(maxScroll, drag.startScrollLeft + dx));
  }

  function onPointerUp(e) {
    if (!drag.active) return;
    try { carousel.releasePointerCapture(e.pointerId); } catch (err) {}
    carousel.removeEventListener('pointermove', onPointerMove, { passive: false });
    carousel.removeEventListener('pointerup', onPointerUp, true);
    carousel.removeEventListener('pointercancel', onPointerUp, true);
    var wasDrag = drag.moved;
    drag.active = false;
    if (wasDrag) {
      var maxScroll = carousel.scrollWidth - carousel.clientWidth;
      var atEnd = maxScroll <= 0 || carousel.scrollLeft >= maxScroll - wrapThreshold;
      var atStart = carousel.scrollLeft <= wrapThreshold;
      if (atEnd && drag.lastDx > dragThreshold) {
        carousel.scrollTo({ left: 0, behavior: 'smooth' });
      } else if (atStart && drag.lastDx < -dragThreshold) {
        carousel.scrollTo({ left: items[items.length - 1].offsetLeft, behavior: 'smooth' });
      } else {
        var idx = getClosestIndex();
        carousel.scrollTo({ left: items[idx].offsetLeft, behavior: 'smooth' });
      }
      resumeAfterDelay();
    } else if (drag.targetLink) {
      if (drag.targetLink.target === '_blank' && drag.targetLink.href) {
        window.open(drag.targetLink.href, '_blank', 'noopener');
      } else {
        drag.targetLink.click();
      }
    }
  }

  function onPointerEnter() {
    stopAutoOnly();
  }

  function onPointerLeave(e) {
    if (drag.active) return;
    resumeAfterDelay();
  }

  function onWheel() {
    stopAutoOnly();
    resumeAfterDelay();
  }

  carousel.addEventListener('pointerdown', onPointerDown, { passive: false, capture: true });
  carousel.addEventListener('pointerenter', onPointerEnter, { passive: true });
  carousel.addEventListener('pointerleave', onPointerLeave, { passive: true });
  carousel.addEventListener('wheel', onWheel, { passive: true });
  scheduleModalState.carouselCleanup = function () {
    if (drag.active) {
      carousel.removeEventListener('pointermove', onPointerMove, { passive: false });
      carousel.removeEventListener('pointerup', onPointerUp, true);
      carousel.removeEventListener('pointercancel', onPointerUp, true);
    }
    carousel.removeEventListener('pointerdown', onPointerDown, true);
    carousel.removeEventListener('pointerenter', onPointerEnter);
    carousel.removeEventListener('pointerleave', onPointerLeave);
    carousel.removeEventListener('wheel', onWheel);
  };

  scheduleModalState.carouselIntervalId = window.setInterval(tick, 3000);
}

/* Верхняя секция использует только CSS position: sticky — без переключения в fixed и без скачка */
function bindScheduleTopSectionStickyMode() {
  if (typeof scheduleModalState.topSectionStickyCleanup === 'function') {
    scheduleModalState.topSectionStickyCleanup();
    scheduleModalState.topSectionStickyCleanup = null;
  }
}

function closeScheduleModal() {
  var overlay = document.getElementById('scheduleModalOverlay');
  var modal = overlay ? overlay.querySelector('.schedule-modal') : null;
  if (overlay) {
    overlay.style.display = 'none';
    overlay.classList.remove('active');
  }
  if (typeof scheduleModalState.topSectionStickyCleanup === 'function') {
    scheduleModalState.topSectionStickyCleanup();
    scheduleModalState.topSectionStickyCleanup = null;
  }
  if (typeof scheduleModalState.listScrollCleanup === 'function') {
    scheduleModalState.listScrollCleanup();
    scheduleModalState.listScrollCleanup = null;
  }
  if (scheduleModalState.listScrollRaf) {
    cancelAnimationFrame(scheduleModalState.listScrollRaf);
    scheduleModalState.listScrollRaf = 0;
  }
  stopScheduleCarouselAutoScroll();
  document.body.style.overflow = '';
  scheduleModalState.slotsLoading = false;
  hideScheduleDetailScreen();
}

function openScheduleModal() {
  var overlay = document.getElementById('scheduleModalOverlay');
  if (!overlay) return;
  var workshops = workshopsData && workshopsData.workshops ? workshopsData.workshops : [];
  var now = new Date();
  scheduleModalState.year = now.getFullYear();
  scheduleModalState.month = now.getMonth();
  scheduleModalState.selectedDate = null; /* чип с датой показываем только после клика по дате в календаре */
  var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  scheduleModalState.weekStart = getWeekStartForDate(todayStr);
  scheduleModalState.highlightedDate = todayStr; /* по умолчанию подсвечиваем сегодняшний день в календаре */
  scheduleModalState.view = 'week';
  scheduleModalState.slotsWithWorkshop = [];
  scheduleModalState.detailWorkshop = null;
  scheduleModalState.detailSlot = null;
  scheduleModalState.filters = {
    workshopIds: [],
    onlyAvailable: true,
    priceMin: null,
    priceMax: null,
  };
  scheduleModalState.filterDrafts = {
    workshopIds: [],
    priceMin: null,
    priceMax: null,
  };

  overlay.style.display = 'flex';
  overlay.classList.add('active');
  startScheduleCarouselAutoScroll();
  bindScheduleTopSectionStickyMode();
  updateScheduleFilterButtons();
  // Блокируем прокрутку страницы: скролл только внутри модалки
  document.body.style.overflow = 'hidden';
  renderScheduleCalendar();

  if (!workshops.length) {
    scheduleModalState.slotsLoading = false;
    scheduleModalState.slotsWithWorkshop = [];
    applyScheduleFiltersAndRefresh(false);
    return;
  }

  scheduleModalState.slotsLoading = true;
  var hintEl = document.getElementById('scheduleListHint');
  if (hintEl) hintEl.textContent = 'Загрузка слотов…';
  applyScheduleFiltersAndRefresh(false);

  var range = getDateRange(0, 60);
  var dateFrom = range.dateFrom;
  var dateTo = range.dateTo;
  var promises = workshops.map(function (w) {
    var url = API_BASE + '/api/public/slots?workshopId=' + encodeURIComponent(w.id) + '&dateFrom=' + encodeURIComponent(dateFrom) + '&dateTo=' + encodeURIComponent(dateTo);
    return fetch(url, { cache: 'no-store' }).then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; });
  });
  Promise.all(promises)
    .then(function (results) {
      scheduleModalState.slotsLoading = false;
      var list = [];
      results.forEach(function (slots, idx) {
        var workshop = workshops[idx];
        if (!workshop || !Array.isArray(slots)) return;
        slots.forEach(function (slot) {
          list.push({ workshop: workshop, slot: slot });
        });
      });
      list.sort(function (a, b) {
        var d1 = (a.slot && a.slot.date) ? a.slot.date : '';
        var t1 = (a.slot && a.slot.time) ? (a.slot.time || '') : '';
        var d2 = (b.slot && b.slot.date) ? b.slot.date : '';
        var t2 = (b.slot && b.slot.time) ? (b.slot.time || '') : '';
        if (d1 !== d2) return d1.localeCompare(d2);
        return t1.localeCompare(t2);
      });
      scheduleModalState.slotsWithWorkshop = list;
      applyScheduleFiltersAndRefresh(false);
    })
    .catch(function () {
      scheduleModalState.slotsLoading = false;
      scheduleModalState.slotsWithWorkshop = [];
      applyScheduleFiltersAndRefresh(false);
    });
}

function openScheduleFilterModal(modalId) {
  var modal = document.getElementById(modalId);
  if (!modal) return;
  modal.style.display = 'flex';
  modal.classList.add('active');
}

function closeScheduleFilterModal(modalId) {
  var modal = document.getElementById(modalId);
  if (!modal) return;
  modal.style.display = 'none';
  modal.classList.remove('active');
}

function openWorkshopPreviewModal(workshop, slot) {
  var modal = document.getElementById('workshopPreviewModal');
  var imgEl = document.getElementById('workshopPreviewImage');
  var imgWrap = document.getElementById('workshopPreviewImageWrap');
  var titleEl = document.getElementById('workshopPreviewTitleH3');
  var metaEl = document.getElementById('workshopPreviewMeta');
  var descEl = document.getElementById('workshopPreviewDescription');
  if (!modal || !titleEl) return;
  previewWorkshopId = workshop.id || null;
  previewSlot = slot && (slot.date || slot.time) ? slot : null;
  var title = workshop.title || 'Мастер-класс';
  var metaParts = [];
  if (workshop.duration) metaParts.push(workshop.duration);
  if (workshop.levelText) metaParts.push(workshop.levelText);
  if (workshop.price != null) metaParts.push(formatPrice(workshop.price) + ' ₽');
  if (imgEl) {
    var src = workshop.image || '';
    if (src) {
      imgEl.src = src;
      imgEl.alt = title;
      if (imgWrap) imgWrap.style.display = '';
      imgEl.style.display = '';
    } else {
      if (imgWrap) imgWrap.style.display = 'none';
      imgEl.style.display = 'none';
    }
  }
  titleEl.textContent = title;
  if (metaEl) metaEl.textContent = metaParts.join(' • ');
  if (descEl) descEl.textContent = workshop.description || '';
  document.getElementById('workshopPreviewTitle').textContent = title;
  modal.style.display = 'flex';
  modal.classList.add('active');
}

function closeWorkshopPreviewModal() {
  var modal = document.getElementById('workshopPreviewModal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.classList.remove('active');
  previewWorkshopId = null;
  previewSlot = null;
}

function isScheduleDateTimeOccupied(dateStr, timeStr) {
  if (!dateStr || !timeStr) return false;
  var list = (scheduleModalState && scheduleModalState.slotsWithWorkshop) || [];
  return list.some(function (x) {
    var s = x && x.slot ? x.slot : null;
    return !!(s && s.date === dateStr && s.time === timeStr);
  });
}

function setRequestParticipantsOptions(max) {
  var sel = document.getElementById('requestParticipants');
  if (!sel) return;
  var m = Math.max(1, parseInt(String(max), 10) || 1);
  var current = parseInt(sel.value || '1', 10) || 1;
  sel.innerHTML = '';
  for (var i = 1; i <= m; i++) {
    var opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = peopleLabel(i);
    sel.appendChild(opt);
  }
  sel.value = String(Math.min(current, m));
}

function validateWorkshopRequestDateTime(showError) {
  var dateTimeInput = document.getElementById('requestDateTime');
  var err = document.getElementById('requestWorkshopError');
  if (!dateTimeInput) return false;
  var value = (dateTimeInput.value || '').trim();
  if (!value) {
    if (showError && err) {
      err.textContent = 'Выберите дату и время';
      err.style.display = 'block';
    }
    return false;
  }
  var parts = value.split('T');
  var datePart = parts[0];
  var timePart = (parts[1] || '').slice(0, 5);
  var dt = new Date(datePart + 'T' + timePart + ':00');
  if (Number.isNaN(dt.getTime()) || dt.getTime() < Date.now()) {
    if (showError && err) {
      err.textContent = 'Нельзя выбрать прошедшую дату/время';
      err.style.display = 'block';
    }
    return false;
  }
  if (isScheduleDateTimeOccupied(datePart, timePart)) {
    if (showError && err) {
      err.textContent = 'На это время уже есть мастер-класс';
      err.style.display = 'block';
    }
    return false;
  }
  if (err) err.style.display = 'none';
  return true;
}

function updateRequestWorkshopInfo() {
  var wrap = document.getElementById('requestWorkshopInfo');
  var descEl = document.getElementById('requestWorkshopInfoDescription');
  var priceEl = document.getElementById('requestWorkshopInfoPrice');
  if (!wrap) return;
  var workshopId = (document.getElementById('requestWorkshopId') || {}).value || '';
  var workshops = (workshopsData && workshopsData.workshops) ? workshopsData.workshops : [];
  var workshop = workshopId ? workshops.find(function (w) { return w.id === workshopId; }) : null;
  if (!workshop) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';
  if (descEl) descEl.textContent = workshop.description || '';
  if (priceEl) priceEl.textContent = 'Цена: ' + formatPrice(workshop.price || 0) + ' ₽';
}

function openWorkshopRequestModal(prefillDate, prefillWorkshopId, prefillTime) {
  var modal = document.getElementById('requestWorkshopModal');
  var workshopSelect = document.getElementById('requestWorkshopId');
  var dateTimeInput = document.getElementById('requestDateTime');
  var err = document.getElementById('requestWorkshopError');
  var form = document.getElementById('requestWorkshopForm');
  if (!modal || !workshopSelect || !dateTimeInput || !form) return;

  form.reset();
  if (err) err.style.display = 'none';

  var workshops = (workshopsData && workshopsData.workshops) ? workshopsData.workshops : [];
  workshopSelect.innerHTML = '<option value="">Выберите мастер-класс</option>' + workshops.map(function (w) {
    return '<option value="' + w.id + '">' + (w.title || '') + '</option>';
  }).join('');
  if (workshops.length) {
    if (prefillWorkshopId && workshops.some(function (w) { return w.id === prefillWorkshopId; })) {
      workshopSelect.value = prefillWorkshopId;
      var selW = workshops.find(function (w) { return w.id === prefillWorkshopId; });
      setRequestParticipantsOptions(selW.maxParticipants || selW.capacityPerSlot || 6);
    } else {
      workshopSelect.value = workshops[0].id;
      setRequestParticipantsOptions(workshops[0].maxParticipants || workshops[0].capacityPerSlot || 6);
    }
  } else {
    setRequestParticipantsOptions(1);
  }

  updateRequestWorkshopInfo();

  if (prefillDate) {
    var timePart = (prefillTime && String(prefillTime).slice(0, 5)) || '12:00';
    dateTimeInput.value = prefillDate + 'T' + timePart;
  } else {
    var now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    dateTimeInput.value =
      now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + 'T' +
      String(now.getHours()).padStart(2, '0') + ':00';
  }

  modal.style.display = 'flex';
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeWorkshopRequestModal() {
  var modal = document.getElementById('requestWorkshopModal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.classList.remove('active');
  if (!(document.getElementById('scheduleModalOverlay') || {}).classList?.contains('active')) {
    document.body.style.overflow = '';
  }
}

async function submitWorkshopRequestForm(e) {
  e.preventDefault();
  var err = document.getElementById('requestWorkshopError');
  if (err) err.style.display = 'none';

  var workshopId = (document.getElementById('requestWorkshopId') || {}).value || '';
  var dateTimeRaw = (document.getElementById('requestDateTime') || {}).value || '';
  var name = ((document.getElementById('requestName') || {}).value || '').trim();
  var phone = ((document.getElementById('requestPhone') || {}).value || '').trim();
  var email = ((document.getElementById('requestEmail') || {}).value || '').trim();
  var messenger = (document.getElementById('requestMessenger') || {}).value || '';
  var participants = parseInt((document.getElementById('requestParticipants') || {}).value || '1', 10) || 1;
  var comment = ((document.getElementById('requestComment') || {}).value || '').trim();
  var consent = !!((document.getElementById('requestConsent') || {}).checked);
  var honeypot = ((document.getElementById('requestHoneypot') || {}).value || '').trim();

  if (!workshopId || !name || !phone || !email || !messenger || !consent) {
    if (err) {
      err.textContent = 'Заполните обязательные поля и подтвердите согласие';
      err.style.display = 'block';
    }
    return;
  }
  if (!validatePhone(phone)) {
    if (err) {
      err.textContent = 'Введите корректный телефон';
      err.style.display = 'block';
    }
    return;
  }
  if (!validateEmail(email)) {
    if (err) {
      err.textContent = 'Введите корректный email';
      err.style.display = 'block';
    }
    return;
  }
  if (!validateWorkshopRequestDateTime(true)) return;

  var datePart = dateTimeRaw.split('T')[0];
  var timePart = (dateTimeRaw.split('T')[1] || '').slice(0, 5);
  var submitBtn = document.getElementById('requestWorkshopSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';
  }
  try {
    const res = await fetch(`${API_BASE}/api/public/workshop-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workshopId,
        date: datePart,
        time: timePart,
        name,
        phone,
        email,
        messenger,
        participants,
        comment: comment || null,
        honeypot,
      }),
    });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var msg = (data && data.error) || 'Не удалось отправить заявку';
      if (data && data.fields && data.fields.email) msg = data.fields.email;
      throw new Error(msg);
    }

    closeWorkshopRequestModal();
    if (typeof closeScheduleModal === 'function') closeScheduleModal();
    var text = document.getElementById('successModalText');
    if (text) text.textContent = 'Заявка на новый мастер-класс отправлена. Мы свяжемся с вами для подтверждения.';
    openSuccessModal();
  } catch (error) {
    if (err) {
      err.textContent = (error && error.message) ? error.message : 'Не удалось отправить заявку';
      err.style.display = 'block';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отправить заявку';
    }
  }
}

function renderWorkshopFilterOptions() {
  var wrap = document.getElementById('scheduleWorkshopFilterOptions');
  if (!wrap) return;
  var workshops = (workshopsData && workshopsData.workshops) ? workshopsData.workshops : [];
  var selected = Array.isArray(scheduleModalState.filterDrafts.workshopIds) ? scheduleModalState.filterDrafts.workshopIds.map(String) : [];
  wrap.innerHTML = workshops.map(function (w) {
    var id = String(w.id);
    var checked = selected.indexOf(id) !== -1 ? ' checked' : '';
    return (
      '<label class="schedule-filter-option">' +
        '<input type="checkbox" value="' + id + '"' + checked + '>' +
        '<span class="schedule-filter-option__label">' + (w.title || '') + '</span>' +
      '</label>'
    );
  }).join('');
}

function openWorkshopFilterModal() {
  scheduleModalState.filterDrafts.workshopIds = (scheduleModalState.filters.workshopIds || []).slice();
  renderWorkshopFilterOptions();
  openScheduleFilterModal('scheduleWorkshopFilterModal');
}

function applyWorkshopFilterFromModal() {
  var wrap = document.getElementById('scheduleWorkshopFilterOptions');
  if (!wrap) return;
  var ids = Array.from(wrap.querySelectorAll('input[type="checkbox"]:checked')).map(function (i) { return String(i.value); });
  scheduleModalState.filters.workshopIds = ids;
  closeScheduleFilterModal('scheduleWorkshopFilterModal');
  applyScheduleFiltersAndRefresh(false);
}

function resetWorkshopFilterFromModal() {
  scheduleModalState.filters.workshopIds = [];
  closeScheduleFilterModal('scheduleWorkshopFilterModal');
  applyScheduleFiltersAndRefresh(false);
}

function openPriceFilterModal() {
  var bounds = getSchedulePriceBounds();
  var minInput = document.getElementById('schedulePriceMinInput');
  var maxInput = document.getElementById('schedulePriceMaxInput');
  var hint = document.getElementById('schedulePriceFilterHint');
  scheduleModalState.filterDrafts.priceMin = scheduleModalState.filters.priceMin;
  scheduleModalState.filterDrafts.priceMax = scheduleModalState.filters.priceMax;
  if (minInput) minInput.value = scheduleModalState.filterDrafts.priceMin != null ? String(scheduleModalState.filterDrafts.priceMin) : '';
  if (maxInput) maxInput.value = scheduleModalState.filterDrafts.priceMax != null ? String(scheduleModalState.filterDrafts.priceMax) : '';
  if (hint) hint.textContent = 'Диапазон доступных цен: ' + formatPrice(bounds.min) + ' - ' + formatPrice(bounds.max) + ' ₽';
  openScheduleFilterModal('schedulePriceFilterModal');
}

function applyPriceFilterFromModal() {
  var minInput = document.getElementById('schedulePriceMinInput');
  var maxInput = document.getElementById('schedulePriceMaxInput');
  var minVal = minInput ? parseMoney(minInput.value) : null;
  var maxVal = maxInput ? parseMoney(maxInput.value) : null;
  if (minVal != null && maxVal != null && minVal > maxVal) {
    var tmp = minVal;
    minVal = maxVal;
    maxVal = tmp;
  }
  scheduleModalState.filters.priceMin = minVal;
  scheduleModalState.filters.priceMax = maxVal;
  closeScheduleFilterModal('schedulePriceFilterModal');
  applyScheduleFiltersAndRefresh(false);
}

function resetPriceFilterFromModal() {
  scheduleModalState.filters.priceMin = null;
  scheduleModalState.filters.priceMax = null;
  closeScheduleFilterModal('schedulePriceFilterModal');
  applyScheduleFiltersAndRefresh(false);
}

function initScheduleModal() {
  var closeBtn = document.getElementById('closeScheduleModal');
  var overlay = document.getElementById('scheduleModalOverlay');
  var prevBtn = document.getElementById('scheduleCalendarPrev');
  var nextBtn = document.getElementById('scheduleCalendarNext');
  var backBtn = document.getElementById('scheduleDetailBack');
  var workshopFilterBtn = document.getElementById('scheduleWorkshopFilterBtn');
  var availabilityFilterBtn = document.getElementById('scheduleAvailabilityFilterBtn');
  var priceFilterBtn = document.getElementById('schedulePriceFilterBtn');
  var workshopModal = document.getElementById('scheduleWorkshopFilterModal');
  var priceModal = document.getElementById('schedulePriceFilterModal');
  var closeWorkshopModalBtn = document.getElementById('closeScheduleWorkshopFilterModal');
  var closePriceModalBtn = document.getElementById('closeSchedulePriceFilterModal');
  var applyWorkshopBtn = document.getElementById('scheduleWorkshopFilterApply');
  var resetWorkshopBtn = document.getElementById('scheduleWorkshopFilterReset');
  var applyPriceBtn = document.getElementById('schedulePriceFilterApply');
  var resetPriceBtn = document.getElementById('schedulePriceFilterReset');
  var requestModal = document.getElementById('requestWorkshopModal');
  var closeRequestBtn = document.getElementById('closeRequestWorkshopModal');
  var requestCancelBtn = document.getElementById('cancelRequestWorkshopModal');
  var requestForm = document.getElementById('requestWorkshopForm');
  var requestWorkshopSelect = document.getElementById('requestWorkshopId');
  var requestDateTime = document.getElementById('requestDateTime');
  var requestPhoneInput = document.getElementById('requestPhone');

  // Делегирование: клик по кнопке открытия работает с любого устройства (в т.ч. тач)
  document.addEventListener('click', function (e) {
    var openTrigger = e.target && e.target.closest && e.target.closest('[data-action="open-schedule"]');
    if (openTrigger) {
      e.preventDefault();
      e.stopPropagation();
      var mobileNav = document.getElementById('mobileNav');
      var mobileMenuBtn = document.getElementById('mobileMenuBtn');
      if (mobileNav && mobileNav.classList.contains('active')) {
        mobileNav.classList.remove('active');
        if (mobileMenuBtn) {
          mobileMenuBtn.classList.remove('active');
          mobileMenuBtn.setAttribute('aria-expanded', 'false');
        }
        if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';
      }
      openScheduleModal();
    }
  });
  var headerBackBtn = document.getElementById('scheduleHeaderBackBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeScheduleModal);
  if (headerBackBtn) headerBackBtn.addEventListener('click', function () {
    var screenDetail = document.getElementById('scheduleScreenDetail');
    if (screenDetail && !screenDetail.hidden) {
      hideScheduleDetailScreen();
    } else {
      closeScheduleModal();
    }
  });
  if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closeScheduleModal(); });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var previewModal = document.getElementById('workshopPreviewModal');
    if (previewModal && previewModal.classList.contains('active')) {
      closeWorkshopPreviewModal();
      return;
    }
    if (overlay && overlay.classList.contains('active')) {
      if (document.getElementById('scheduleScreenDetail') && !document.getElementById('scheduleScreenDetail').hidden) {
        hideScheduleDetailScreen();
      } else {
        closeScheduleModal();
      }
    }
  });

  var closePreviewBtn = document.getElementById('closeWorkshopPreviewModal');
  var previewModalEl = document.getElementById('workshopPreviewModal');
  var previewBookBtn = document.getElementById('workshopPreviewBookBtn');
  if (closePreviewBtn) closePreviewBtn.addEventListener('click', closeWorkshopPreviewModal);
  if (previewModalEl) previewModalEl.addEventListener('click', function (e) { if (e.target === previewModalEl) closeWorkshopPreviewModal(); });
  if (previewBookBtn) {
    previewBookBtn.addEventListener('click', function () {
      var id = previewWorkshopId;
      var slot = previewSlot;
      if (!id) return;
      closeWorkshopPreviewModal();
      if (slot) {
        var workshop = workshopsData && workshopsData.workshops ? workshopsData.workshops.find(function (w) { return w.id === id; }) : null;
        if (workshop) openBookingModalForSlot(workshop, slot);
      } else {
        openBookingModal(id);
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', function (e) {
      var el = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement);
      if (!el || !el.closest) return;
      var requestBtn = el.closest('.schedule-request-btn');
      if (!requestBtn) return;
      e.preventDefault();
      e.stopPropagation();
      var date = scheduleModalState && scheduleModalState.selectedDate;
      openWorkshopRequestModal(date);
    });
  }

  var scheduleTabs = document.getElementById('scheduleTabs');
  if (scheduleTabs) {
    scheduleTabs.addEventListener('click', function (e) {
      var clearBtn = e.target && e.target.closest && e.target.closest('.schedule-filter-chip__clear');
      if (!clearBtn) return;
      e.preventDefault();
      e.stopPropagation();
      if (clearBtn.closest('#scheduleWorkshopFilterBtn')) {
        scheduleModalState.filters.workshopIds = [];
        updateScheduleFilterButtons();
        applyScheduleFiltersAndRefresh(false);
        return;
      }
      if (clearBtn.closest('#schedulePriceFilterBtn')) {
        scheduleModalState.filters.priceMin = null;
        scheduleModalState.filters.priceMax = null;
        if (scheduleModalState.filterDrafts) {
          scheduleModalState.filterDrafts.priceMin = null;
          scheduleModalState.filterDrafts.priceMax = null;
        }
        updateScheduleFilterButtons();
        applyScheduleFiltersAndRefresh(false);
        return;
      }
      if (clearBtn.closest('#scheduleDateChipWrap') || clearBtn.getAttribute('data-clear') === 'date') {
        scheduleModalState.selectedDate = null;
        var today = new Date();
        var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        scheduleModalState.weekStart = getWeekStartForDate(todayStr);
        renderScheduleCalendar();
        renderScheduleSlotList();
        return;
      }
    }, true);
  }

  if (prevBtn) prevBtn.addEventListener('click', function () {
    if (scheduleModalState.view === 'month') {
      var rPrev = getScheduleMonthRange();
      scheduleModalState.year = rPrev.year;
      scheduleModalState.month = rPrev.month - 1;
      if (scheduleModalState.month < 0) { scheduleModalState.month = 11; scheduleModalState.year--; }
      renderScheduleCalendar();
    } else {
      scheduleModalState.weekStart = addDays(scheduleModalState.weekStart || getWeekStartForDate(new Date().toISOString().slice(0, 10)), -7);
      renderScheduleCalendar();
    }
  });
  if (nextBtn) nextBtn.addEventListener('click', function () {
    if (scheduleModalState.view === 'month') {
      var rNext = getScheduleMonthRange();
      scheduleModalState.year = rNext.year;
      scheduleModalState.month = rNext.month + 1;
      if (scheduleModalState.month > 11) { scheduleModalState.month = 0; scheduleModalState.year++; }
      renderScheduleCalendar();
    } else {
      scheduleModalState.weekStart = addDays(scheduleModalState.weekStart || getWeekStartForDate(new Date().toISOString().slice(0, 10)), 7);
      renderScheduleCalendar();
    }
  });

  function toggleScheduleCalendarExpand() {
    if (scheduleModalState.view === 'month') {
      scheduleModalState.view = 'week';
    } else {
      scheduleModalState.view = 'month';
      var ref = scheduleModalState.weekStart || scheduleModalState.selectedDate || scheduleModalState.highlightedDate;
      if (ref) {
        var d = new Date(ref + 'T12:00:00');
        scheduleModalState.year = d.getFullYear();
        scheduleModalState.month = d.getMonth();
      }
    }
    renderScheduleCalendar();
  }
  if (overlay) overlay.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('.schedule-modal__calendar-expand')) {
      e.preventDefault();
      e.stopPropagation();
      toggleScheduleCalendarExpand();
    }
  });

  if (backBtn) backBtn.addEventListener('click', hideScheduleDetailScreen);

  if (overlay) {
    overlay.addEventListener('click', function (e) {
      var pickSlot = e.target && e.target.closest && e.target.closest('.schedule-detail-carousel__item[data-action="pick-slot"]');
      if (pickSlot) {
        e.preventDefault();
        e.stopPropagation();
        var ds = scheduleModalState && scheduleModalState.detailSlot;
        var dw = scheduleModalState && scheduleModalState.detailWorkshop;
        var date = (ds && ds.date) || (scheduleModalState && scheduleModalState.selectedDate);
        var workshopId = dw && dw.id ? dw.id : undefined;
        var slotTime = ds && ds.time ? ds.time : undefined;
        hideScheduleDetailScreen();
        openWorkshopRequestModal(date, workshopId, slotTime);
      }
    });
  }

  if (workshopFilterBtn) workshopFilterBtn.addEventListener('click', openWorkshopFilterModal);
  if (priceFilterBtn) priceFilterBtn.addEventListener('click', openPriceFilterModal);
  if (availabilityFilterBtn) availabilityFilterBtn.addEventListener('click', function () {
    scheduleModalState.filters.onlyAvailable = !scheduleModalState.filters.onlyAvailable;
    applyScheduleFiltersAndRefresh(false);
  });
  if (closeWorkshopModalBtn) closeWorkshopModalBtn.addEventListener('click', function () { closeScheduleFilterModal('scheduleWorkshopFilterModal'); });
  if (closePriceModalBtn) closePriceModalBtn.addEventListener('click', function () { closeScheduleFilterModal('schedulePriceFilterModal'); });
  if (applyWorkshopBtn) applyWorkshopBtn.addEventListener('click', applyWorkshopFilterFromModal);
  if (resetWorkshopBtn) resetWorkshopBtn.addEventListener('click', resetWorkshopFilterFromModal);
  if (applyPriceBtn) applyPriceBtn.addEventListener('click', applyPriceFilterFromModal);
  if (resetPriceBtn) resetPriceBtn.addEventListener('click', resetPriceFilterFromModal);
  if (workshopModal) workshopModal.addEventListener('click', function (e) { if (e.target === workshopModal) closeScheduleFilterModal('scheduleWorkshopFilterModal'); });
  if (priceModal) priceModal.addEventListener('click', function (e) { if (e.target === priceModal) closeScheduleFilterModal('schedulePriceFilterModal'); });
  if (closeRequestBtn) closeRequestBtn.addEventListener('click', closeWorkshopRequestModal);
  if (requestCancelBtn) requestCancelBtn.addEventListener('click', closeWorkshopRequestModal);
  if (requestModal) requestModal.addEventListener('click', function (e) { if (e.target === requestModal) closeWorkshopRequestModal(); });
  if (requestForm) requestForm.addEventListener('submit', submitWorkshopRequestForm);
  if (requestPhoneInput) requestPhoneInput.addEventListener('input', function () { formatPhoneInput(requestPhoneInput); });
  if (requestDateTime) requestDateTime.addEventListener('change', function () { validateWorkshopRequestDateTime(false); });
  if (requestWorkshopSelect) requestWorkshopSelect.addEventListener('change', function () {
    var workshops = (workshopsData && workshopsData.workshops) ? workshopsData.workshops : [];
    var selected = workshops.find(function (w) { return w.id === requestWorkshopSelect.value; });
    setRequestParticipantsOptions((selected && (selected.maxParticipants || selected.capacityPerSlot)) || 6);
    updateRequestWorkshopInfo();
  });
}

function getDateRange(daysBack, daysForward) {
  const d = new Date();
  const from = new Date(d);
  from.setDate(from.getDate() - daysBack);
  const to = new Date(d);
  to.setDate(to.getDate() + daysForward);
  var dateFrom = from.toISOString().slice(0, 10);
  var dateTo = to.toISOString().slice(0, 10);
  if (!dateFrom || dateFrom === 'Invalid Date') dateFrom = new Date().toISOString().slice(0, 10);
  if (!dateTo || dateTo === 'Invalid Date') dateTo = new Date().toISOString().slice(0, 10);
  return { dateFrom, dateTo };
}

function addMinutes(isoString, minutes) {
  const d = new Date(isoString);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function isSmallScreen() {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

function isLowHeightScreen() {
  return typeof window !== 'undefined' && window.innerHeight <= 820;
}

function getBookingScrollContainer() {
  var modal = document.getElementById('bookingModal');
  if (!modal) return null;
  return modal.querySelector('.booking-form-scroll');
}

function updateBookingScrollBehavior() {
  var container = getBookingScrollContainer();
  if (!container) return;
  var modalEl = document.querySelector('#bookingModal .modal');
  var isMobile = typeof window !== 'undefined' && window.innerWidth <= 767;
  if (isMobile && modalEl && modalEl.classList.contains('modal--step2')) {
    modalEl.style.overflowY = 'auto';
    modalEl.style.webkitOverflowScrolling = 'touch';
    container.style.overflow = 'visible';
    return;
  }
  if (modalEl) {
    modalEl.style.overflowY = '';
  }
  container.style.overflow = '';
  var shouldScroll = container.scrollHeight > container.clientHeight + 1;
  container.style.overflowY = shouldScroll ? 'auto' : 'hidden';
  container.classList.toggle('is-scrollable', shouldScroll);
}

function isElementVisible(el) {
  if (!el) return false;
  if (el.getClientRects().length === 0) return false;
  var style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function scrollIntoContainerView(container, targetEl) {
  if (!container || !targetEl) return;
  var containerRect = container.getBoundingClientRect();
  var targetRect = targetEl.getBoundingClientRect();
  var padding = 12;

  if (targetRect.top < containerRect.top + padding) {
    var offsetTop = targetRect.top - containerRect.top + container.scrollTop;
    container.scrollTo({ top: Math.max(0, offsetTop - padding), behavior: 'smooth' });
    return;
  }

  if (targetRect.bottom > containerRect.bottom - padding) {
    var offsetBottom = targetRect.bottom - containerRect.bottom;
    container.scrollTo({ top: container.scrollTop + offsetBottom + padding, behavior: 'smooth' });
  }
}

function scrollToFirstInvalidField() {
  var form = document.getElementById('bookingForm');
  var container = getBookingScrollContainer();
  if (!form || !container) return;
  var candidates = form.querySelectorAll('.form-error, .form-input.error, .form-select.error');
  for (var i = 0; i < candidates.length; i++) {
    var el = candidates[i];
    if (el.classList.contains('form-error') && el.style.display === 'none') continue;
    if (!isElementVisible(el)) continue;
    var target = el.closest('.form-group') || el;
    scrollIntoContainerView(container, target);
    break;
  }
}

/** Формат даты коротко: "Пн, 2 фев" */
function formatDateShort(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return dateStr;
  var wd = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  var mon = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return wd[d.getDay()] + ', ' + d.getDate() + ' ' + mon[d.getMonth()];
}

/** Время слота "12:00–14:00" по startAt и длительности в минутах */
function formatTimeRange(startAt, durationMinutes) {
  if (!startAt) return '';
  var start = new Date(startAt);
  var end = new Date(start.getTime() + (durationMinutes || 120) * 60000);
  function pad2(n) { return String(n).padStart(2, '0'); }
  return pad2(start.getHours()) + ':' + pad2(start.getMinutes()) + '–' + pad2(end.getHours()) + ':' + pad2(end.getMinutes());
}

/** Показать шаг 1 или 2 модалки записи */
function showBookingStep(step) {
  var step1 = document.getElementById('bookingStep1');
  var step2 = document.getElementById('bookingStep2');
  var footer = document.getElementById('bookingFormFooter');
  var modalEl = document.querySelector('#bookingModal .modal');
  if (!step1 || !step2) return;
  if (step === 1) {
    step1.hidden = false;
    step2.hidden = true;
    if (footer) footer.hidden = true;
    if (modalEl) modalEl.classList.remove('modal--step2');
    updateBookingStep1NextState();
    requestAnimationFrame(updateBookingScrollBehavior);
  } else {
    step1.hidden = true;
    step2.hidden = false;
    if (footer) footer.hidden = false;
    if (modalEl) modalEl.classList.add('modal--step2');
    if (isLowHeightScreen()) {
      var container = getBookingScrollContainer();
      if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
    }
    requestAnimationFrame(updateBookingScrollBehavior);
    // Ограничить количество участников по свободным местам в выбранном слоте (1, 2, 3... до freeSeats)
    var freeSeats = selectedSlot && typeof selectedSlot.freeSeats === 'number' ? selectedSlot.freeSeats : null;
    if (freeSeats == null && selectedSlot && publicSlotsCache && publicSlotsCache.length > 0) {
      var cached = null;
      if (selectedSlot.id) {
        cached = publicSlotsCache.find(function (s) { return s.id === selectedSlot.id; });
      }
      if (!cached && selectedSlot.date) {
        var normTime = function (t) {
          if (!t) return '';
          var p = String(t).split(':');
          var h = parseInt(p[0], 10) || 0;
          var m = parseInt(p[1], 10) || 0;
          return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        };
        var selTime = normTime(selectedSlot.time);
        cached = publicSlotsCache.find(function (s) {
          return s.date === selectedSlot.date && normTime(s.time) === selTime;
        });
      }
      if (!cached && selectedSlot.date && selectedSlot.time) {
        cached = publicSlotsCache.find(function (s) { return s.date === selectedSlot.date && s.time === selectedSlot.time; });
      }
      if (!cached && selectedSlot.startAt) {
        cached = publicSlotsCache.find(function (s) {
          var slotStart = s.startAt || (s.date && s.time ? s.date + 'T' + s.time + ':00' : '');
          return slotStart && selectedSlot.startAt && slotStart.slice(0, 16) === selectedSlot.startAt.slice(0, 16);
        });
      }
      if (!cached && selectedSlot.date) {
        cached = publicSlotsCache.find(function (s) { return s.date === selectedSlot.date; });
      }
      if (cached) freeSeats = typeof cached.freeSeats === 'number' ? cached.freeSeats : null;
    }
    if (freeSeats != null && freeSeats > 0) {
      setParticipantsOptions(freeSeats);
    }
    updateBookingSelectedSummaryInline();
  }
}

/** Скрыть ошибку слота при выборе времени (кнопка "Далее" всегда активна, ошибка показывается при клике без выбора) */
function updateBookingStep1NextState() {
  var errEl = document.getElementById('slotError');
  if (errEl && selectedSlot) errEl.style.display = 'none';
}

/** Краткий текст выбранного слота для шага 2 */
function formatSelectedSlotSummary() {
  if (!selectedSlot) return '';
  var dateStr = selectedSlot.date;
  var durationMinutes = selectedWorkshop && selectedWorkshop.durationMinutes != null ? selectedWorkshop.durationMinutes : 120;
  var startAt = selectedSlot.startAt || (dateStr && selectedSlot.time ? dateStr + 'T' + selectedSlot.time + ':00' : null);
  var range = startAt ? formatTimeRange(startAt, durationMinutes) : (selectedSlot.time || '');
  var places = typeof selectedSlot.freeSeats === 'number' ? selectedSlot.freeSeats : '?';
  return formatDateShort(dateStr) + ' · ' + range + ' (' + places + ' мест)';
}

function updateBookingSelectedSummaryInline() {
  var el = document.getElementById('bookingSelectedSummaryInline');
  if (!el) return;
  el.textContent = selectedSlot ? 'Вы выбрали: ' + formatSelectedSlotSummary() : '';
}

function openSlotsOverviewModal() {
  if (!bookingCalendar || !selectedWorkshop) return;
  var d = bookingCalendar.getDate();
  var year = d.getFullYear();
  var month = d.getMonth();
  var dateFrom = year + '-' + String(month + 1).padStart(2, '0') + '-01';
  var lastDay = new Date(year, month + 1, 0).getDate();
  var dateTo = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
  var byDay = {};
  publicSlotsCache.forEach(function (s) {
    var free = s.freeSeats != null ? s.freeSeats : 0;
    var open = (s.status || '') === 'OPEN';
    if (s.date && open && free > 0) {
      byDay[s.date] = (byDay[s.date] || 0) + 1;
    }
  });
  var monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  var weekdayShort = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  var first = new Date(year, month, 1);
  var startDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var grid = [];
  var i;
  for (i = 0; i < startDow; i++) grid.push(null);
  for (i = 1; i <= daysInMonth; i++) grid.push(i);
  while (grid.length % 7 !== 0) grid.push(null);
  var html = '<h3 class="slots-overview-month">' + monthNames[month] + ' ' + year + '</h3>';
  html += '<div class="slots-overview-weekdays">';
  weekdayShort.forEach(function (w) { html += '<span class="slots-overview-wd">' + w + '</span>'; });
  html += '</div><div class="slots-overview-grid">';
  grid.forEach(function (day, idx) {
    if (day === null) {
      html += '<div class="slots-overview-cell slots-overview-cell--empty"></div>';
      return;
    }
    var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    var count = byDay[dateStr] || 0;
    html += '<div class="slots-overview-cell slots-overview-cell--clickable" role="button" tabindex="0" data-date="' + dateStr + '" title="Перейти к ' + dateStr + '">';
    html += '<span class="slots-overview-day">' + day + '</span>';
    if (count > 0) {
      html += '<span class="slots-overview-badge">' + count + '</span>';
    }
    html += '</div>';
  });
  html += '</div>';
  var content = document.getElementById('slotsOverviewContent');
  if (content) {
    content.innerHTML = html;
    content.querySelectorAll('.slots-overview-cell--clickable').forEach(function (cell) {
      var dateStr = cell.getAttribute('data-date');
      function goToDate() {
        if (!dateStr || !bookingCalendar) return;
        closeSlotsOverviewModal();
        bookingCalendar.gotoDate(dateStr);
      }
      cell.addEventListener('click', goToDate);
      cell.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToDate();
        }
      });
    });
  }
  var modal = document.getElementById('slotsOverviewModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
}

function closeSlotsOverviewModal() {
  var modal = document.getElementById('slotsOverviewModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
}

async function openBookingModal(workshopId) {
  const modal = document.getElementById('bookingModal');
  const workshop = workshopsData.workshops.find(w => w.id === workshopId);
  if (!workshop) return;

  if (typeof closeWorkshopPreviewModal === 'function') closeWorkshopPreviewModal();
  if (typeof closeScheduleModal === 'function') closeScheduleModal();

  selectedWorkshop = workshop;
  selectedSlot = null;
  publicSlotsCache = [];

  document.getElementById('modalWorkshopInfo').innerHTML = `
    <div class="modal-workshop-title">${workshop.title}</div>
    <div class="modal-workshop-meta">${workshop.duration} • ${formatPrice(workshop.price)} ₽</div>
  `;

  const calendarEl = document.getElementById('bookingCalendar');
  if (!calendarEl) return;
  calendarEl.innerHTML = '';

  document.getElementById('bookingForm').reset();
  setParticipantsOptions(workshop.maxParticipants || workshop.capacityPerSlot || 6);
  document.getElementById('bookingForm').style.display = 'block';
  clearErrors();
  var slotErr = document.getElementById('slotError');
  if (slotErr) slotErr.style.display = 'none';
  var hintEl = document.getElementById('bookingSlotHint');
  if (hintEl) hintEl.textContent = 'Выберите время в календаре (можно кликать по пустым клеткам)';
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  showBookingStep(1);
  requestAnimationFrame(updateBookingScrollBehavior);

  const { dateFrom, dateTo } = getDateRange(7, 60);
  const slotsUrl = `${API_BASE}/api/public/slots?workshopId=${encodeURIComponent(workshopId)}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
  try {
    const res = await fetch(slotsUrl, { cache: 'no-store' });
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!contentType.includes('application/json')) {
      var t = await res.text().catch(function () { return ''; });
      throw new Error('Сервер вернул не JSON. Проверьте API_BASE. Ответ: ' + (res.status || '') + '. ' + (t.slice(0, 200)));
    }
    if (!res.ok) throw new Error('Не удалось загрузить слоты (HTTP ' + res.status + ')');
    const data = await res.json();
    publicSlotsCache = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(err);
    calendarEl.innerHTML = '<p class="form-error">' + (err.message || 'Не удалось загрузить слоты.') + '</p>';
    return;
  }

  const durationMinutes = workshop.durationMinutes != null ? workshop.durationMinutes : 120;

  function fmtDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function fmtTime(d) {
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }
  function addMinutesLocal(dateObj, minutes) {
    var d = new Date(dateObj);
    d.setMinutes(d.getMinutes() + minutes);
    return d;
  }

  var slotMin = '09:00:00';
  var slotMax = '21:00:00';
  var events = publicSlotsCache.map(function (s) {
    var start = new Date(s.startAt || s.date + 'T' + s.time + ':00');
    var end = addMinutesLocal(start, s.durationMinutes != null ? s.durationMinutes : durationMinutes);
    var free = Number(s.freeSeats);
    if (isNaN(free)) free = 0;
    var cap = s.capacityTotal != null ? s.capacityTotal : (s.capacity || 6);
    var statusUpper = String(s.status || '').toUpperCase();
    var isBusy = free <= 0 || statusUpper !== 'OPEN';
    if (statusUpper === 'HELD' || statusUpper === 'CANCELLED') {
      start = new Date(s.date + 'T' + slotMin.slice(0, 5) + ':00');
      end = new Date(s.date + 'T' + slotMax.slice(0, 5) + ':00');
    }
    return {
      id: s.id,
      title: isBusy ? 'Нет мест' : 'Свободно: ' + free + '/' + cap,
      start: start,
      end: end,
      className: isBusy ? 'slot-busy' : 'slot-free',
      extendedProps: {
        slotId: s.id,
        freeSeats: free,
        capacityTotal: cap,
        status: s.status || 'OPEN',
        date: s.date,
        time: s.time,
        startAt: s.startAt || (s.date + 'T' + s.time + ':00'),
        isVirtual: false,
      },
    };
  });

  function clearSelectionVisual(cal) {
    var tmp = cal.getEventById('__virtual_selection__');
    if (tmp) tmp.remove();
    cal.getEvents().forEach(function (ev) {
      if (ev.id === '__virtual_selection__') return;
      var p = ev.extendedProps || {};
      var free = Number(p.freeSeats);
      if (isNaN(free)) free = 0;
      var busy = free <= 0 || String(p.status || '').toUpperCase() !== 'OPEN';
      ev.setProp('classNames', busy ? ['slot-busy'] : ['slot-free']);
    });
  }

  function selectExistingEvent(eventObj) {
    var props = eventObj.extendedProps || {};
    var slotId = props.slotId;
    var date = props.date;
    var time = props.time;
    var cached = slotId ? publicSlotsCache.find(function (s) { return s.id === slotId; })
      : (date && time ? publicSlotsCache.find(function (s) { return s.date === date && s.time === time; }) : null);
    if (cached) {
      var free = Number(cached.freeSeats);
      if (isNaN(free)) free = 0;
      if (free <= 0 || String(cached.status || '').toUpperCase() !== 'OPEN') {
        var errEl = document.getElementById('slotError');
        if (errEl) {
          errEl.textContent = 'Это время недоступно. Выберите другое.';
          errEl.style.display = 'block';
        }
        return;
      }
    } else {
      var freeFromProps = Number(props.freeSeats);
      if (isNaN(freeFromProps)) freeFromProps = 0;
      var statusOpen = String(props.status || '').toUpperCase() === 'OPEN';
      if (freeFromProps <= 0 || !statusOpen) {
        var errEl2 = document.getElementById('slotError');
        if (errEl2) {
          errEl2.textContent = 'Это время недоступно. Выберите другое.';
          errEl2.style.display = 'block';
        }
        return;
      }
    }
    var freeSeats = cached ? free : (Number(props.freeSeats) || 0);
    var cal = bookingCalendar;
    if (!cal) return;
    clearSelectionVisual(cal);
    cal.getEvents().forEach(function (ev) {
      if (ev.id === eventObj.id) ev.setProp('classNames', ['slot-free', 'slot-selected']);
    });
    selectedSlot = { id: props.slotId, date: props.date, time: props.time, startAt: props.startAt, isVirtual: false, freeSeats: freeSeats };
    setParticipantsOptions(freeSeats);
    var errEl2 = document.getElementById('slotError');
    if (errEl2) errEl2.style.display = 'none';
    var hint = document.getElementById('bookingSlotHint');
    if (hint) hint.textContent = 'Выбрано: ' + (props.date || '') + ' ' + (props.time || '');
    updateBookingStep1NextState();
  }

  function selectVirtualByDate(dateObj) {
    var cal = bookingCalendar;
    if (!cal) return;
    if (!dateObj || isNaN(new Date(dateObj).getTime())) return;
    var now = new Date();
    if (dateObj < now) {
      var errEl = document.getElementById('slotError');
      if (errEl) {
        errEl.textContent = 'Нельзя выбрать время в прошлом.';
        errEl.style.display = 'block';
      }
      return;
    }
    var date = fmtDate(dateObj);
    var time = fmtTime(dateObj);

    function timeToMinutes(t) {
      var parts = (t || '').split(':');
      var h = parseInt(parts[0], 10) || 0;
      var m = parseInt(parts[1], 10) || 0;
      return h * 60 + m;
    }
    function rangesOverlap(selectedStartMin, selectedEndMin, slot) {
      if (slot.date !== date) return false;
      var slotStartMin = timeToMinutes(slot.time);
      var slotDur = Math.max(0, parseInt(slot.durationMinutes, 10) || durationMinutes);
      var slotEndMin = slotStartMin + slotDur;
      return selectedEndMin > slotStartMin && slotEndMin > selectedStartMin;
    }

    var clickMin = timeToMinutes(time);
    var selectedEndMin = clickMin + durationMinutes;
    var clickMs = new Date(dateObj).getTime();

    var existing = publicSlotsCache.find(function (s) {
      if (s.date !== date) return false;
      return timeToMinutes(s.time) === clickMin;
    });
    if (existing) {
      var free = Number(existing.freeSeats);
      if (isNaN(free)) free = 0;
      var slotStatus = String(existing.status || '').toUpperCase();
      if (free <= 0 || slotStatus !== 'OPEN') {
        var errElUnavail = document.getElementById('slotError');
        if (errElUnavail) {
          errElUnavail.textContent = 'Это время недоступно. Выберите другое.';
          errElUnavail.style.display = 'block';
        }
        return;
      }
      var ev = cal.getEventById(existing.id);
      if (ev) return selectExistingEvent(ev);
    } else {
      var overlappingSlot = publicSlotsCache.find(function (s) {
        return rangesOverlap(clickMin, selectedEndMin, s);
      });
      if (overlappingSlot) {
        var freeOver = Number(overlappingSlot.freeSeats);
        if (isNaN(freeOver)) freeOver = 0;
        var statusOver = String(overlappingSlot.status || '').toUpperCase();
        if (freeOver <= 0 || statusOver !== 'OPEN') {
          var errElOver = document.getElementById('slotError');
          if (errElOver) {
            errElOver.textContent = 'Это время недоступно. Выберите другое.';
            errElOver.style.display = 'block';
          }
          return;
        }
        var evOver = cal.getEventById(overlappingSlot.id);
        if (evOver) return selectExistingEvent(evOver);
        selectedSlot = {
          id: overlappingSlot.id,
          date: overlappingSlot.date,
          time: overlappingSlot.time,
          startAt: overlappingSlot.startAt || (overlappingSlot.date + 'T' + (overlappingSlot.time || '12:00') + ':00'),
          isVirtual: false,
          freeSeats: freeOver
        };
        setParticipantsOptions(freeOver);
        clearSelectionVisual(cal);
        cal.getEvents().forEach(function (ev) {
          if (ev.id === overlappingSlot.id) ev.setProp('classNames', ['slot-free', 'slot-selected']);
        });
        var errEl2 = document.getElementById('slotError');
        if (errEl2) errEl2.style.display = 'none';
        var hint = document.getElementById('bookingSlotHint');
        if (hint) hint.textContent = 'Выбрано: ' + overlappingSlot.date + ' ' + overlappingSlot.time;
        updateBookingStep1NextState();
        return;
      }
    }

    var selectedEndMs = addMinutesLocal(dateObj, durationMinutes).getTime();
    var allEvents = cal.getEvents();
    for (var i = 0; i < allEvents.length; i++) {
      var ev = allEvents[i];
      if (ev.id === '__virtual_selection__') continue;
      var p = ev.extendedProps || {};
      if (p.isVirtual === true) continue;
      var startMs = ev.start ? new Date(ev.start).getTime() : 0;
      var endMs = ev.end ? new Date(ev.end).getTime() : 0;
      if (selectedEndMs > startMs && endMs > clickMs) {
        var errElBusy = document.getElementById('slotError');
        if (errElBusy) {
          errElBusy.textContent = 'Это время недоступно. Выберите другое.';
          errElBusy.style.display = 'block';
        }
        return;
      }
    }

    clearSelectionVisual(cal);
    var end = addMinutesLocal(dateObj, durationMinutes);
    cal.addEvent({
      id: '__virtual_selection__',
      title: 'Выбрано',
      start: dateObj,
      end: end,
      classNames: ['slot-free', 'slot-selected'],
      editable: false,
      extendedProps: { isVirtual: true },
    });
    selectedSlot = { id: null, date: date, time: time, startAt: date + 'T' + time + ':00', isVirtual: true };
    setParticipantsOptions(selectedWorkshop.maxParticipants || selectedWorkshop.capacityPerSlot || 6);
    var errEl2 = document.getElementById('slotError');
    if (errEl2) errEl2.style.display = 'none';
    var hint = document.getElementById('bookingSlotHint');
    if (hint) hint.textContent = 'Выбрано: ' + date + ' ' + time;
    updateBookingStep1NextState();
  }

  if (bookingCalendar) {
    bookingCalendar.destroy();
    bookingCalendar = null;
  }

  var initialView = isSmallScreen() ? 'timeGridDay' : 'timeGridWeek';
  bookingCalendar = new FullCalendar.Calendar(calendarEl, {
    initialView: initialView,
    height: 'auto',
    expandRows: true,
    stickyHeaderDates: true,
    handleWindowResize: true,

    headerToolbar: { left: 'today prev,next', center: 'title', right: 'calendarOverview' },
    customButtons: {
      calendarOverview: {
        text: '📅',
        hint: 'Обзор слотов по дням месяца',
        click: openSlotsOverviewModal,
      },
    },
    locale: 'ru',
    slotMinTime: '09:00:00',
    slotMaxTime: '21:00:00',
    slotDuration: '00:30:00',
    allDaySlot: false,
    selectable: true,
    selectMirror: true,
    unselectAuto: true,
    editable: false,
    eventDisplay: 'block',
    events: events,
    eventClick: function (info) {
      info.jsEvent.preventDefault();
      info.jsEvent.stopPropagation();
      selectExistingEvent(info.event);
    },
    dateClick: function (info) {
      if (info.allDay) return;
      selectVirtualByDate(info.date);
    },
    select: function (info) {
      if (info.allDay) return;
      selectVirtualByDate(info.start);
    },
    eventClassNames: function (arg) {
      var props = arg.event.extendedProps || {};
      if (props.isVirtual === true) return ['slot-free', 'slot-selected'];
      var free = Number(props.freeSeats);
      if (isNaN(free)) free = 0;
      var busy = free <= 0 || String(props.status || '').toUpperCase() !== 'OPEN';
      return busy ? ['slot-busy'] : ['slot-free'];
    },
  });

  bookingCalendar.render();
  requestAnimationFrame(updateBookingScrollBehavior);
}

function openSuccessModal() {
  var modal = document.getElementById('successModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeSuccessModal() {
  var modal = document.getElementById('successModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function closeBookingModal() {
  var calendarEl = document.getElementById('bookingCalendar');
  if (calendarEl && typeof calendarEl._bookingCalendarClickCleanup === 'function') {
    calendarEl._bookingCalendarClickCleanup();
    calendarEl._bookingCalendarClickCleanup = null;
  }
  if (bookingCalendar) {
    bookingCalendar.destroy();
    bookingCalendar = null;
  }
  selectedSlot = null;
  selectedWorkshop = null;
  var modalEl = document.querySelector('#bookingModal .modal');
  if (modalEl) modalEl.classList.remove('modal--step2');
  const modal = document.getElementById('bookingModal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

/**
 * Открыть модалку записи с уже выбранным слотом (из расписания).
 * Пользователь сразу видит шаг 2 — форму с данными.
 */
function openBookingModalForSlot(workshop, slot) {
  if (!workshop || !slot) return;
  var modal = document.getElementById('bookingModal');
  var modalWorkshopInfo = document.getElementById('modalWorkshopInfo');
  if (!modal || !modalWorkshopInfo) return;

  if (typeof closeWorkshopPreviewModal === 'function') closeWorkshopPreviewModal();
  /* Расписание не закрываем — модалка записи открывается поверх него (z-index 10050 > 10001) */

  selectedWorkshop = workshop;
  selectedSlot = {
    id: slot.id || null,
    date: slot.date,
    time: slot.time,
    startAt: slot.startAt || (slot.date && slot.time ? slot.date + 'T' + slot.time + ':00' : null),
    freeSeats: typeof slot.freeSeats === 'number' ? slot.freeSeats : (workshop.capacityPerSlot || 6),
    isVirtual: false,
  };

  var list = (scheduleModalState && scheduleModalState.slotsWithWorkshop) || [];
  publicSlotsCache = list.filter(function (x) { return x.workshop && x.workshop.id === workshop.id; }).map(function (x) { return x.slot; });

  modalWorkshopInfo.innerHTML =
    '<div class="modal-workshop-title">' + (workshop.title || '') + '</div>' +
    '<div class="modal-workshop-meta">' + (workshop.duration || '') + ' • ' + formatPrice(workshop.price || 0) + ' ₽</div>';

  document.getElementById('bookingForm').reset();
  var maxP = selectedSlot.freeSeats > 0 ? selectedSlot.freeSeats : (workshop.maxParticipants || workshop.capacityPerSlot || 6);
  setParticipantsOptions(maxP);
  clearErrors();
  var slotErr = document.getElementById('slotError');
  if (slotErr) slotErr.style.display = 'none';

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  showBookingStep(2);
  updateBookingSelectedSummaryInline();
  requestAnimationFrame(updateBookingScrollBehavior);
}

function clearErrors() {
  document.querySelectorAll('.form-error').forEach(el => {
    el.style.display = 'none';
  });
  document.querySelectorAll('.form-input, .form-select').forEach(el => {
    el.classList.remove('error');
  });
}

function showError(fieldId, message) {
  const errorEl = document.getElementById(fieldId + 'Error');
  const inputEl = document.getElementById('booking' + fieldId.charAt(0).toUpperCase() + fieldId.slice(1));
  
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
  if (inputEl) {
    inputEl.classList.add('error');
  }
}

async function submitBookingForm(e) {
  e.preventDefault();
  clearErrors();

  let isValid = true;
  if (!selectedSlot) {
    const slotErr = document.getElementById('slotError');
    slotErr.textContent = 'Пожалуйста, выберите дату и время';
    slotErr.style.display = 'block';
    isValid = false;
  } else {
    var dur = selectedWorkshop && (selectedWorkshop.durationMinutes != null) ? selectedWorkshop.durationMinutes : 120;
    if (!isSelectedSlotAvailable(publicSlotsCache, selectedSlot, dur)) {
      const slotErr = document.getElementById('slotError');
      slotErr.textContent = 'Это время недоступно. Выберите другое.';
      slotErr.style.display = 'block';
      isValid = false;
    }
  }
  const name = document.getElementById('bookingName').value.trim();
  if (!name) {
    showError('name', 'Пожалуйста, введите ваше имя');
    isValid = false;
  }
  const phone = document.getElementById('bookingPhone').value;
  if (!validatePhone(phone)) {
    showError('phone', 'Пожалуйста, введите корректный номер телефона');
    isValid = false;
  }
  const email = document.getElementById('bookingEmail').value.trim();
  if (!validateEmail(email)) {
    showError('email', 'Пожалуйста, введите корректный email');
    isValid = false;
  }
  const messenger = document.getElementById('bookingMessenger').value;
  if (!messenger) {
    showError('messenger', 'Пожалуйста, выберите способ связи');
    isValid = false;
  }
  const consent = document.getElementById('bookingConsent').checked;
  if (!consent) {
    showError('consent', 'Необходимо согласие на обработку данных');
    isValid = false;
  }
  var participantsEl = document.getElementById('bookingParticipants');
  var participantsRaw = participantsEl ? (participantsEl.value || (participantsEl.options && participantsEl.options[participantsEl.selectedIndex] && participantsEl.options[participantsEl.selectedIndex].value)) : '';
  var participants = Math.max(1, parseInt(participantsRaw, 10) || 1);
  if (selectedSlot && typeof selectedSlot.freeSeats === 'number' && participants > selectedSlot.freeSeats) {
    showError('participants', 'Для этого времени доступно максимум ' + selectedSlot.freeSeats + ' мест');
    isValid = false;
  }
  if (!isValid) {
    if (isLowHeightScreen()) scrollToFirstInvalidField();
    return;
  }

  const comment = document.getElementById('bookingComment').value.trim() || null;
  const honeypot = (document.getElementById('bookingHoneypot') && document.getElementById('bookingHoneypot').value) || '';

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const origText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Отправка…';

  try {
    const res = await fetch(`${API_BASE}/api/public/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(selectedSlot && selectedSlot.id ? { slotId: selectedSlot.id } : {}),
        ...(selectedSlot && !selectedSlot.id ? { workshopId: selectedWorkshop.id, date: selectedSlot.date, time: selectedSlot.time } : {}),
        name,
        phone,
        email,
        messenger,
        participants: participants,
        comment,
        honeypot: honeypot || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok || res.status === 202) {
      closeBookingModal();
      var msgEl = document.getElementById('successModalText');
      if (res.status === 202 && data.message && msgEl) msgEl.textContent = data.message;
      else if (msgEl) msgEl.textContent = 'Мы свяжемся с вами в ближайшее время для подтверждения записи.';
      openSuccessModal();
      return;
    }
    if (res.status === 409) {
      const msg = data.error || 'К сожалению, мест больше нет. Выберите другое время.';
      const slotErr = document.getElementById('slotError');
      slotErr.textContent = msg;
      slotErr.style.display = 'block';
      return;
    }
    if (res.status === 400 && data.fields) {
      Object.entries(data.fields).forEach(([field, message]) => {
        const fid = field === 'slotId' ? 'slot' : field;
        showError(fid, message);
      });
      return;
    }
    if (res.status === 400) {
      showError('name', data.error || 'Ошибка заполнения формы');
      return;
    }
    showError('name', data.error || 'Произошла ошибка. Попробуйте позже.');
  } catch (err) {
    console.error(err);
    showError('name', 'Ошибка соединения. Проверьте интернет и попробуйте снова.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = origText;
  }
}

// ==========================================================================
// 7. ОТЗЫВЫ
// ==========================================================================

function renderReviews(reviews) {
  const grid = document.getElementById('reviewsGrid');
  if (!grid) return;
  
  const starSVG = `<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  
  grid.innerHTML = reviews.map(review => `
    <article class="review-card">
      <div class="review-header">
        <div class="review-avatar">${getInitials(review.name)}</div>
        <div class="review-author">
          <div class="review-name">${review.name}</div>
          <div class="review-stars">
            ${starSVG.repeat(review.rating)}
          </div>
        </div>
      </div>
      <p class="review-text">${review.text}</p>
    </article>
  `).join('');
}

// ==========================================================================
// 8. FAQ-АККОРДЕОН
// ==========================================================================

function renderFAQ(faqItems) {
  const list = document.getElementById('faqList');
  if (!list) return;
  
  list.innerHTML = faqItems.map((item, index) => `
    <div class="faq-item" data-faq-id="${item.id}">
      <button class="faq-question" aria-expanded="false" aria-controls="faq-answer-${index}">
        ${item.question}
        <svg class="faq-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <div class="faq-answer" id="faq-answer-${index}" role="region">
        <div class="faq-answer-inner">${item.answer}</div>
      </div>
    </div>
  `).join('');
  
  // Обработчики аккордеона
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const answer = item.querySelector('.faq-answer');
      const isActive = item.classList.contains('active');
      
      // Закрываем все остальные
      document.querySelectorAll('.faq-item.active').forEach(activeItem => {
        if (activeItem !== item) {
          activeItem.classList.remove('active');
          activeItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
          activeItem.querySelector('.faq-answer').style.maxHeight = '0';
        }
      });
      
      // Переключаем текущий
      if (isActive) {
        item.classList.remove('active');
        btn.setAttribute('aria-expanded', 'false');
        answer.style.maxHeight = '0';
      } else {
        item.classList.add('active');
        btn.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });
}

// ==========================================================================
// 9. КОНТАКТЫ
// ==========================================================================

/** Инициализация карты Яндекса в блоке контактов (API 2.1 — менее строгий Referer) */
function initYandexMap() {
  const container = document.getElementById('yandexMap');
  if (!container) return;

  function showFallback() {
    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--color-text-muted);">' +
      '<p style="margin-bottom: 0.5rem; font-weight: 500;">Мы на карте</p>' +
      '<p style="font-size: 0.875rem;">Донецк, ул. Розы Люксембург 75А<br>5 этаж, каб. 507</p>' +
      '<a href="https://yandex.ru/maps/?text=%D0%94%D0%BE%D0%BD%D0%B5%D1%86%D0%BA+%D1%83%D0%BB.+%D0%A0%D0%BE%D0%B7%D1%8B+%D0%9B%D1%8E%D0%BA%D1%81%D0%B5%D0%BC%D0%B1%D1%83%D1%80%D0%B3+75%D0%90" target="_blank" rel="noopener" class="btn btn-secondary" style="margin-top: 1rem;">Открыть в Яндекс.Картах</a>' +
      '</div>';
  }

  if (typeof ymaps === 'undefined') {
    showFallback();
    return;
  }

  ymaps.ready(function () {
    try {
      // API 2.1: center [широта, долгота]
      const center = [48.020265, 37.790633]; // Донецк, ул. Розы Люксембург 75А

      const map = new ymaps.Map('yandexMap', {
        center: center,
        zoom: 17,
        controls: ['zoomControl', 'typeSelector', 'fullscreenControl'],
      });

      const placemark = new ymaps.Placemark(center, {
        balloonContentHeader: 'Твори Красиво',
        balloonContentBody: 'Донецк, ул. Розы Люксембург 75А<br>5 этаж, каб. 507',
        hintContent: 'Твори Красиво',
      });
      map.geoObjects.add(placemark);
    } catch (err) {
      console.warn('Yandex Maps не загрузилась:', err);
      showFallback();
    }
  });
}

function escapeHtmlContacts(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2brEscaped(s) {
  return escapeHtmlContacts(s).replace(/\n/g, '<br>');
}

/** Старый формат data/workshops.json → блоки API */
function legacyContactsToBlocks(c) {
  if (!c || typeof c !== 'object') return { blocks: [] };
  if (Array.isArray(c.blocks) && c.blocks.length) return { blocks: c.blocks };
  var phone = c.phone || '';
  var tg = String(c.telegram || '').replace(/^@/, '');
  var city = c.city || '';
  var addr = c.address || '';
  var wh = c.workingHours || {};
  var weekdays = wh.weekdays || '';
  var weekends = wh.weekends || '';
  var addressLine = [city, addr].filter(function (x) { return x; }).join(', ');
  var hoursLine = '';
  if (weekdays || weekends) {
    hoursLine = 'Пн–Пт: ' + weekdays;
    if (weekends) hoursLine += '\nСб–Вс: ' + weekends;
  }
  var tgDisplay = c.telegram || (tg ? '@' + tg : '');
  return {
    blocks: [
      { blockType: 'FIELD', label: 'Адрес', value: addressLine, iconKey: 'map' },
      { blockType: 'FIELD', label: 'Телефон', value: phone, iconKey: 'phone' },
      { blockType: 'FIELD', label: 'Telegram', value: tgDisplay, iconKey: 'telegram' },
      { blockType: 'FIELD', label: 'Время работы', value: hoursLine, iconKey: 'clock' },
      { blockType: 'BUTTON', label: 'Написать в Telegram', href: 'https://t.me/' + tg, variant: 'primary', iconKey: 'telegram' },
      { blockType: 'BUTTON', label: 'Позвонить', href: 'tel:' + phone.replace(/\D/g, ''), variant: 'secondary', iconKey: 'phone' },
    ],
  };
}

var CONTACT_ICON_SVG = {
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/></svg>',
  max: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/><path d="M9 10h6M9 14h4"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
  message: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
};

var CONTACT_BTN_ICON_SVG = {
  phone: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  telegram: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/></svg>',
  max: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/><path d="M9 10h6M9 14h4"/></svg>',
  mail: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  instagram: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
  message: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  map: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  clock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  link: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
};

function contactIconSvgInner(key) {
  return CONTACT_ICON_SVG[key] || CONTACT_ICON_SVG.link;
}

function contactBtnIconSvg(key) {
  return CONTACT_BTN_ICON_SVG[key] || CONTACT_BTN_ICON_SVG.link;
}

function contactIconHtml(iconKey, customUrl) {
  if (String(iconKey) === 'custom' && customUrl) {
    var src = buildImageUrl(String(customUrl));
    return '<img src="' + escapeHtmlContacts(src) + '" alt="" class="contact-icon-img" width="24" height="24" loading="lazy" decoding="async" />';
  }
  if (String(iconKey) === 'custom') {
    return contactIconSvgInner('link');
  }
  return contactIconSvgInner(iconKey);
}

function contactBtnIconHtml(iconKey, customUrl) {
  if (String(iconKey) === 'custom' && customUrl) {
    var src = buildImageUrl(String(customUrl));
    return '<img src="' + escapeHtmlContacts(src) + '" alt="" width="20" height="20" loading="lazy" decoding="async" style="object-fit:contain;vertical-align:middle" />';
  }
  if (String(iconKey) === 'custom') {
    return contactBtnIconSvg('link');
  }
  return contactBtnIconSvg(iconKey);
}

function renderFieldValueHtml(value, iconKey) {
  var v = String(value || '');
  if (iconKey === 'phone') {
    var digits = v.replace(/\D/g, '');
    if (digits) {
      return '<a href="tel:' + escapeHtmlContacts(digits) + '">' + escapeHtmlContacts(v) + '</a>';
    }
  }
  if (iconKey === 'telegram') {
    var uname = v.replace(/^@/, '').trim();
    if (uname) {
      return '<a href="https://t.me/' + escapeHtmlContacts(uname) + '" target="_blank" rel="noopener">' + escapeHtmlContacts(v) + '</a>';
    }
  }
  if (iconKey === 'max') {
    var vTr = v.trim();
    if (/^https?:\/\//i.test(vTr)) {
      return '<a href="' + escapeHtmlContacts(vTr) + '" target="_blank" rel="noopener">' + escapeHtmlContacts(v) + '</a>';
    }
  }
  if (iconKey === 'mail' && v.indexOf('@') !== -1) {
    return '<a href="mailto:' + escapeHtmlContacts(v.trim()) + '">' + escapeHtmlContacts(v) + '</a>';
  }
  return nl2brEscaped(v);
}

function renderFieldBlockHtml(b) {
  return (
    '<div class="contact-item">' +
      '<div class="contact-icon">' + contactIconHtml(b.iconKey, b.customIconUrl) + '</div>' +
      '<div>' +
        '<div class="contact-label">' + escapeHtmlContacts(b.label) + '</div>' +
        '<div class="contact-value">' + renderFieldValueHtml(b.value, b.iconKey) + '</div>' +
      '</div>' +
    '</div>'
  );
}

function renderButtonBlockHtml(b) {
  var href = String(b.href || '');
  var cls = b.variant === 'secondary' ? 'btn btn-secondary' : 'btn btn-primary';
  var ext = href.indexOf('http://') === 0 || href.indexOf('https://') === 0;
  var t = ext ? ' target="_blank" rel="noopener noreferrer"' : '';
  return (
    '<a href="' + escapeHtmlContacts(href) + '" class="' + cls + '"' + t + '>' +
      contactBtnIconHtml(b.iconKey, b.customIconUrl) +
      escapeHtmlContacts(b.label) +
    '</a>'
  );
}

function renderContactBlocksHtml(blocks) {
  var out = [];
  var btnRun = [];
  function flushBtns() {
    if (!btnRun.length) return;
    out.push('<div class="contacts-buttons">' + btnRun.join('') + '</div>');
    btnRun = [];
  }
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    if (!b) continue;
    var bt = String(b.blockType || '').toUpperCase();
    if (bt === 'BUTTON') {
      btnRun.push(renderButtonBlockHtml(b));
    } else {
      flushBtns();
      out.push(renderFieldBlockHtml(b));
    }
  }
  flushBtns();
  return out.join('');
}

function renderContacts(contacts) {
  const container = document.getElementById('contactsInfo');
  if (!container) return;
  const normalized = legacyContactsToBlocks(contacts);
  const blocks = normalized.blocks || [];
  if (!blocks.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = renderContactBlocksHtml(blocks);
}

// ==========================================================================
// 10. ГАЛЕРЕЯ И LIGHTBOX
// ==========================================================================

function renderGallery(gallery) {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  if (!Array.isArray(gallery) || gallery.length === 0) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = gallery.map(function (img) {
    var raw = img.imageUrl || '';
    var src = /^(https?:|\/api\/|\/uploads\/)/.test(raw) ? buildImageUrl(raw) : raw;
    var alt = img.alt || 'Работа из галереи';
    var commentRaw = img.comment || '';
    var comment = commentRaw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/>/g, '&gt;');
    return (
      '<div class="gallery-item" data-src="' +
      src +
      '" data-comment="' + comment + '">' +
      '<img src="' +
      src +
      '" alt="' +
      alt.replace(/"/g, '&quot;') +
      '" loading="lazy">' +
      (comment ? '<div class="gallery-item-caption">' + comment + '</div>' : '') +
      '</div>'
    );
  }).join('');
}

function initGallery() {
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  const closeLightbox = document.getElementById('closeLightbox');
  const galleryGrid = document.getElementById('galleryGrid');
  if (!lightbox || !lightboxImage || !galleryGrid) return;

  const lightboxCaption = document.getElementById('lightboxCaption');
  galleryGrid.addEventListener('click', function (e) {
    const item = e.target.closest('.gallery-item');
    if (!item) return;
    const img = item.querySelector('img');
    const src = item.dataset.src || (img && img.src);
    const alt = img ? img.alt : '';
    const comment = item.dataset.comment || '';
    lightboxImage.src = src;
    lightboxImage.alt = alt;
    if (lightboxCaption) {
      lightboxCaption.textContent = comment;
      lightboxCaption.style.display = comment ? 'block' : 'none';
    }
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  });
  
  closeLightbox.addEventListener('click', closeLightboxFn);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightboxFn();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      closeLightboxFn();
    }
  });
  
  function closeLightboxFn() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ==========================================================================
// 11. ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ
// ==========================================================================

function initPrivacyModal() {
  const modal = document.getElementById('privacyModal');
  const closeBtn = document.getElementById('closePrivacyModal');
  const privacyLinks = document.querySelectorAll('#privacyLink, #privacyLinkModal');

  function isAnotherModalOpen() {
    var booking = document.getElementById('bookingModal');
    var schedule = document.getElementById('scheduleModalOverlay');
    var request = document.getElementById('requestWorkshopModal');
    var success = document.getElementById('successModal');
    return (
      (booking && booking.classList.contains('active')) ||
      (schedule && schedule.classList.contains('active')) ||
      (request && (request.classList.contains('active') || request.style.display === 'flex')) ||
      (success && success.classList.contains('active'))
    );
  }

  privacyLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!modal) return;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closePrivacyModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePrivacyModal();
    });
  }

  function closePrivacyModal() {
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = isAnotherModalOpen() ? 'hidden' : '';
  }
}

function initSlotsOverviewModal() {
  var modal = document.getElementById('slotsOverviewModal');
  var closeBtn = document.getElementById('closeSlotsOverviewBtn');
  var closeIcon = document.getElementById('closeSlotsOverviewModal');
  if (!modal) return;
  function closeFn() {
    closeSlotsOverviewModal();
  }
  if (closeBtn) closeBtn.addEventListener('click', closeFn);
  if (closeIcon) closeIcon.addEventListener('click', closeFn);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeFn();
  });
}

function initSuccessModal() {
  var modal = document.getElementById('successModal');
  var closeBtn = document.getElementById('closeSuccessModal');
  if (!modal) return;
  if (closeBtn) closeBtn.addEventListener('click', closeSuccessModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeSuccessModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeSuccessModal();
  });
}

// ==========================================================================
// 12. ЗАПУСК ПРИЛОЖЕНИЯ
// ==========================================================================

async function init() {
  try {
    // Загружаем данные
    const data = await loadData();

    // Инициализируем компоненты
    initNavigation();
    initBookingModal();
    initScheduleModal();
    initSuccessModal();
    initPrivacyModal();
    initSlotsOverviewModal();

    // Рендерим контент (галерея рендерится из API, затем вешаем lightbox)
    if (data.workshops) renderWorkshops(data.workshops);
    if (data.reviews) renderReviews(data.reviews);
    if (data.gallery) renderGallery(data.gallery);
    if (data.faq) renderFAQ(data.faq);
    if (data.contacts) renderContacts(data.contacts);
    initGallery();
    initYandexMap();
  } catch (e) {
    console.warn('init:', e);
  }

  try {
    await Promise.race([
      waitForAllImagesLoaded(),
      new Promise(function (r) {
        setTimeout(r, 3000);
      }),
    ]);
  } catch (_e) {}
  hidePageLoader();
}

// Запускаем при загрузке DOM; запасной таймер — лоадер не остаётся навсегда при любой ошибке
document.addEventListener('DOMContentLoaded', function () {
  pageLoaderFailsafeTimer = setTimeout(hidePageLoader, 3000);
  init();
});
