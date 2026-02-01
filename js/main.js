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

let workshopsData = null;
let selectedWorkshop = null;
let selectedSlot = null;
/** Слоты с API: { id, workshopId, date, time, startAt, durationMinutes, capacityTotal, freeSeats, status }[] */
let publicSlotsCache = [];
/** Экземпляр FullCalendar в модалке записи */
let bookingCalendar = null;

// ==========================================================================
// 2. УТИЛИТЫ
// ==========================================================================

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
  try {
    const apiRes = await fetch(`${API_BASE}/api/public/workshops`);
    if (apiRes.ok) {
      const list = await apiRes.json();
      workshops = (Array.isArray(list) ? list : []).map(mapWorkshopFromApi);
    }
  } catch (_) {}

  let reviews = [];
  let gallery = [];
  let faq = [];
  let contacts = {};
  try {
    const revRes = await fetch(`${API_BASE}/api/public/reviews`);
    if (revRes.ok) reviews = await revRes.json();
  } catch (_) {}
  try {
    const galRes = await fetch(`${API_BASE}/api/public/gallery`);
    if (galRes.ok) gallery = await galRes.json();
  } catch (_) {}
  try {
    const response = await fetch('data/workshops.json');
    if (response.ok) {
      const data = await response.json();
      faq = data.faq || [];
      contacts = data.contacts || {};
    }
  } catch (e) {
    console.warn('Ошибка загрузки JSON (faq/contacts):', e);
  }

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
  const grid = document.getElementById('workshopsGrid');
  if (!grid) return;
  
  grid.innerHTML = workshops.map(workshop => `
    <article class="workshop-card" data-workshop-id="${workshop.id}">
      <div class="workshop-image">
        <img src="${workshop.image}" alt="${workshop.title}" loading="lazy">
        <span class="workshop-badge">${workshop.levelText}</span>
      </div>
      <div class="workshop-content">
        <h3 class="workshop-title">${workshop.title}</h3>
        <p class="workshop-description">${workshop.description}</p>
        <div class="workshop-meta">
          <span class="workshop-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            ${workshop.duration}
          </span>
          <span class="workshop-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
            до ${workshop.maxParticipants} чел.
          </span>
        </div>
        <div class="workshop-result">
          <strong>Результат:</strong> ${workshop.result}
        </div>
        <div class="workshop-footer">
          <div class="workshop-price">
            ${formatPrice(workshop.price)} ₽
            ${workshop.tags.includes('парный') ? '<span>за двоих</span>' : ''}
          </div>
          <button class="btn btn-primary btn-sm workshop-book-btn" data-workshop-id="${workshop.id}">
            Записаться
          </button>
        </div>
      </div>
    </article>
  `).join('');
  
  // Клик по всей карточке открывает запись
  document.querySelectorAll('.workshop-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const workshopId = card.dataset.workshopId;
      if (workshopId) openBookingModal(workshopId);
    });
  });
}

// ==========================================================================
// 6. МОДАЛЬНОЕ ОКНО ЗАПИСИ И ФОРМА
// ==========================================================================

