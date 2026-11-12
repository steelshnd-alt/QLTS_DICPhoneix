/* Lõi dùng chung cho index.html và labels.html: gọi API, đăng nhập, tiện ích, biểu tượng. */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG || {};

  /* ---------- Lưu cục bộ (có thể bị chặn, nên luôn bọc try/catch) ---------- */
  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* bỏ qua */ } }
  };

  /* ---------- Phiên đăng nhập ---------- */
  var Auth = {
    token: ls.get('qlts_token') || '',
    user: (function () { try { return JSON.parse(ls.get('qlts_user') || 'null'); } catch (e) { return null; } })(),
    set: function (token, user) { this.token = token; this.user = user; ls.set('qlts_token', token); ls.set('qlts_user', JSON.stringify(user)); },
    clear: function () { this.token = ''; this.user = null; ls.del('qlts_token'); ls.del('qlts_user'); },
    is: function () { return !!(this.token && this.user); },
    role: function () { return this.user ? this.user.vaiTro : ''; },
    can: function (roles) { return this.is() && roles.indexOf(this.user.vaiTro) >= 0; }
  };

  /* ---------- Gọi API (Apps Script /exec) ---------- */
  function ApiError(message, code) { var e = new Error(message); e.code = code || 'ERR'; return e; }
  function api(action, data, opts) {
    opts = opts || {};
    if (!CFG.API_URL || /DAN_LINK|XXXX/.test(CFG.API_URL)) {
      return Promise.reject(ApiError('Chưa cấu hình link API. Hãy dán link /exec vào file config.js.', 'CFG'));
    }
    var body = JSON.stringify(Object.assign({ action: action, token: Auth.token || undefined }, data || {}));
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, opts.timeout || 60000) : null;
    return fetch(CFG.API_URL, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', signal: ctl ? ctl.signal : undefined })
      .then(function (res) { return res.json(); })
      .catch(function () { throw ApiError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', 'NET'); })
      .then(function (json) {
        if (timer) clearTimeout(timer);
        if (!json || json.ok !== true) {
          if (json && json.code === 'AUTH') { var was = Auth.is(); Auth.clear(); if (was && window.QL && window.QL.onAuthLost) window.QL.onAuthLost(); }
          throw ApiError((json && json.error) || 'Có lỗi xảy ra.', json && json.code);
        }
        return json.data;
      }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  /* ---------- Tiện ích chuỗi, ngày, tiền ---------- */
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtDate(s) { if (!s) return ''; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? m[3] + '/' + m[2] + '/' + m[1] : s; }
  function fmtDateTime(s) { if (!s) return ''; var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s); return m ? m[4] + ':' + m[5] + ', ' + m[3] + '/' + m[2] + '/' + m[1] : fmtDate(s); }
  function ago(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s || ''); if (!m) return fmtDate(s);
    var diff = (Date.now() - new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime()) / 60000;
    if (diff < 1) return 'vừa xong'; if (diff < 60) return Math.round(diff) + ' phút trước';
    if (diff < 1440) return Math.round(diff / 60) + ' giờ trước'; if (diff < 43200) return Math.round(diff / 1440) + ' ngày trước';
    return fmtDate(s);
  }
  function dueText(n) { if (n === null || n === undefined) return ''; return n < 0 ? 'quá ' + (-n) + ' ngày' : (n === 0 ? 'hôm nay' : 'còn ' + n + ' ngày'); }
  function money(n) { return new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + ' đ'; }
  function moneyShort(n) { n = n || 0; if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.0', '') + ' tỷ'; if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + ' tr'; if (n >= 1e3) return Math.round(n / 1e3) + ' k'; return String(n); }
  function norm(s) { return String(s || '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
  function thumb(url, w) { return url ? url.replace(/sz=w\d+/, 'sz=w' + w) : ''; }
  function toneOfStatus(s) { return { 'Hoạt động tốt': 'ok', 'Cần theo dõi': 'warn', 'Đang sửa chữa': 'info', 'Hỏng': 'bad', 'Ngừng sử dụng': '' }[s] || ''; }
  function toneOfPlan(s) { return { 'Quá hạn': 'bad', 'Sắp đến hạn': 'warn', 'Còn hạn': 'ok' }[s] || ''; }
  var PALETTE = ['#0F6E78', '#2B6CB0', '#6B4FA0', '#B4541A', '#2E7D4F', '#9B3D5A', '#4F6D7A', '#8A6D00'];
  function hue(key) { var h = 0, s = String(key); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return PALETTE[h % PALETTE.length]; }
  function deviceId() { var d = ls.get('qlts_dev'); if (!d) { d = Math.random().toString(36).slice(2, 12); ls.set('qlts_dev', d); } return d; }

  /* ---------- Biểu tượng (nét đơn, 24px) ---------- */
  var P = {
    home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v3M14 20h3M20 20v1',
    box: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8',
    tasks: 'M9 4h6a1 1 0 011 1v1H8V5a1 1 0 011-1zM8 6H6a1 1 0 00-1 1v13a1 1 0 001 1h12a1 1 0 001-1V7a1 1 0 00-1-1h-2M9 14l2 2 4-4',
    alert: 'M12 3l10 18H2L12 3zM12 10v5M12 18v.01',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zM12 17a4 4 0 100-8 4 4 0 000 8z',
    pin: 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    plus: 'M12 5v14M5 12h14',
    wrench: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
    search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
    user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
    logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
    share: 'M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v14',
    check: 'M20 6L9 17l-5-5', x: 'M18 6L6 18M6 6l12 12', chevron: 'M9 18l6-6-6-6', back: 'M15 18l-6-6 6-6',
    clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    building: 'M4 21V5a1 1 0 011-1h9a1 1 0 011 1v16M15 9h4a1 1 0 011 1v11M3 21h18M8 8h3M8 12h3M8 16h3',
    lock: 'M6 11V8a6 6 0 1112 0v3M5 11h14v10H5z',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z',
    calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
    phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z',
    backspace: 'M21 5H9l-6 7 6 7h12a1 1 0 001-1V6a1 1 0 00-1-1zM17 9l-6 6M11 9l6 6',
    printer: 'M6 9V3h12v6M6 18H4a1 1 0 01-1-1v-6a2 2 0 012-2h14a2 2 0 012 2v6a1 1 0 01-1 1h-2M7 14h10v7H7z',
    info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-5M12 8v.01',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    money: 'M3 6h18v12H3zM12 15a3 3 0 100-6 3 3 0 000 6zM6 9v.01M18 15v.01',
    moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
    refresh: 'M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5',
    image: 'M3 5h18v14H3zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 16l-5-5L5 19'
  };
  function icon(name, cls) { return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (P[name] || P.info) + '"/></svg>'; }

  /* ---------- Thông báo nhỏ ---------- */
  function toast(msg, type) {
    var root = document.getElementById('toast-root'); if (!root) return;
    var el = document.createElement('div'); el.className = 'toast' + (type === 'err' ? ' err' : ''); el.setAttribute('role', type === 'err' ? 'alert' : 'status');
    el.innerHTML = icon(type === 'err' ? 'alert' : 'check', 'sm') + '<span>' + esc(msg) + '</span>';
    root.appendChild(el); setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(function () { el.remove(); }, 320); }, type === 'err' ? 5200 : 2800);
  }

  /* ---------- Ảnh và vị trí ---------- */
  /** Thu nhỏ ảnh về tối đa `max` px, JPEG, để mỗi ảnh chỉ khoảng 150–300 KB. */
  function compressImage(file, max, q) {
    max = max || 1280; q = q || 0.78;
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('Không đọc được ảnh.')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Tệp không phải ảnh hợp lệ.')); };
        img.onload = function () {
          var s = Math.min(1, max / Math.max(img.width, img.height)), w = Math.round(img.width * s), h = Math.round(img.height * s);
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', q));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function getGPS() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) return reject(new Error('Thiết bị không hỗ trợ định vị.'));
      navigator.geolocation.getCurrentPosition(
        function (p) { resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) }); },
        function (e) { reject(new Error(e.code === 1 ? 'Bạn chưa cho phép truy cập vị trí.' : 'Chưa lấy được vị trí, hãy thử lại ở nơi thoáng hơn.')); },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
    });
  }

  /* ---------- Giao diện sáng/tối ---------- */
  var Theme = {
    get: function () { return ls.get('qlts_theme') || 'auto'; },
    apply: function () { var t = this.get(); if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); },
    set: function (t) { ls.set('qlts_theme', t); this.apply(); }
  };
  Theme.apply();

  window.QL = { CFG: CFG, ls: ls, Auth: Auth, api: api, esc: esc, fmtDate: fmtDate, fmtDateTime: fmtDateTime, ago: ago, dueText: dueText, money: money, moneyShort: moneyShort, norm: norm, debounce: debounce, thumb: thumb, toneOfStatus: toneOfStatus, toneOfPlan: toneOfPlan, hue: hue, deviceId: deviceId, icon: icon, toast: toast, compressImage: compressImage, getGPS: getGPS, Theme: Theme };
})();
