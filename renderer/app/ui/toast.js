// renderer/app/ui/toast.js
// Unified toast system (replaces alert/confirm) with support for:
// - info/error toasts
// - action toasts (primary/secondary buttons)
// - progress bar updates

let _toastEl = null;
let _timer = null;
let _progressActive = false;
let _hideTimer = null;
let _revision = 0;
let _unread = false;

function syncDock() {
  window.dispatchEvent(new CustomEvent('esus:notification', { detail: {
    available: _unread,
    visible: !!_toastEl?.classList.contains('is-show'),
    progress: _progressActive || !!_toastEl?.classList.contains('is-working'),
    type: _toastEl?.dataset.type || 'info',
  } }));
}

function setType(toast, type, progress = false) {
  toast.dataset.type = type;
  toast.classList.toggle('is-error', type === 'error');
  toast.classList.toggle('is-working', progress);
  toast.querySelector('.appToastIcon').className = 'appToastIcon fa-solid ' + (progress ? 'fa-spinner'
    : type === 'error' ? 'fa-circle-exclamation' : type === 'success' ? 'fa-circle-check'
    : type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info');
  syncDock();
}

function ensureToastEl() {
  if (_toastEl) return _toastEl;

  const el = document.createElement("div");
  el.id = "appToast";
  el.className = "appToast";
  el.style.display = "none";
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Powiadomienia');
  const icon = document.createElement('i');
  icon.className = 'appToastIcon fa-solid fa-circle-info';
  icon.setAttribute('aria-hidden', 'true');
  el.appendChild(icon);

  const body = document.createElement("div");
  body.className = "appToastBody";

  const text = document.createElement("div");
  text.className = "appToastText";
  text.setAttribute('role', 'status');
  text.setAttribute('aria-live', 'polite');
  text.setAttribute('aria-atomic', 'true');
  body.appendChild(text);

  const progress = document.createElement("div");
  progress.className = "appToastProgress";
  progress.style.display = "none";

  const progressBar = document.createElement("div");
  progressBar.className = "appToastProgressBar";
  progressBar.setAttribute('role', 'progressbar');
  progressBar.setAttribute('aria-label', 'Postęp operacji');
  progressBar.setAttribute('aria-valuemin', '0');
  progressBar.setAttribute('aria-valuemax', '100');

  const progressFill = document.createElement("div");
  progressFill.className = "appToastProgressFill";
  progressFill.style.width = "0%";
  progressBar.appendChild(progressFill);

  const progressPct = document.createElement("div");
  progressPct.className = "appToastProgressPct";
  progressPct.textContent = "0%";

  progress.appendChild(progressBar);
  progress.appendChild(progressPct);
  body.appendChild(progress);

  const actions = document.createElement("div");
  actions.className = "appToastActions";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "appToastClose";
  closeBtn.setAttribute("aria-label", "Zamknij");
  closeBtn.textContent = "×";

  el.appendChild(body);
  el.appendChild(actions);
  el.appendChild(closeBtn);

  document.body.appendChild(el);
  el.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      hideToast({ manual: true });
      document.getElementById('erpNotifications')?.focus();
    }
  });
  closeBtn.addEventListener("click", () => hideToast({ manual: true }));

  _toastEl = el;
  return el;
}

function clearTimer() {
  if (_timer) {
    clearTimeout(_timer);
    _timer = null;
  }
}

function restartAnim(toast, replace = true) {
  if (replace) { _revision++; _unread = toast.dataset.type !== 'info'; }
  clearTimeout(_hideTimer);
  toast.classList.remove('is-hiding');
  toast.classList.remove("is-show");
  void toast.offsetWidth;
  toast.classList.add("is-show");
  syncDock();
}

export function showToast(message, { type = "info", ms = 3000 } = {}) {
  const toast = ensureToastEl();
  const textEl = toast.querySelector(".appToastText");
  const actionsEl = toast.querySelector(".appToastActions");
  const progEl = toast.querySelector(".appToastProgress");

  _progressActive = false;
  if (progEl) progEl.style.display = "none";
  if (actionsEl) actionsEl.textContent = "";

  if (textEl) textEl.textContent = String(message ?? "");

  setType(toast, type);
  toast.style.display = "flex";
  restartAnim(toast);

  clearTimer();
  // Informational messages share one duration, including older callers that
  // supplied their own delay. Action prompts and progress retain their lifecycle.
  const duration = type === 'info' ? 5000 : ms;
  if (duration && duration > 0) {
    _timer = setTimeout(hideToast, duration);
  }
}