function initBookingModal() {
  const modal = document.getElementById('bookingModal');
  const closeBtn = document.getElementById('closeBookingModal');
  const closeSuccessBtn = document.getElementById('closeSuccessModal');
  const form = document.getElementById('bookingForm');
  const phoneInput = document.getElementById('bookingPhone');
  
  // Закрытие модалки
  closeBtn.addEventListener('click', closeBookingModal);
  closeSuccessBtn.addEventListener('click', closeBookingModal);
  
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

async function openBookingModal(workshopId) {
  const modal = document.getElementById('bookingModal');
  const workshop = workshopsData.workshops.find(w => w.id === workshopId);
  if (!workshop) return;

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
  document.getElementById('successState').style.display = 'none';
  clearErrors();
  var slotErr = document.getElementById('slotError');
  if (slotErr) slotErr.style.display = 'none';
  var hintEl = document.getElementById('bookingSlotHint');
  if (hintEl) hintEl.textContent = 'Выберите время в календаре (можно кликать по пустым клеткам)';
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  const { dateFrom, dateTo } = getDateRange(7, 60);
  const slotsUrl = `${API_BASE}/api/public/slots?workshopId=${encodeURIComponent(workshopId)}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
  try {
    const res = await fetch(slotsUrl);
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

  var events = publicSlotsCache.map(function (s) {
    var start = new Date(s.startAt || s.date + 'T' + s.time + ':00');
    var end = addMinutesLocal(start, s.durationMinutes != null ? s.durationMinutes : durationMinutes);
    var free = s.freeSeats != null ? s.freeSeats : 0;
    var cap = s.capacityTotal != null ? s.capacityTotal : (s.capacity || 6);
    var isBusy = free <= 0 || (s.status && s.status !== 'OPEN');
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
      var busy = (typeof p.freeSeats === 'number' ? p.freeSeats : 0) <= 0 || (p.status && p.status !== 'OPEN');
      ev.setProp('classNames', busy ? ['slot-busy'] : ['slot-free']);
    });
  }

  function selectExistingEvent(eventObj) {
    var props = eventObj.extendedProps || {};
    var freeSeats = typeof props.freeSeats === 'number' ? props.freeSeats : 0;
    var status = props.status || 'OPEN';
    if (freeSeats <= 0 || status !== 'OPEN') {
      var errEl = document.getElementById('slotError');
      if (errEl) {
        errEl.textContent = 'Это время недоступно. Выберите другое.';
        errEl.style.display = 'block';
      }
      return;
    }
    var cal = bookingCalendar;
    if (!cal) return;
    clearSelectionVisual(cal);
    cal.getEvents().forEach(function (ev) {
      if (ev.id === eventObj.id) ev.setProp('classNames', ['slot-free', 'slot-selected']);
    });
    selectedSlot = { id: props.slotId, date: props.date, time: props.time, startAt: props.startAt, isVirtual: false };
    setParticipantsOptions(props.capacityTotal || selectedWorkshop.maxParticipants || selectedWorkshop.capacityPerSlot || 6);
    var errEl2 = document.getElementById('slotError');
    if (errEl2) errEl2.style.display = 'none';
    var hint = document.getElementById('bookingSlotHint');
    if (hint) hint.textContent = 'Выбрано: ' + (props.date || '') + ' ' + (props.time || '');
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
    var existing = publicSlotsCache.find(function (s) { return s.date === date && s.time === time; });
    if (existing) {
      var ev = cal.getEventById(existing.id);
      if (ev) return selectExistingEvent(ev);
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
  }

  if (bookingCalendar) {
    bookingCalendar.destroy();
    bookingCalendar = null;
  }

  var initialView = isSmallScreen() ? 'timeGridDay' : 'timeGridWeek';
  bookingCalendar = new FullCalendar.Calendar(calendarEl, {
    initialView: initialView,
    height: '100%',
    expandRows: true,
    stickyHeaderDates: true,
    handleWindowResize: true,

    headerToolbar: { left: 'today prev,next', center: 'title', right: '' },
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
      var free = typeof props.freeSeats === 'number' ? props.freeSeats : 0;
      var st = props.status || 'OPEN';
      var busy = free <= 0 || st !== 'OPEN';
      return busy ? ['slot-busy'] : ['slot-free'];
    },
  });

  bookingCalendar.render();
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
  const modal = document.getElementById('bookingModal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
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
  if (!isValid) return;

  const participants = parseInt(document.getElementById('bookingParticipants').value, 10) || 1;
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
        messenger,
        participants,
        comment,
        honeypot: honeypot || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok || res.status === 202) {
      document.getElementById('bookingForm').style.display = 'none';
      document.getElementById('successState').style.display = 'block';
      var successEl = document.getElementById('successState');
      var msgEl = successEl && successEl.querySelector('.success-text');
      if (res.status === 202 && data.message && msgEl) msgEl.textContent = data.message;
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

function renderContacts(contacts) {
  const container = document.getElementById('contactsInfo');
  if (!container) return;
  
  container.innerHTML = `
    <div class="contact-item">
      <div class="contact-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      <div>
        <div class="contact-label">Адрес</div>
        <div class="contact-value">${contacts.city}, ${contacts.address}</div>
      </div>
    </div>
    
    <div class="contact-item">
      <div class="contact-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
      </div>
      <div>
        <div class="contact-label">Телефон</div>
        <div class="contact-value">
          <a href="tel:${contacts.phone.replace(/\D/g, '')}">${contacts.phone}</a>
        </div>
      </div>
    </div>
    
    <div class="contact-item">
      <div class="contact-icon">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>
        </svg>
      </div>
      <div>
        <div class="contact-label">Telegram</div>
        <div class="contact-value">
          <a href="https://t.me/${contacts.telegram.replace('@', '')}" target="_blank" rel="noopener">${contacts.telegram}</a>
        </div>
      </div>
    </div>
    
    <div class="contact-item">
      <div class="contact-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <div>
        <div class="contact-label">Время работы</div>
        <div class="contact-value">
          Пн–Пт: ${contacts.workingHours.weekdays}<br>
          Сб–Вс: ${contacts.workingHours.weekends}
        </div>
      </div>
    </div>
    
    <div class="contacts-buttons">
      <a href="https://t.me/${contacts.telegram.replace('@', '')}" class="btn btn-primary" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>
        </svg>
        Написать в Telegram
      </a>
      <a href="tel:${contacts.phone.replace(/\D/g, '')}" class="btn btn-secondary">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        Позвонить
      </a>
    </div>
  `;
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
    return (
      '<div class="gallery-item" data-src="' +
      src +
      '">' +
      '<img src="' +
      src +
      '" alt="' +
      alt.replace(/"/g, '&quot;') +
      '" loading="lazy">' +
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

  galleryGrid.addEventListener('click', function (e) {
    const item = e.target.closest('.gallery-item');
    if (!item) return;
    const img = item.querySelector('img');
    const src = item.dataset.src || (img && img.src);
    const alt = img ? img.alt : '';
    lightboxImage.src = src;
    lightboxImage.alt = alt;
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
  
  privacyLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });
  
  closeBtn.addEventListener('click', closePrivacyModal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closePrivacyModal();
  });
  
  function closePrivacyModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ==========================================================================
// 12. ЗАПУСК ПРИЛОЖЕНИЯ
// ==========================================================================

async function init() {
  // Загружаем данные
  const data = await loadData();
  
  // Инициализируем компоненты
  initNavigation();
  initBookingModal();
  initPrivacyModal();

  // Рендерим контент (галерея рендерится из API, затем вешаем lightbox)
  if (data.workshops) renderWorkshops(data.workshops);
  if (data.reviews) renderReviews(data.reviews);
  if (data.gallery) renderGallery(data.gallery);
  if (data.faq) renderFAQ(data.faq);
  if (data.contacts) renderContacts(data.contacts);
  initGallery();
}

// Запускаем при загрузке DOM
document.addEventListener('DOMContentLoaded', init);
