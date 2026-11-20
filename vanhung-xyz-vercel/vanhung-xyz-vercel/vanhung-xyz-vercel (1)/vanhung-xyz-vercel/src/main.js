import './styles.css';
import { BANKS, COUPONS, INITIAL_PRODUCTS, CATEGORIES, API_SNIPPETS } from './data.js';

(function () {
      'use strict';

      /* 1. HELPERS */
      function lsGet(k, fb) { try { var v = localStorage.getItem(k); return v !== null ? v : fb; } catch (e) { return fb; } }
      function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
      function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }
      function normalizeVi(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim(); }

      var toastTimer = null;
      function toast(msg, isError) {
        var el = document.getElementById('toast');
        el.textContent = msg;
        el.style.background = isError ? 'linear-gradient(135deg,#F43F5E,#FB7185)' : 'linear-gradient(135deg,#10B981,#34D399)';
        el.style.color = isError ? '#FFFFFF' : '#050811';
        el.classList.remove('hidden');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.classList.add('hidden'); }, 3000);
      }

      function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { toast('Đã sao chép vào bộ nhớ tạm!'); }).catch(function () { fallbackCopy(text); });
        } else { fallbackCopy(text); }
      }
      function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); toast('Đã sao chép vào bộ nhớ tạm!'); } catch (e) {}
        document.body.removeChild(ta);
      }
      function downloadTxt(name, content) {
        var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }

      /* 2. CATALOG, BANKS, COUPONS & AUTH STATE */
      

      

      var products = INITIAL_PRODUCTS.map(function (i) { return Object.assign({}, i); });

      var categories = CATEGORIES;

      var apiSnippets = API_SNIPPETS;

      /* Accounts DB in localStorage */
      var usersDb = [];
      try { usersDb = JSON.parse(lsGet('vh_users_db', '[]')) || []; } catch (e) { usersDb = []; }
      if (!usersDb.length) {
        usersDb.push({
          id: 10482,
          name: 'Khách Demo',
          email: 'demo@vanhung.xyz',
          pass: '123456',
          wallet: 1250000,
          totalDeposited: 1250000,
          orders: [],
          ledger: [
            { time: new Date().toLocaleString('vi-VN'), type: 'DEPOSIT', amount: 1250000, balanceAfter: 1250000, note: 'Nạp khởi tạo tài khoản demo · VH 10482' }
          ]
        });
        lsSet('vh_users_db', JSON.stringify(usersDb));
      }

      var currentUserId = parseInt(lsGet('vh_current_uid', '0'), 10) || 0;
      var viewMode = 'table';
      var activeCategory = 'ALL';
      var activeApiLang = 'curl';
      var selectedProduct = null;
      var appliedCoupon = null;
      var activeOrderDetail = null;
      var isPurchasingLock = false; // Client-side transaction mutex

      function getCurrentUser() {
        return usersDb.find(function (u) { return u.id === currentUserId; }) || null;
      }
      function saveUsersDb() {
        lsSet('vh_users_db', JSON.stringify(usersDb));
        lsSet('vh_current_uid', String(currentUserId || 0));
      }
      function getRankInfo(u) {
        var dep = u ? u.totalDeposited : 0;
        if (dep >= 50000000) return { code: 'AGENCY', rate: 0.20, label: '20%' };
        if (dep >= 10000000) return { code: 'VIP', rate: 0.12, label: '12%' };
        if (dep >= 2000000) return { code: 'CTV', rate: 0.05, label: '5%' };
        return { code: 'LV1', rate: 0, label: '0%' };
      }

      /* 3. AUTH MODAL (ĐĂNG NHẬP / ĐĂNG KÝ) */
      var authModal = document.getElementById('auth-modal');
      var loginForm = document.getElementById('login-form');
      var registerForm = document.getElementById('register-form');

      function openAuthModal(mode) {
        var isReg = mode === 'register';
        document.getElementById('auth-modal-title').textContent = isReg ? 'Tạo tài khoản khách hàng' : 'Đăng nhập VANHUNG.XYZ';
        loginForm.classList.toggle('hidden', isReg);
        registerForm.classList.toggle('hidden', !isReg);

        var tLog = document.getElementById('auth-tab-login');
        var tReg = document.getElementById('auth-tab-register');
        tLog.style.background = !isReg ? 'var(--accent-emerald)' : 'transparent';
        tLog.style.color = !isReg ? '#050811' : 'var(--text-muted)';
        tReg.style.background = isReg ? 'var(--accent-emerald)' : 'transparent';
        tReg.style.color = isReg ? '#050811' : 'var(--text-muted)';

        authModal.classList.remove('hidden');
      }
      function closeAuthModal() { authModal.classList.add('hidden'); }

      document.getElementById('open-login-btn').addEventListener('click', function () { openAuthModal('login'); });
      document.getElementById('open-register-btn').addEventListener('click', function () { openAuthModal('register'); });
      document.getElementById('auth-tab-login').addEventListener('click', function () { openAuthModal('login'); });
      document.getElementById('auth-tab-register').addEventListener('click', function () { openAuthModal('register'); });
      document.getElementById('close-auth-modal-btn').addEventListener('click', closeAuthModal);
      document.getElementById('guest-browse-btn').addEventListener('click', closeAuthModal);
      authModal.addEventListener('click', function (e) { if (e.target === authModal) closeAuthModal(); });

      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var idf = document.getElementById('login-email').value.trim().toLowerCase();
        var pass = document.getElementById('login-password').value;
        var found = usersDb.find(function (u) {
          return (u.email.toLowerCase() === idf || u.name.toLowerCase() === idf) && u.pass === pass;
        });
        if (!found) {
          toast('Sai email/tên đăng nhập hoặc mật khẩu!', true);
          return;
        }
        currentUserId = found.id;
        saveUsersDb();
        syncAuthUI();
        closeAuthModal();
        toast('Xin chào ' + found.name + ' (Mã nạp: VH ' + found.id + ')!');
      });

      registerForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = document.getElementById('reg-name').value.trim();
        var email = document.getElementById('reg-email').value.trim().toLowerCase();
        var pass = document.getElementById('reg-password').value;
        if (!name || !email || pass.length < 6) {
          toast('Vui lòng nhập đầy đủ thông tin (mật khẩu từ 6 ký tự).', true);
          return;
        }
        if (usersDb.some(function (u) { return u.email.toLowerCase() === email; })) {
          toast('Email này đã được đăng ký. Vui lòng đăng nhập!', true);
          openAuthModal('login');
          return;
        }
        var newId = Math.floor(10000 + Math.random() * 89999);
        var newUser = {
          id: newId,
          name: name,
          email: email,
          pass: pass,
          wallet: 200000, // Tặng 200K trải nghiệm demo
          totalDeposited: 0,
          orders: [],
          ledger: [
            { time: new Date().toLocaleString('vi-VN'), type: 'DEPOSIT', amount: 200000, balanceAfter: 200000, note: 'Quà chào mừng thành viên mới · VH ' + newId }
          ]
        };
        usersDb.push(newUser);
        currentUserId = newId;
        saveUsersDb();
        syncAuthUI();
        closeAuthModal();
        toast('Đăng ký thành công! Mã nạp VietQR của bạn là VH ' + newId);
      });

      document.getElementById('logout-btn').addEventListener('click', function () {
        currentUserId = 0;
        saveUsersDb();
        syncAuthUI();
        toast('Đã đăng xuất tài khoản.');
      });

      function syncAuthUI() {
        var u = getCurrentUser();
        var guestBar = document.getElementById('auth-guest-bar');
        var userBar = document.getElementById('auth-user-bar');
        var mobBal = document.getElementById('mobile-wallet-balance');

        if (u) {
          guestBar.classList.add('hidden');
          userBar.classList.remove('hidden');
          userBar.classList.add('flex');
          mobBal.classList.remove('hidden');
          document.getElementById('wallet-balance').textContent = fmt(u.wallet);
          mobBal.textContent = fmt(u.wallet);
          document.getElementById('header-username').textContent = u.name;
          document.getElementById('header-userid').textContent = 'ID: VH ' + u.id;
          document.getElementById('user-rank-pill').textContent = getRankInfo(u).code;
          document.getElementById('total-deposited-label').textContent = fmt(u.totalDeposited);

          var badge = document.getElementById('nav-order-badge');
          if (u.orders.length > 0) { badge.textContent = u.orders.length; badge.classList.remove('hidden'); }
          else { badge.classList.add('hidden'); }
        } else {
          guestBar.classList.remove('hidden');
          userBar.classList.add('hidden');
          userBar.classList.remove('flex');
          mobBal.classList.add('hidden');
          document.getElementById('nav-order-badge').classList.add('hidden');
          document.getElementById('total-deposited-label').textContent = '0đ';
        }
        updateVietQR();
        renderOrdersAndLedger();
      }

      /* 4. THEME & NAVIGATION */
      function syncThemeIcons() {
        var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        document.getElementById('theme-icon-sun').classList.toggle('hidden', !isDark);
        document.getElementById('theme-icon-moon').classList.toggle('hidden', isDark);
      }
      document.getElementById('theme-toggle-btn').addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        lsSet('vh_theme', next);
        syncThemeIcons();
      });
      syncThemeIcons();

      function switchTab(tab) {
        document.querySelectorAll('.tab-panel').forEach(function (el) { el.classList.add('hidden'); });
        var target = document.getElementById('tab-' + tab);
        if (target) target.classList.remove('hidden');
        document.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-tab') === tab); });
        if (tab === 'deposit') updateVietQR();
        if (tab === 'orders') renderOrdersAndLedger();
        if (tab === 'admin') renderAdmin();
      }
      document.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); }); });
      document.getElementById('brand-home-btn').addEventListener('click', function () { switchTab('store'); });
      document.getElementById('nav-deposit-cta').addEventListener('click', function () { switchTab('deposit'); });
      document.querySelectorAll('[data-go-deposit]').forEach(function (b) { b.addEventListener('click', function () { switchTab('deposit'); }); });

      /* 5. STOREFRONT */
      function renderCategories() {
        document.getElementById('category-pills').innerHTML = categories.map(function (c) {
          var count = c.key === 'ALL' ? products.length : products.filter(function (p) { return p.cat === c.key; }).length;
          var active = activeCategory === c.key;
          var st = active
            ? 'background:rgba(16,185,129,0.18);border-color:var(--accent-emerald);color:var(--accent-emerald);'
            : 'background:var(--bg-secondary);border-color:var(--border-subtle);color:var(--text-muted);';
          return '<button type="button" data-cat-key="' + c.key + '" class="btn-cyber px-3.5 py-1.5 rounded-xl text-xs font-semibold border" style="' + st + '">' + c.label + ' <span class="opacity-65 ml-1">(' + count + ')</span></button>';
        }).join('');
      }
      document.getElementById('category-pills').addEventListener('click', function (e) {
        var b = e.target.closest('[data-cat-key]');
        if (!b) return;
        activeCategory = b.getAttribute('data-cat-key');
        renderCategories(); renderProducts();
      });

      function setViewMode(m) {
        viewMode = m;
        var t = document.getElementById('btn-view-table'), g = document.getElementById('btn-view-grid');
        t.style.background = m === 'table' ? 'var(--accent-emerald)' : 'transparent';
        t.style.color = m === 'table' ? '#050811' : 'var(--text-muted)';
        g.style.background = m === 'grid' ? 'var(--accent-emerald)' : 'transparent';
        g.style.color = m === 'grid' ? '#050811' : 'var(--text-muted)';
        renderProducts();
      }
      document.getElementById('btn-view-table').addEventListener('click', function () { setViewMode('table'); });
      document.getElementById('btn-view-grid').addEventListener('click', function () { setViewMode('grid'); });
      document.getElementById('search-input').addEventListener('input', renderProducts);

      function renderProducts() {
        var q = normalizeVi(document.getElementById('search-input').value);
        var filtered = products.filter(function (p) {
          if (activeCategory !== 'ALL' && p.cat !== activeCategory) return false;
          if (!q) return true;
          return normalizeVi(p.name + ' ' + p.cat + ' ' + p.format + ' ' + p.country).indexOf(q) !== -1;
        });
        document.getElementById('hero-stock-count').textContent = products.reduce(function (s, p) { return s + p.stock; }, 0).toLocaleString('vi-VN');

        var container = document.getElementById('products-container');
        if (!filtered.length) {
          container.innerHTML = '<div class="glass-panel rounded-2xl p-10 text-center text-sm" style="color:var(--text-muted);">Không tìm thấy sản phẩm phù hợp.</div>';
          return;
        }
        if (viewMode === 'table') {
          container.innerHTML = '<div class="glass-panel rounded-2xl overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-left text-sm border-collapse">' +
            '<thead class="text-[11px] uppercase font-mono-code" style="background:var(--bg-secondary);color:var(--text-muted);border-bottom:1px solid var(--border-subtle);">' +
            '<tr><th class="p-4">Sản phẩm / Tài nguyên</th><th class="p-4 text-center">QG</th><th class="p-4 text-center">Bảo hành</th><th class="p-4 text-center">Tồn kho</th><th class="p-4 text-right">Đơn giá</th><th class="p-4 text-right">Hành động</th></tr></thead><tbody>' +
            filtered.map(function (p) {
              return '<tr class="mmo-row" style="border-bottom:1px solid var(--border-subtle);">' +
                '<td class="p-4"><div class="flex items-center gap-2 flex-wrap">' + (p.badge ? '<span class="px-1.5 py-0.5 text-[10px] font-mono-code font-bold rounded" style="background:rgba(16,185,129,0.16);color:var(--accent-emerald);">' + p.badge + '</span>' : '') +
                '<span class="font-semibold">' + p.name + '</span></div><div class="text-[11px] font-mono-code mt-0.5" style="color:var(--text-muted);">Format: ' + p.format + '</div></td>' +
                '<td class="p-4 text-center font-mono-code text-xs">' + p.country + '</td>' +
                '<td class="p-4 text-center"><span class="px-2 py-0.5 rounded-md text-xs" style="background:rgba(6,182,212,0.14);color:var(--accent-cyan);">' + p.warranty + '</span></td>' +
                '<td class="p-4 text-center font-mono-code font-bold" style="color:' + (p.stock > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)') + ';">' + p.stock.toLocaleString('vi-VN') + '</td>' +
                '<td class="p-4 text-right font-mono-code font-bold">' + fmt(p.price) + '</td>' +
                '<td class="p-4 text-right"><button type="button" data-buy-id="' + p.id + '" ' + (p.stock === 0 ? 'disabled' : '') + ' class="btn-cyber px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs border-0">Mua ngay</button></td></tr>';
            }).join('') + '</tbody></table></div></div>';
        } else {
          container.innerHTML = '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">' + filtered.map(function (p) {
            return '<article class="glass-panel rounded-2xl p-5 flex flex-col justify-between"><div>' +
              '<div class="flex items-center justify-between"><span class="text-[11px] font-mono-code px-2 py-0.5 rounded surface-box" style="color:var(--accent-cyan);">' + p.cat + ' · ' + p.country + '</span>' +
              (p.badge ? '<span class="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded" style="background:rgba(16,185,129,0.16);color:var(--accent-emerald);">' + p.badge + '</span>' : '') + '</div>' +
              '<h3 class="font-bold text-base mt-3 mb-0">' + p.name + '</h3><div class="text-xs font-mono-code mt-1.5" style="color:var(--text-muted);">Format: ' + p.format + '</div></div>' +
              '<div class="mt-5 pt-4 flex items-center justify-between" style="border-top:1px solid var(--border-subtle);"><div><div class="text-lg font-mono-code font-extrabold" style="color:var(--accent-emerald);">' + fmt(p.price) + '</div>' +
              '<div class="text-[11px]" style="color:var(--text-muted);">Kho: <strong>' + p.stock + '</strong> · BH: ' + p.warranty + '</div></div>' +
              '<button type="button" data-buy-id="' + p.id + '" ' + (p.stock === 0 ? 'disabled' : '') + ' class="btn-cyber px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs border-0">Mua ngay</button></div></article>';
          }).join('') + '</div>';
        }
      }

      document.getElementById('products-container').addEventListener('click', function (e) {
        var b = e.target.closest('[data-buy-id]');
        if (!b) return;
        if (!getCurrentUser()) {
          toast('Vui lòng đăng nhập hoặc đăng ký để mua hàng!', true);
          openAuthModal('login');
          return;
        }
        openBuyModal(parseInt(b.getAttribute('data-buy-id'), 10));
      });

      document.querySelectorAll('[data-copy-promo]').forEach(function (b) {
        b.addEventListener('click', function () { copyText(b.getAttribute('data-copy-promo')); });
      });

      /* 6. QUICK BUY MODAL (3.3) */
      var buyModal = document.getElementById('buy-modal');

      function openBuyModal(id) {
        selectedProduct = products.find(function (p) { return p.id === id; });
        if (!selectedProduct) return;
        appliedCoupon = null;
        document.getElementById('promo-input').value = '';
        document.getElementById('promo-status-msg').textContent = '';
        document.getElementById('buy-qty').value = '1';
        document.getElementById('buy-qty').max = String(selectedProduct.stock);
        document.getElementById('buy-stock-cap').textContent = 'Tối đa theo tồn kho: ' + selectedProduct.stock.toLocaleString('vi-VN');
        document.getElementById('buy-modal-cat').textContent = selectedProduct.cat + ' · BH ' + selectedProduct.warranty;
        document.getElementById('buy-modal-title').textContent = selectedProduct.name;
        document.getElementById('modal-unit-price').textContent = fmt(selectedProduct.price);
        buyModal.classList.remove('hidden');
        updateBuySummary();
      }
      function closeBuyModal() { buyModal.classList.add('hidden'); }

      function computeTotals() {
        var u = getCurrentUser();
        var qty = Math.max(1, Math.min(selectedProduct.stock, parseInt(document.getElementById('buy-qty').value, 10) || 1));
        document.getElementById('buy-qty').value = String(qty);
        var raw = qty * selectedProduct.price;
        var rankDisc = Math.round(raw * getRankInfo(u).rate);
        var afterRank = raw - rankDisc;
        var couponDisc = 0;
        if (appliedCoupon && afterRank >= appliedCoupon.minOrder) {
          couponDisc = appliedCoupon.type === 'percent' ? Math.round(afterRank * (appliedCoupon.value / 100)) : appliedCoupon.value;
        }
        var totalDiscount = Math.min(raw, rankDisc + couponDisc);
        var total = Math.max(0, raw - totalDiscount);
        return { qty: qty, raw: raw, totalDiscount: totalDiscount, total: total };
      }

      function updateBuySummary() {
        if (!selectedProduct) return;
        var u = getCurrentUser();
        var calc = computeTotals();
        document.getElementById('modal-discount').textContent = calc.totalDiscount > 0 ? '-' + fmt(calc.totalDiscount) : '0đ';
        document.getElementById('modal-total').textContent = fmt(calc.total);
        document.getElementById('modal-wallet-now').textContent = fmt(u ? u.wallet : 0);

        var insufficient = !u || u.wallet < calc.total;
        document.getElementById('buy-balance-warn').classList.toggle('hidden', !insufficient);
        document.getElementById('btn-confirm-buy').disabled = insufficient || isPurchasingLock;
      }

      document.getElementById('close-buy-modal-btn').addEventListener('click', closeBuyModal);
      buyModal.addEventListener('click', function (e) { if (e.target === buyModal) closeBuyModal(); });
      document.getElementById('qty-minus-btn').addEventListener('click', function () {
        var inp = document.getElementById('buy-qty');
        inp.value = String(Math.max(1, (parseInt(inp.value, 10) || 1) - 1));
        updateBuySummary();
      });
      document.getElementById('qty-plus-btn').addEventListener('click', function () {
        var inp = document.getElementById('buy-qty');
        inp.value = String(Math.min(selectedProduct.stock, (parseInt(inp.value, 10) || 1) + 1));
        updateBuySummary();
      });
      document.getElementById('buy-qty').addEventListener('input', updateBuySummary);
      document.getElementById('quick-go-deposit-btn').addEventListener('click', function () {
        closeBuyModal(); switchTab('deposit');
      });

      /* Coupon Validator (Simulates /api/coupons/validate) */
      document.getElementById('apply-promo-btn').addEventListener('click', function () {
        var code = document.getElementById('promo-input').value.trim().toUpperCase();
        var statusEl = document.getElementById('promo-status-msg');
        if (!code) { appliedCoupon = null; statusEl.textContent = ''; updateBuySummary(); return; }
        statusEl.style.color = 'var(--text-muted)';
        statusEl.textContent = 'Đang xác thực mã qua API...';
        setTimeout(function () {
          var c = COUPONS[code];
          var calc = computeTotals();
          if (!c) {
            appliedCoupon = null;
            statusEl.style.color = 'var(--accent-rose)';
            statusEl.textContent = '✕ Mã giảm giá không tồn tại hoặc đã hết hạn.';
          } else if (calc.raw < c.minOrder) {
            appliedCoupon = null;
            statusEl.style.color = 'var(--accent-amber)';
            statusEl.textContent = '⚠ Mã ' + code + ' yêu cầu đơn tối thiểu ' + fmt(c.minOrder) + '.';
          } else {
            appliedCoupon = Object.assign({ code: code }, c);
            statusEl.style.color = 'var(--accent-emerald)';
            statusEl.textContent = '✓ Hợp lệ: ' + c.label;
          }
          updateBuySummary();
        }, 250);
      });

      /* Atomic Purchase + Redirect to Order Detail Modal */
      document.getElementById('btn-confirm-buy').addEventListener('click', function () {
        if (isPurchasingLock || !selectedProduct) return;
        var u = getCurrentUser();
        if (!u) { closeBuyModal(); openAuthModal('login'); return; }
        var calc = computeTotals();
        if (calc.qty > selectedProduct.stock) { toast('Vượt tồn kho khả dụng!', true); return; }
        if (u.wallet < calc.total) { toast('Số dư ví không đủ!', true); return; }

        isPurchasingLock = true;
        var btn = document.getElementById('btn-confirm-buy');
        btn.disabled = true;
        btn.textContent = 'Đang khóa giao dịch & Xuất kho...';

        setTimeout(function () {
          // Atomic deduction & stock allocation
          u.wallet -= calc.total;
          selectedProduct.stock -= calc.qty;

          var lines = [];
          for (var i = 0; i < calc.qty; i++) {
            var r = Math.random().toString(36).substring(2, 8).toUpperCase();
            if (selectedProduct.cat === 'PROXY') lines.push('103.142.' + Math.floor(Math.random() * 200) + '.' + Math.floor(Math.random() * 250) + ':8080:vh_' + r + ':Pass' + r + '#');
            else if (selectedProduct.cat === 'FB') lines.push('1000' + Math.floor(10000000000 + Math.random() * 89999999999) + '|VhPass@' + r + '|JBSWY3DP' + r + '|mail_' + r.toLowerCase() + '@vanhung.xyz');
            else lines.push('user_' + r.toLowerCase() + '@vanhung.xyz|Pass#' + r + '2026|2FA_' + r);
          }

          var orderCode = 'VH-' + Date.now().toString().slice(-6);
          var nowStr = new Date().toLocaleString('vi-VN');
          var orderObj = {
            code: orderCode,
            product: selectedProduct.name,
            qty: calc.qty,
            total: calc.total,
            time: nowStr,
            data: lines.join('\n'),
            warrantyTicket: null
          };
          u.orders.unshift(orderObj);
          u.ledger.unshift({
            time: nowStr,
            type: 'PURCHASE',
            amount: -calc.total,
            balanceAfter: u.wallet,
            note: 'Mua ' + calc.qty + 'x ' + selectedProduct.name.slice(0, 32) + ' · ' + orderCode
          });

          saveUsersDb();
          syncAuthUI();
          renderProducts();

          isPurchasingLock = false;
          btn.disabled = false;
          btn.textContent = 'Xác Nhận Mua & Giao Tự Động';
          closeBuyModal();
          openOrderDetailModal(orderObj);
          toast('Mua thành công! Đã trừ ví và chuyển sang chi tiết đơn hàng.');
        }, 550);
      });

      /* 7. ORDER DETAIL MODAL & WARRANTY */
      var odModal = document.getElementById('order-detail-modal');
      var warrantyForm = document.getElementById('warranty-form');

      function openOrderDetailModal(order) {
        activeOrderDetail = order;
        document.getElementById('od-code').textContent = order.code;
        document.getElementById('od-title').textContent = order.product;
        document.getElementById('od-meta').textContent = order.time + ' · Số lượng: ' + order.qty + ' · Tổng: ' + fmt(order.total);
        document.getElementById('od-items-box').value = order.data;
        warrantyForm.classList.add('hidden');
        document.getElementById('warranty-reason').value = '';

        var statusBox = document.getElementById('od-warranty-status');
        if (order.warrantyTicket) {
          statusBox.classList.remove('hidden');
          statusBox.textContent = 'Ticket bảo hành #' + order.warrantyTicket.id + ' (' + order.warrantyTicket.status + '): "' + order.warrantyTicket.reason + '"';
        } else {
          statusBox.classList.add('hidden');
        }
        odModal.classList.remove('hidden');
      }

      document.getElementById('close-od-btn').addEventListener('click', function () { odModal.classList.add('hidden'); });
      odModal.addEventListener('click', function (e) { if (e.target === odModal) odModal.classList.add('hidden'); });
      document.getElementById('od-copy-all-btn').addEventListener('click', function () { copyText(document.getElementById('od-items-box').value); });
      document.getElementById('od-download-btn').addEventListener('click', function () {
        if (activeOrderDetail) downloadTxt(activeOrderDetail.code + '.txt', activeOrderDetail.data);
      });
      document.getElementById('od-warranty-toggle-btn').addEventListener('click', function () {
        warrantyForm.classList.toggle('hidden');
      });
      document.getElementById('warranty-cancel-btn').addEventListener('click', function () {
        warrantyForm.classList.add('hidden');
      });
      warrantyForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!activeOrderDetail) return;
        var reason = document.getElementById('warranty-reason').value.trim();
        if (!reason) return;
        activeOrderDetail.warrantyTicket = {
          id: 'BH-' + Date.now().toString().slice(-4),
          reason: reason,
          status: 'Đang kiểm tra đổi mới'
        };
        saveUsersDb();
        warrantyForm.classList.add('hidden');
        openOrderDetailModal(activeOrderDetail);
        renderOrdersAndLedger();
        toast('Đã gửi yêu cầu bảo hành ' + activeOrderDetail.warrantyTicket.id + '!');
      });

      /* 8. ORDERS & BALANCE LEDGER VIEW */
      function renderOrdersAndLedger() {
        var u = getCurrentUser();
        var ordersEl = document.getElementById('orders-list');
        var ledgerEl = document.getElementById('ledger-tbody');
        if (!u) {
          ordersEl.innerHTML = '<div class="glass-panel rounded-2xl p-8 text-center text-sm" style="color:var(--text-muted);">Vui lòng đăng nhập để xem lịch sử đơn hàng và biến động số dư.</div>';
          ledgerEl.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-xs" style="color:var(--text-muted);">Chưa đăng nhập.</td></tr>';
          return;
        }
        if (!u.orders.length) {
          ordersEl.innerHTML = '<div class="glass-panel rounded-2xl p-8 text-center text-sm" style="color:var(--text-muted);">Bạn chưa có đơn hàng nào. Quay lại Gian hàng để mua ngay!</div>';
        } else {
          ordersEl.innerHTML = u.orders.map(function (o, idx) {
            return '<article class="glass-panel rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">' +
              '<div><div class="flex items-center gap-2 flex-wrap">' +
                '<span class="font-mono-code text-xs font-bold px-2 py-0.5 rounded" style="background:rgba(16,185,129,0.16);color:var(--accent-emerald);">' + o.code + '</span>' +
                '<strong class="text-sm sm:text-base">' + o.product + '</strong>' +
                (o.warrantyTicket ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded" style="background:rgba(245,158,11,0.16);color:var(--accent-amber);">' + o.warrantyTicket.id + '</span>' : '') +
              '</div><div class="text-xs font-mono-code mt-1" style="color:var(--text-muted);">' + o.time + ' · SL: ' + o.qty + ' · <strong style="color:var(--accent-emerald);">' + fmt(o.total) + '</strong></div></div>' +
              '<button type="button" data-open-order="' + idx + '" class="btn-cyber px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs border-0">Chi tiết đơn / Bảo hành</button>' +
            '</article>';
          }).join('');
        }

        ledgerEl.innerHTML = u.ledger.map(function (l) {
          var isPos = l.amount >= 0;
          return '<tr class="mmo-row" style="border-bottom:1px solid var(--border-subtle);">' +
            '<td class="p-3.5 font-mono-code text-xs" style="color:var(--text-muted);">' + l.time + '</td>' +
            '<td class="p-3.5"><span class="text-[11px] font-bold px-2 py-0.5 rounded" style="background:' + (isPos ? 'rgba(16,185,129,0.15);color:var(--accent-emerald);' : 'rgba(244,63,94,0.14);color:var(--accent-rose);') + '">' + (isPos ? 'NẠP TIỀN' : 'MUA HÀNG') + '</span></td>' +
            '<td class="p-3.5 font-mono-code font-bold" style="color:' + (isPos ? 'var(--accent-emerald)' : 'var(--accent-rose)') + ';">' + (isPos ? '+' : '') + fmt(l.amount) + '</td>' +
            '<td class="p-3.5 font-mono-code">' + fmt(l.balanceAfter) + '</td>' +
            '<td class="p-3.5 text-xs" style="color:var(--text-secondary);">' + l.note + '</td></tr>';
        }).join('');
      }

      document.getElementById('orders-list').addEventListener('click', function (e) {
        var b = e.target.closest('[data-open-order]');
        if (!b) return;
        var u = getCurrentUser();
        if (u && u.orders[parseInt(b.getAttribute('data-open-order'), 10)]) {
          openOrderDetailModal(u.orders[parseInt(b.getAttribute('data-open-order'), 10)]);
        }
      });

      /* 9. MULTI-CHANNEL DEPOSIT (/deposit — 3.4) */
      function setDepositTab(tab) {
        document.querySelectorAll('.dep-panel').forEach(function (p) { p.classList.add('hidden'); });
        document.getElementById('dep-panel-' + tab).classList.remove('hidden');
        document.querySelectorAll('.dep-tab-btn').forEach(function (b) {
          var active = b.getAttribute('data-dep-tab') === tab;
          b.style.background = active ? 'rgba(16,185,129,0.18)' : 'var(--bg-secondary)';
          b.style.borderColor = active ? 'var(--accent-emerald)' : 'var(--border-subtle)';
          b.style.color = active ? 'var(--accent-emerald)' : 'var(--text-muted)';
        });
      }
      document.querySelectorAll('.dep-tab-btn').forEach(function (b) {
        b.addEventListener('click', function () { setDepositTab(b.getAttribute('data-dep-tab')); });
      });

      function updateVietQR() {
        var u = getCurrentUser();
        var memo = 'VH ' + (u ? u.id : 'GUEST');
        var bankKey = document.getElementById('dep-bank-select').value;
        var bank = BANKS[bankKey] || BANKS.MB;
        var amount = Math.max(10000, parseInt(document.getElementById('dep-amount-input').value, 10) || 500000);

        document.getElementById('deposit-user-memo-badge').textContent = memo;
        document.getElementById('qr-bank-name').textContent = bank.name;
        document.getElementById('qr-bank-acc').textContent = bank.acc;
        document.getElementById('qr-bank-owner').textContent = bank.owner;
        document.getElementById('qr-transfer-memo').textContent = memo;
        document.getElementById('qr-caption-amount').textContent = fmt(amount) + ' · ' + memo;
        document.querySelectorAll('.ewallet-memo').forEach(function (el) { el.textContent = memo; });

        var qrImg = document.getElementById('vietqr-img');
        var qrFb = document.getElementById('vietqr-fallback');
        qrImg.classList.remove('hidden');
        qrFb.classList.add('hidden');
        qrImg.onerror = function () {
          qrImg.classList.add('hidden');
          qrFb.classList.remove('hidden');
        };
        qrImg.src = 'https://img.vietqr.io/image/' + bank.bin + '-' + bank.acc + '-compact2.png?amount=' + amount + '&addInfo=' + encodeURIComponent(memo) + '&accountName=' + encodeURIComponent(bank.owner);
      }

      document.getElementById('dep-bank-select').addEventListener('change', updateVietQR);
      document.getElementById('dep-amount-input').addEventListener('input', updateVietQR);
      document.querySelectorAll('[data-dep-preset]').forEach(function (b) {
        b.addEventListener('click', function () {
          document.getElementById('dep-amount-input').value = b.getAttribute('data-dep-preset');
          updateVietQR();
        });
      });
      document.getElementById('copy-bank-acc-btn').addEventListener('click', function () { copyText(document.getElementById('qr-bank-acc').textContent); });
      document.getElementById('copy-bank-memo-btn').addEventListener('click', function () { copyText(document.getElementById('qr-transfer-memo').textContent); });

      function creditDeposit(amount, channelLabel) {
        var u = getCurrentUser();
        if (!u) { toast('Vui lòng đăng nhập để nạp tiền vào ví!', true); openAuthModal('login'); return; }
        var prevRank = getRankInfo(u).code;
        u.wallet += amount;
        u.totalDeposited += amount;
        u.ledger.unshift({
          time: new Date().toLocaleString('vi-VN'),
          type: 'DEPOSIT',
          amount: amount,
          balanceAfter: u.wallet,
          note: channelLabel + ' · VH ' + u.id
        });
        saveUsersDb();
        syncAuthUI();
        var newRank = getRankInfo(u).code;
        toast(newRank !== prevRank ? 'Cộng +' + fmt(amount) + ' thành công — Lên hạng ' + newRank + '!' : 'Auto Deposit: Đã cộng +' + fmt(amount) + ' vào ví!');
      }

      document.getElementById('sim-vietqr-btn').addEventListener('click', function () {
        var amt = Math.max(10000, parseInt(document.getElementById('dep-amount-input').value, 10) || 500000);
        creditDeposit(amt, 'VietQR ' + document.getElementById('dep-bank-select').value);
      });
      document.getElementById('sim-ewallet-btn').addEventListener('click', function () { creditDeposit(300000, 'MoMo Auto'); });

      /* Crypto Converter */
      var cryptoAddrs = { TRC20: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', BEP20: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' };
      function updateCrypto() {
        var net = document.getElementById('crypto-network').value;
        var usdt = Math.max(5, parseFloat(document.getElementById('crypto-usdt').value) || 20);
        document.getElementById('crypto-net-label').textContent = net;
        document.getElementById('crypto-wallet-addr').textContent = cryptoAddrs[net];
        document.getElementById('crypto-vnd-preview').textContent = fmt(Math.round(usdt * 25400));
      }
      document.getElementById('crypto-network').addEventListener('change', updateCrypto);
      document.getElementById('crypto-usdt').addEventListener('input', updateCrypto);
      document.getElementById('copy-crypto-btn').addEventListener('click', function () { copyText(document.getElementById('crypto-wallet-addr').textContent); });
      document.getElementById('sim-crypto-btn').addEventListener('click', function () {
        var usdt = Math.max(5, parseFloat(document.getElementById('crypto-usdt').value) || 20);
        creditDeposit(Math.round(usdt * 25400), 'USDT ' + document.getElementById('crypto-network').value);
      });

      /* 10. 2FA & API */
      function update2FA() {
        var sec = Math.floor(Date.now() / 1000), rem = 30 - (sec % 30), step = Math.floor(sec / 30);
        var secret = document.getElementById('totp-secret').value.trim() || 'VANHUNG', hash = 0;
        for (var i = 0; i < secret.length; i++) hash = ((hash << 5) - hash + secret.charCodeAt(i) + step * 31) | 0;
        var code = String(Math.abs(hash) % 1000000).padStart(6, '0');
        document.getElementById('totp-code').textContent = code.slice(0, 3) + ' ' + code.slice(3);
        document.getElementById('totp-timer').textContent = rem + 's';
        document.getElementById('totp-progress').style.width = ((rem / 30) * 100) + '%';
      }
      document.getElementById('totp-secret').addEventListener('input', update2FA);
      document.getElementById('copy-totp-btn').addEventListener('click', function () { copyText(document.getElementById('totp-code').textContent.replace(/\s/g, '')); });
      setInterval(update2FA, 1000);

      function showApiCode(lang) {
        activeApiLang = lang;
        document.getElementById('api-code-box').textContent = apiSnippets[lang];
        document.querySelectorAll('.api-lang-btn').forEach(function (b) {
          var a = b.getAttribute('data-api-lang') === lang;
          b.style.background = a ? 'var(--accent-indigo)' : 'var(--bg-secondary)';
          b.style.color = a ? '#FFFFFF' : 'var(--text-muted)';
        });
      }
      document.querySelectorAll('.api-lang-btn').forEach(function (b) { b.addEventListener('click', function () { showApiCode(b.getAttribute('data-api-lang')); }); });
      document.getElementById('copy-api-btn').addEventListener('click', function () { copyText(apiSnippets[activeApiLang]); });

      /* 11. ADMIN */
      function renderAdmin() {
        var allOrders = usersDb.reduce(function (arr, u) { return arr.concat(u.orders || []); }, []);
        var rev = allOrders.reduce(function (s, o) { return s + o.total; }, 0);
        var warranties = allOrders.filter(function (o) { return Boolean(o.warrantyTicket); }).length;
        document.getElementById('admin-revenue').textContent = fmt(rev);
        document.getElementById('admin-prod-count').textContent = products.length;
        document.getElementById('admin-order-count').textContent = allOrders.length;
        document.getElementById('admin-warranty-count').textContent = warranties;

        document.getElementById('admin-stock-tbody').innerHTML = products.map(function (p) {
          return '<tr class="mmo-row" style="border-bottom:1px solid var(--border-subtle);">' +
            '<td class="p-3.5 font-medium">' + p.name + '</td><td class="p-3.5 font-mono-code text-xs" style="color:var(--accent-cyan);">' + p.cat + '</td>' +
            '<td class="p-3.5 font-mono-code">' + fmt(p.price) + '</td><td class="p-3.5 font-mono-code font-bold" style="color:var(--accent-emerald);">' + p.stock + '</td>' +
            '<td class="p-3.5 text-right whitespace-nowrap space-x-1.5">' +
              '<button type="button" data-restock-id="' + p.id + '" class="btn-cyber px-3 py-1 rounded-lg text-xs font-bold border-0" style="background:rgba(16,185,129,0.16);color:var(--accent-emerald);">+100 Kho</button>' +
              '<button type="button" data-delete-id="' + p.id + '" class="btn-cyber px-2.5 py-1 rounded-lg text-xs font-semibold border-0" style="background:rgba(244,63,94,0.14);color:var(--accent-rose);">Xóa</button></td></tr>';
        }).join('');
      }
      document.getElementById('admin-stock-tbody').addEventListener('click', function (e) {
        var r = e.target.closest('[data-restock-id]');
        if (r) { var p = products.find(function (x) { return x.id === parseInt(r.getAttribute('data-restock-id'), 10); }); if (p) { p.stock += 100; renderAdmin(); renderProducts(); toast('Đã nạp +100 tồn kho!'); } return; }
        var d = e.target.closest('[data-delete-id]');
        if (d) { products = products.filter(function (x) { return x.id !== parseInt(d.getAttribute('data-delete-id'), 10); }); renderCategories(); renderProducts(); renderAdmin(); toast('Đã xóa sản phẩm.'); }
      });
      document.getElementById('admin-add-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var name = document.getElementById('adm-name').value.trim(), cat = document.getElementById('adm-cat').value;
        var price = parseInt(document.getElementById('adm-price').value, 10), stock = parseInt(document.getElementById('adm-stock').value, 10);
        var warranty = document.getElementById('adm-warranty').value.trim() || '30 ngày';
        if (!name || !price || !stock) return;
        products.unshift({ id: Date.now(), cat: cat, name: name, price: price, stock: stock, badge: 'NEW', country: 'VN', warranty: warranty, format: cat === 'PROXY' ? 'ip:port:user:pass' : 'user|pass|2fa' });
        e.target.reset(); document.getElementById('adm-warranty').value = '30 ngày';
        renderCategories(); renderProducts(); renderAdmin(); toast('Đã thêm sản phẩm mới!');
      });

      /* 12. SHORTCUTS & INIT */
      document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); switchTab('store'); document.getElementById('search-input').focus(); }
        if (e.key === 'Escape') { closeBuyModal(); odModal.classList.add('hidden'); closeAuthModal(); }
      });

      renderCategories();
      setViewMode('table');
      setDepositTab('bank');
      switchTab('store');
      showApiCode('curl');
      update2FA();
      updateCrypto();
      syncAuthUI();

      // Mở đầu chào mừng Đăng nhập / Đăng ký nếu khách chưa đăng nhập
      if (!getCurrentUser()) {
        openAuthModal('login');
      }
    })();