export function showToastAction(
  message,
  {
    type = "info",
    ms = 6000,
    actionLabel = null,
    onAction = null,
    secondaryLabel = null,
    onSecondary = null,
    keepOpenOnAction = false,
  } = {}
) {
  const toast = ensureToastEl();
  const textEl = toast.querySelector(".appToastText");
  const actionsEl = toast.querySelector(".appToastActions");
  const progEl = toast.querySelector(".appToastProgress");

  _progressActive = false;
  if (progEl) progEl.style.display = "none";

  if (textEl) {
    textEl.textContent = String(message ?? "");
  }

  if (actionsEl) {
    actionsEl.textContent = "";

    if (actionLabel && typeof onAction === "function") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "appToastBtn appToastBtnPrimary";
      btn.textContent = actionLabel;
      btn.addEventListener("click", async () => {
        const revision = _revision;
        clearTimer();
        btn.disabled = true;
        actionsEl.querySelectorAll('button').forEach(button => { button.disabled = true; });
        setType(toast, type, true);
        try {
          await onAction();
        } catch (error) {
          if (revision === _revision) showToast(error?.message || 'Nie udało się wykonać operacji.', { type: 'error', ms: 6000 });
        } finally {
          // A callback may have displayed a new result/progress notification.
          if (revision === _revision) {
            setType(toast, type);
            actionsEl.querySelectorAll('button').forEach(button => { button.disabled = false; });
            if (!keepOpenOnAction) hideToast();
          }
        }
      });
      actionsEl.appendChild(btn);
    }

    if (secondaryLabel && typeof onSecondary === "function") {
      const btn2 = document.createElement("button");
      btn2.type = "button";
      btn2.className = "appToastBtn";
      btn2.textContent = secondaryLabel;
      btn2.addEventListener("click", async () => {
        const revision = _revision;
        clearTimer();
        try {
          await onSecondary();
        } catch (error) {
          if (revision === _revision) showToast(error?.message || 'Nie udało się wykonać operacji.', { type: 'error', ms: 6000 });
        } finally {
          if (revision === _revision) hideToast();
        }
      });
      actionsEl.appendChild(btn2);
    }
  }

  setType(toast, type);
  toast.style.display = "flex";
  restartAnim(toast);

  clearTimer();
  if (ms && ms > 0) {
    _timer = setTimeout(hideToast, ms);
  }
}

export function showToastProgress(title, { type = "info" } = {}) {
  const toast = ensureToastEl();
  const textEl = toast.querySelector(".appToastText");
  const actionsEl = toast.querySelector(".appToastActions");
  const progEl = toast.querySelector(".appToastProgress");
  const fill = toast.querySelector(".appToastProgressFill");
  const pct = toast.querySelector(".appToastProgressPct");

  if (actionsEl) actionsEl.textContent = "";
  if (textEl) textEl.textContent = String(title ?? "");

  if (progEl) progEl.style.display = "flex";
  if (fill) fill.style.width = "0%";
  if (pct) pct.textContent = "0%";
  toast.querySelector('.appToastProgressBar').setAttribute('aria-valuenow', '0');

  _progressActive = true;
  setType(toast, type, true);
  toast.style.display = "flex";
  restartAnim(toast);

  clearTimer();
}

export function updateToastProgress(percent) {
  if (!_progressActive) return;
  const toast = ensureToastEl();
  const fill = toast.querySelector(".appToastProgressFill");
  const pct = toast.querySelector(".appToastProgressPct");
  const value = Number(percent ?? 0);
  const p = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;

  if (fill) fill.style.width = `${p}%`;
  if (pct) pct.textContent = `${p}%`;
  toast.querySelector('.appToastProgressBar').setAttribute('aria-valuenow', String(p));
}

export function endToastProgress() {
  _progressActive = false;
  if (_toastEl) setType(_toastEl, _toastEl.dataset.type);
  syncDock();
}

export function hideToast({ manual = false } = {}) {
  const toast = _toastEl;
  if (!toast) return;
  if (manual) _unread = false;

  clearTimer();
  clearTimeout(_hideTimer);
  toast.classList.remove('is-show');
  toast.classList.add('is-hiding');
  // Dismissed confirmations must not become actionable again when reopened.
  toast.querySelector('.appToastActions')?.replaceChildren();
  syncDock();
  _hideTimer = setTimeout(() => {
    toast.style.display = 'none';
    toast.classList.remove('is-hiding');
  }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
}

export function toggleToast() {
  if (!_toastEl) {
    showToast('Brak nowych powiadomień.', { ms: 3000 });
  } else if (_toastEl.classList.contains('is-show')) {
    hideToast({ manual: true });
  } else {
    clearTimer();
    _toastEl.style.display = 'flex';
    restartAnim(_toastEl, false);
    if (_toastEl.dataset.type === 'info' && !_progressActive &&
        !_toastEl.classList.contains('is-working') &&
        !_toastEl.querySelector('.appToastActions button')) {
      _timer = setTimeout(hideToast, 5000);
    }
  }
}
