import './styles.css';
import { INITIAL_PRODUCTS, CATEGORIES, API_SNIPPETS } from './data.js';

(function () {
      'use strict';

      /* -----------------------------------------------------------------------
         1. SAFE STORAGE & HELPERS
         ----------------------------------------------------------------------- */
      function lsGet(key, fallback) {
        try {
          var v = localStorage.getItem(key);
          return v !== null ? v : fallback;
        } catch (e) { return fallback; }
      }
      function lsSet(key, val) {
        try { localStorage.setItem(key, val); } catch (e) {}
      }
      function fmt(n) {
        return Number(n || 0).toLocaleString('vi-VN') + 'đ';
      }
      function normalizeVi(str) {
        return String(str || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .trim();
      }

      var toastTimer = null;
      function toast(msg, isError) {
        var el = document.getElementById('toast');
        el.textContent = msg;
        el.style.background = isError
          ? 'linear-gradient(135deg, #F43F5E, #FB7185)'
          : 'linear-gradient(135deg, #10B981, #34D399)';
        el.style.color = isError ? '#FFFFFF' : '#050811';
        el.classList.remove('hidden');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.classList.add('hidden'); }, 2800);
      }

      function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            toast('Đã sao chép vào bộ nhớ tạm!');
          }).catch(function () { fallbackCopy(text); });
        } else {
          fallbackCopy(text);
        }
      }
      function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); toast('Đã sao chép vào bộ nhớ tạm!'); } catch (e) {}
        document.body.removeChild(ta);
      }

      /* -----------------------------------------------------------------------
         2. STATE & DATA
         ----------------------------------------------------------------------- */
      var wallet = parseInt(lsGet('vh_wallet', '1250000'), 10) || 1250000;
      var totalDeposited = parseInt(lsGet('vh_deposited', '1250000'), 10) || 1250000;
      var orders = [];
      try { orders = JSON.parse(lsGet('vh_orders', '[]')) || []; } catch (e) { orders = []; }

      var viewMode = 'table';
      var activeCategory = 'ALL';
      var activeApiLang = 'curl';
      var selectedProduct = null;
      var activePromoRate = 0;

      var products = INITIAL_PRODUCTS.map(function (item) { return Object.assign({}, item); });

      var categories = CATEGORIES;

      function getRankInfo() {
        if (totalDeposited >= 50000000) return { code: 'AGENCY', rate: 0.20, label: '20%' };
        if (totalDeposited >= 10000000) return { code: 'VIP', rate: 0.12, label: '12%' };
        if (totalDeposited >= 2000000) return { code: 'CTV', rate: 0.05, label: '5%' };
        return { code: 'LV1', rate: 0, label: '0%' };
      }

      function updateWalletUI() {
        document.getElementById('wallet-balance').textContent = fmt(wallet);
        document.getElementById('mobile-wallet-balance').textContent = fmt(wallet);
        document.getElementById('total-deposited-label').textContent = fmt(totalDeposited);
        var rank = getRankInfo();
        document.getElementById('user-rank-pill').textContent = rank.code;

        var badge = document.getElementById('nav-order-badge');
        if (orders.length > 0) {
          badge.textContent = orders.length;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }

        lsSet('vh_wallet', String(wallet));
        lsSet('vh_deposited', String(totalDeposited));
      }

      /* -----------------------------------------------------------------------
         3. THEME CONTROLLER
         ----------------------------------------------------------------------- */
      function syncThemeIcons() {
        var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        document.getElementById('theme-icon-sun').classList.toggle('hidden', !isDark);
        document.getElementById('theme-icon-moon').classList.toggle('hidden', isDark);
      }
      document.getElementById('theme-toggle-btn').addEventListener('click', function () {
        var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        var next = isDark ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        lsSet('vh_theme', next);
        syncThemeIcons();
      });
      syncThemeIcons();

      /* -----------------------------------------------------------------------
         4. TAB NAVIGATION
         ----------------------------------------------------------------------- */
      function switchTab(tab) {
        document.querySelectorAll('.tab-panel').forEach(function (el) { el.classList.add('hidden'); });
        var target = document.getElementById('tab-' + tab);
        if (target) target.classList.remove('hidden');

        document.querySelectorAll('[data-tab]').forEach(function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-tab') === tab);
        });

        if (tab === 'orders') renderOrders();
        if (tab === 'admin') renderAdmin();
      }

      document.querySelectorAll('[data-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-tab')); });
      });
      document.getElementById('brand-home-btn').addEventListener('click', function () { switchTab('store'); });

      /* -----------------------------------------------------------------------
         5. STOREFRONT RENDERING (TABLE PRO MMO & CARD GRID)
         ----------------------------------------------------------------------- */
      function renderCategories() {
        var el = document.getElementById('category-pills');
        el.innerHTML = categories.map(function (c) {
          var count = c.key === 'ALL' ? products.length : products.filter(function (p) { return p.cat === c.key; }).length;
          var active = activeCategory === c.key;
          var styleStr = active
            ? 'background: rgba(16,185,129,0.18); border-color: var(--accent-emerald); color: var(--accent-emerald);'
            : 'background: var(--bg-secondary); border-color: var(--border-subtle); color: var(--text-muted);';
          return '<button type="button" role="tab" aria-selected="' + active + '" data-cat-key="' + c.key + '" ' +
            'class="btn-cyber px-3.5 py-1.5 rounded-xl text-xs font-semibold border" style="' + styleStr + '">' +
            c.label + ' <span class="opacity-65 ml-1">(' + count + ')</span></button>';
        }).join('');
      }

      document.getElementById('category-pills').addEventListener('click', function (e) {
        var btn = e.target.closest('[data-cat-key]');
        if (!btn) return;
        activeCategory = btn.getAttribute('data-cat-key');
        renderCategories();
        renderProducts();
      });

      function setViewMode(mode) {
        viewMode = mode;
        var tblBtn = document.getElementById('btn-view-table');
        var gridBtn = document.getElementById('btn-view-grid');
        tblBtn.style.background = mode === 'table' ? 'var(--accent-emerald)' : 'transparent';
        tblBtn.style.color = mode === 'table' ? '#050811' : 'var(--text-muted)';
        gridBtn.style.background = mode === 'grid' ? 'var(--accent-emerald)' : 'transparent';
        gridBtn.style.color = mode === 'grid' ? '#050811' : 'var(--text-muted)';
        renderProducts();
      }
      document.getElementById('btn-view-table').addEventListener('click', function () { setViewMode('table'); });
      document.getElementById('btn-view-grid').addEventListener('click', function () { setViewMode('grid'); });
      document.getElementById('search-input').addEventListener('input', renderProducts);

      function renderProducts() {
        var q = normalizeVi(document.getElementById('search-input').value);
        var filtered = products.filter(function (p) {
          var matchCat = activeCategory === 'ALL' || p.cat === activeCategory;
          if (!matchCat) return false;
          if (!q) return true;
          return normalizeVi(p.name + ' ' + p.cat + ' ' + p.format + ' ' + p.country).indexOf(q) !== -1;
        });

        var totalStock = products.reduce(function (s, p) { return s + p.stock; }, 0);
        document.getElementById('hero-stock-count').textContent = totalStock.toLocaleString('vi-VN');

        var container = document.getElementById('products-container');
        if (!filtered.length) {
          container.innerHTML =
            '<div class="glass-panel rounded-2xl p-10 text-center space-y-3">' +
              '<p class="m-0 text-sm" style="color:var(--text-muted);">Không tìm thấy tài nguyên phù hợp với từ khóa hiện tại.</p>' +
              '<button id="reset-search-btn" type="button" class="btn-cyber px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold border-0">Xem lại tất cả sản phẩm</button>' +
            '</div>';
          var resetBtn = document.getElementById('reset-search-btn');
          if (resetBtn) {
            resetBtn.addEventListener('click', function () {
              document.getElementById('search-input').value = '';
              activeCategory = 'ALL';
              renderCategories();
              renderProducts();
            });
          }
          return;
        }

        if (viewMode === 'table') {
          container.innerHTML =
            '<div class="glass-panel rounded-2xl overflow-hidden">' +
              '<div class="overflow-x-auto">' +
                '<table class="w-full text-left text-sm border-collapse">' +
                  '<thead class="text-[11px] uppercase font-mono-code" style="background: var(--bg-secondary); color: var(--text-muted); border-bottom: 1px solid var(--border-subtle);">' +
                    '<tr>' +
                      '<th class="p-4">Sản phẩm / Tài nguyên</th>' +
                      '<th class="p-4 text-center">Quốc gia</th>' +
                      '<th class="p-4 text-center">Bảo hành</th>' +
                      '<th class="p-4 text-center">Tồn kho</th>' +
                      '<th class="p-4 text-right">Đơn giá</th>' +
                      '<th class="p-4 text-right">Hành động</th>' +
                    '</tr>' +
                  '</thead>' +
                  '<tbody>' +
                    filtered.map(function (p) {
                      return '<tr class="mmo-row" style="border-bottom: 1px solid var(--border-subtle);">' +
                        '<td class="p-4">' +
                          '<div class="flex items-center gap-2 flex-wrap">' +
                            (p.badge ? '<span class="px-1.5 py-0.5 text-[10px] font-mono-code font-bold rounded" style="background:rgba(16,185,129,0.16);color:var(--accent-emerald);">' + p.badge + '</span>' : '') +
                            '<span class="font-semibold">' + p.name + '</span>' +
                          '</div>' +
                          '<div class="text-[11px] font-mono-code mt-0.5" style="color:var(--text-muted);">Định dạng: ' + p.format + '</div>' +
                        '</td>' +
                        '<td class="p-4 text-center font-mono-code text-xs" style="color:var(--text-secondary);">' + p.country + '</td>' +
                        '<td class="p-4 text-center"><span class="px-2 py-0.5 rounded-md text-xs font-medium" style="background:rgba(6,182,212,0.14);color:var(--accent-cyan);">' + p.warranty + '</span></td>' +
                        '<td class="p-4 text-center font-mono-code font-bold" style="color:' + (p.stock > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)') + ';">' + p.stock.toLocaleString('vi-VN') + '</td>' +
                        '<td class="p-4 text-right font-mono-code font-bold">' + fmt(p.price) + '</td>' +
                        '<td class="p-4 text-right">' +
                          '<button type="button" data-buy-id="' + p.id + '" ' + (p.stock === 0 ? 'disabled' : '') +
                            ' class="btn-cyber px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs border-0">Mua ngay</button>' +
                        '</td>' +
                      '</tr>';
                    }).join('') +
                  '</tbody>' +
                '</table>' +
              '</div>' +
            '</div>';
        } else {
          container.innerHTML =
            '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">' +
              filtered.map(function (p) {
                return '<article class="glass-panel rounded-2xl p-5 flex flex-col justify-between transition hover:-translate-y-0.5">' +
                  '<div>' +
                    '<div class="flex items-center justify-between gap-2">' +
                      '<span class="text-[11px] font-mono-code px-2 py-0.5 rounded surface-box" style="color:var(--accent-cyan);">' + p.cat + ' · ' + p.country + '</span>' +
                      (p.badge ? '<span class="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded" style="background:rgba(16,185,129,0.16);color:var(--accent-emerald);">' + p.badge + '</span>' : '') +
                    '</div>' +
                    '<h3 class="font-bold text-base mt-3 mb-0 leading-snug">' + p.name + '</h3>' +
                    '<div class="text-xs font-mono-code mt-2" style="color:var(--text-muted);">Format: ' + p.format + '</div>' +
                  '</div>' +
                  '<div class="mt-5 pt-4 flex items-center justify-between gap-3" style="border-top:1px solid var(--border-subtle);">' +
                    '<div>' +
                      '<div class="text-lg font-mono-code font-extrabold" style="color:var(--accent-emerald);">' + fmt(p.price) + '</div>' +
                      '<div class="text-[11px]" style="color:var(--text-muted);">Kho: <strong>' + p.stock.toLocaleString('vi-VN') + '</strong> · BH: ' + p.warranty + '</div>' +
                    '</div>' +
                    '<button type="button" data-buy-id="' + p.id + '" ' + (p.stock === 0 ? 'disabled' : '') +
                      ' class="btn-cyber px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs border-0">Mua ngay</button>' +
                  '</div>' +
                '</article>';
              }).join('') +
            '</div>';
        }
      }

      document.getElementById('products-container').addEventListener('click', function (e) {
        var btn = e.target.closest('[data-buy-id]');
        if (!btn) return;
        openBuyModal(parseInt(btn.getAttribute('data-buy-id'), 10));
      });

      /* Promo Chips Copy */
      document.querySelectorAll('[data-copy-promo]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          copyText(btn.getAttribute('data-copy-promo'));
        });
      });

      /* -----------------------------------------------------------------------
         6. BUY MODAL & INSTANT EXPORT (.TXT)
         ----------------------------------------------------------------------- */
      var buyModal = document.getElementById('buy-modal');

      function openBuyModal(id) {
        selectedProduct = products.find(function (p) { return p.id === id; });
        if (!selectedProduct) return;
        activePromoRate = 0;
        document.getElementById('promo-input').value = '';
        document.getElementById('buy-qty').value = '1';
        document.getElementById('modal-cat').textContent = selectedProduct.cat + ' · Kho còn ' + selectedProduct.stock.toLocaleString('vi-VN');
        document.getElementById('modal-title').textContent = selectedProduct.name;
        document.getElementById('modal-unit-price').textContent = fmt(selectedProduct.price);
        document.getElementById('buy-form-step').classList.remove('hidden');
        document.getElementById('buy-result-step').classList.add('hidden');
        buyModal.classList.remove('hidden');
        updateModalTotal();
      }
      function closeBuyModal() { buyModal.classList.add('hidden'); }

      function updateModalTotal() {
        if (!selectedProduct) return;
        var qty = Math.max(1, parseInt(document.getElementById('buy-qty').value, 10) || 1);
        var raw = qty * selectedProduct.price;
        var rank = getRankInfo();
        var rankDisc = Math.round(raw * rank.rate);
        var promoDisc = Math.round((raw - rankDisc) * activePromoRate);
        var finalTotal = Math.max(0, raw - rankDisc - promoDisc);

        document.getElementById('modal-rank-label').textContent = rank.label;
        document.getElementById('modal-rank-discount').textContent = rankDisc > 0 ? '-' + fmt(rankDisc) : '0đ';
        document.getElementById('modal-discount').textContent = promoDisc > 0 ? '-' + fmt(promoDisc) : '0đ';
        document.getElementById('modal-total').textContent = fmt(finalTotal);
      }

      document.getElementById('close-buy-modal-btn').addEventListener('click', closeBuyModal);
      buyModal.addEventListener('click', function (e) { if (e.target === buyModal) closeBuyModal(); });

      document.getElementById('qty-minus-btn').addEventListener('click', function () {
        var inp = document.getElementById('buy-qty');
        inp.value = Math.max(1, (parseInt(inp.value, 10) || 1) - 1);
        updateModalTotal();
      });
      document.getElementById('qty-plus-btn').addEventListener('click', function () {
        var inp = document.getElementById('buy-qty');
        inp.value = Math.min(selectedProduct.stock, (parseInt(inp.value, 10) || 1) + 1);
        updateModalTotal();
      });
      document.getElementById('buy-qty').addEventListener('input', updateModalTotal);

      document.querySelectorAll('[data-quick-qty]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!selectedProduct) return;
          var q = parseInt(btn.getAttribute('data-quick-qty'), 10);
          document.getElementById('buy-qty').value = Math.min(selectedProduct.stock, q);
          updateModalTotal();
        });
      });

      document.getElementById('apply-promo-btn').addEventListener('click', function () {
        var code = document.getElementById('promo-input').value.trim().toUpperCase();
        if (code === 'VANHUNG10') {
          activePromoRate = 0.10;
          toast('Áp dụng mã VANHUNG10 (-10%) thành công!');
        } else if (code === 'MMO2026') {
          activePromoRate = 0.15;
          toast('Áp dụng mã VIP MMO2026 (-15%) thành công!');
        } else {
          activePromoRate = 0;
          toast('Mã giảm giá không hợp lệ!', true);
        }
        updateModalTotal();
      });

      document.getElementById('btn-confirm-buy').addEventListener('click', function () {
        if (!selectedProduct) return;
        var qty = Math.max(1, parseInt(document.getElementById('buy-qty').value, 10) || 1);
        if (qty > selectedProduct.stock) {
          toast('Số lượng vượt quá tồn kho hiện tại!', true);
          return;
        }
        var raw = qty * selectedProduct.price;
        var rank = getRankInfo();
        var afterRank = raw - Math.round(raw * rank.rate);
        var total = Math.max(0, afterRank - Math.round(afterRank * activePromoRate));

        if (wallet < total) {
          toast('Số dư không đủ! Vui lòng nạp thêm VietQR.', true);
          return;
        }

        var btn = document.getElementById('btn-confirm-buy');
        btn.textContent = 'Đang Check Live & Xuất kho...';
        btn.disabled = true;

        setTimeout(function () {
          wallet -= total;
          selectedProduct.stock -= qty;

          var lines = [];
          for (var i = 0; i < qty; i++) {
            var rand = Math.random().toString(36).substring(2, 8).toUpperCase();
            if (selectedProduct.cat === 'PROXY') {
              lines.push('103.142.' + Math.floor(Math.random() * 200) + '.' + Math.floor(Math.random() * 250) + ':8080:vh_' + rand + ':Pass' + rand + '#');
            } else if (selectedProduct.cat === 'FB') {
              lines.push('1000' + Math.floor(10000000000 + Math.random() * 89999999999) + '|VhPass@' + rand + '|JBSWY3DP' + rand + '|mail_' + rand.toLowerCase() + '@vanhung.xyz');
            } else {
              lines.push('user_' + rand.toLowerCase() + '@vanhung.xyz|Pass#' + rand + '2026|2FA_' + rand);
            }
          }

          var orderObj = {
            code: 'VH-' + Date.now().toString().slice(-6),
            product: selectedProduct.name,
            qty: qty,
            total: total,
            time: new Date().toLocaleString('vi-VN'),
            data: lines.join('\n')
          };
          orders.unshift(orderObj);
          lsSet('vh_orders', JSON.stringify(orders));

          updateWalletUI();
          renderProducts();

          document.getElementById('result-accounts').value = orderObj.data;
          document.getElementById('buy-form-step').classList.add('hidden');
          document.getElementById('buy-result-step').classList.remove('hidden');
          btn.textContent = 'Thanh Toán & Xuất Kho Ngay';
          btn.disabled = false;
          toast('Xuất kho tự động thành công ' + qty + ' tài khoản!');
        }, 650);
      });

      function downloadTxt(filename, content) {
        var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      document.getElementById('copy-result-btn').addEventListener('click', function () {
        copyText(document.getElementById('result-accounts').value);
      });
      document.getElementById('download-result-btn').addEventListener('click', function () {
        downloadTxt('VANHUNG_XYZ_ORDER_' + Date.now() + '.txt', document.getElementById('result-accounts').value);
      });

      /* -----------------------------------------------------------------------
         7. ORDER HISTORY
         ----------------------------------------------------------------------- */
      function renderOrders() {
        var el = document.getElementById('orders-list');
        if (!orders.length) {
          el.innerHTML = '<div class="glass-panel rounded-2xl p-10 text-center text-sm" style="color:var(--text-muted);">Bạn chưa có đơn hàng nào. Quay lại Gian hàng để mua tài nguyên tự động!</div>';
          return;
        }
        el.innerHTML = orders.map(function (o, idx) {
          return '<article class="glass-panel rounded-2xl p-5 space-y-3">' +
            '<div class="flex flex-wrap items-center justify-between gap-2">' +
              '<div class="flex items-center gap-2 flex-wrap">' +
                '<span class="font-mono-code text-xs font-bold px-2 py-0.5 rounded" style="background:rgba(16,185,129,0.16);color:var(--accent-emerald);">' + o.code + '</span>' +
                '<span class="font-bold text-sm sm:text-base">' + o.product + '</span>' +
              '</div>' +
              '<div class="text-xs font-mono-code" style="color:var(--text-muted);">' + o.time + ' · SL: ' + o.qty + ' · <strong style="color:var(--accent-emerald);">' + fmt(o.total) + '</strong></div>' +
            '</div>' +
            '<pre class="rounded-xl p-3 text-xs font-mono-code overflow-x-auto m-0" style="background:#04070E;color:#6EE7B7;border:1px solid var(--border-subtle);">' + o.data + '</pre>' +
            '<div class="flex items-center gap-2">' +
              '<button type="button" data-order-copy="' + idx + '" class="btn-cyber px-3 py-1.5 rounded-lg surface-box text-xs font-semibold">Sao chép dữ liệu</button>' +
              '<button type="button" data-order-dl="' + idx + '" class="btn-cyber px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold border-0">Tải .TXT</button>' +
            '</div>' +
          '</article>';
        }).join('');
      }

      document.getElementById('orders-list').addEventListener('click', function (e) {
        var copyBtn = e.target.closest('[data-order-copy]');
        if (copyBtn) {
          var o = orders[parseInt(copyBtn.getAttribute('data-order-copy'), 10)];
          if (o) copyText(o.data);
          return;
        }
        var dlBtn = e.target.closest('[data-order-dl]');
        if (dlBtn) {
          var ord = orders[parseInt(dlBtn.getAttribute('data-order-dl'), 10)];
          if (ord) downloadTxt(ord.code + '.txt', ord.data);
        }
      });

      document.getElementById('clear-orders-btn').addEventListener('click', function () {
        orders = [];
        lsSet('vh_orders', '[]');
        updateWalletUI();
        renderOrders();
        toast('Đã xóa lịch sử đơn hàng demo!');
      });

      /* -----------------------------------------------------------------------
         8. DEPOSIT VIETQR & AGENCY MODALS
         ----------------------------------------------------------------------- */
      var depositModal = document.getElementById('deposit-modal');
      var agencyModal = document.getElementById('agency-modal');

      function openDepositModal() { depositModal.classList.remove('hidden'); }
      function closeDepositModal() { depositModal.classList.add('hidden'); }

      document.getElementById('open-deposit-btn').addEventListener('click', openDepositModal);
      document.getElementById('close-deposit-btn').addEventListener('click', closeDepositModal);
      depositModal.addEventListener('click', function (e) { if (e.target === depositModal) closeDepositModal(); });
      document.getElementById('copy-bank-note-btn').addEventListener('click', function () { copyText('NAP VH2026'); });

      document.querySelectorAll('[data-tier-action="deposit"]').forEach(function (btn) {
        btn.addEventListener('click', openDepositModal);
      });

      document.querySelectorAll('[data-sim-deposit]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var amt = parseInt(btn.getAttribute('data-sim-deposit'), 10);
          var prevRank = getRankInfo().code;
          wallet += amt;
          totalDeposited += amt;
          updateWalletUI();
          closeDepositModal();
          var newRank = getRankInfo().code;
          if (newRank !== prevRank) {
            toast('SePay Auto: +' + fmt(amt) + ' — Chúc mừng lên hạng ' + newRank + '!');
          } else {
            toast('SePay Auto: Đã cộng +' + fmt(amt) + ' vào ví!');
          }
        });
      });

      document.getElementById('contact-admin-tier-btn').addEventListener('click', function () { agencyModal.classList.remove('hidden'); });
      document.getElementById('close-agency-btn').addEventListener('click', function () { agencyModal.classList.add('hidden'); });
      agencyModal.addEventListener('click', function (e) { if (e.target === agencyModal) agencyModal.classList.add('hidden'); });
      document.getElementById('copy-tele-btn').addEventListener('click', function () { copyText('@vanhung_admin'); });

      /* -----------------------------------------------------------------------
         9. 2FA LIVE TOOL & API RESELLER DOCS
         ----------------------------------------------------------------------- */
      function update2FA() {
        var sec = Math.floor(Date.now() / 1000);
        var rem = 30 - (sec % 30);
        var step = Math.floor(sec / 30);
        var secret = document.getElementById('totp-secret').value.trim() || 'VANHUNG';
        var hash = 0;
        for (var i = 0; i < secret.length; i++) {
          hash = ((hash << 5) - hash + secret.charCodeAt(i) + step * 31) | 0;
        }
        var code = String(Math.abs(hash) % 1000000).padStart(6, '0');
        document.getElementById('totp-code').textContent = code.slice(0, 3) + ' ' + code.slice(3);
        document.getElementById('totp-timer').textContent = rem + 's';
        document.getElementById('totp-progress').style.width = ((rem / 30) * 100) + '%';
      }
      document.getElementById('totp-secret').addEventListener('input', update2FA);
      document.getElementById('copy-totp-btn').addEventListener('click', function () {
        copyText(document.getElementById('totp-code').textContent.replace(/\s/g, ''));
      });
      setInterval(update2FA, 1000);

      var apiSnippets = API_SNIPPETS;

      function showApiCode(lang) {
        activeApiLang = lang;
        document.getElementById('api-code-box').textContent = apiSnippets[lang];
        document.querySelectorAll('.api-lang-btn').forEach(function (b) {
          var active = b.getAttribute('data-api-lang') === lang;
          b.style.background = active ? 'var(--accent-indigo)' : 'var(--bg-secondary)';
          b.style.color = active ? '#FFFFFF' : 'var(--text-muted)';
        });
      }
      document.querySelectorAll('.api-lang-btn').forEach(function (b) {
        b.addEventListener('click', function () { showApiCode(b.getAttribute('data-api-lang')); });
      });
      document.getElementById('copy-api-btn').addEventListener('click', function () {
        copyText(apiSnippets[activeApiLang]);
      });

      /* -----------------------------------------------------------------------
         10. ADMIN PANEL
         ----------------------------------------------------------------------- */
      function renderAdmin() {
        var rev = orders.reduce(function (s, o) { return s + o.total; }, 0);
        var totalStock = products.reduce(function (s, p) { return s + p.stock; }, 0);
        document.getElementById('admin-revenue').textContent = fmt(rev);
        document.getElementById('admin-prod-count').textContent = products.length;
        document.getElementById('admin-order-count').textContent = orders.length;
        document.getElementById('admin-total-stock').textContent = totalStock.toLocaleString('vi-VN');

        document.getElementById('admin-stock-tbody').innerHTML = products.map(function (p) {
          return '<tr class="mmo-row" style="border-bottom:1px solid var(--border-subtle);">' +
            '<td class="p-3.5 font-medium">' + p.name + '</td>' +
            '<td class="p-3.5 font-mono-code text-xs" style="color:var(--accent-cyan);">' + p.cat + '</td>' +
            '<td class="p-3.5 font-mono-code">' + fmt(p.price) + '</td>' +
            '<td class="p-3.5 font-mono-code font-bold" style="color:var(--accent-emerald);">' + p.stock.toLocaleString('vi-VN') + '</td>' +
            '<td class="p-3.5 text-right whitespace-nowrap space-x-1.5">' +
              '<button type="button" data-restock-id="' + p.id + '" class="btn-cyber px-3 py-1 rounded-lg text-xs font-bold border-0" style="background:rgba(16,185,129,0.16);color:var(--accent-emerald);">+100 Kho</button>' +
              '<button type="button" data-delete-id="' + p.id + '" class="btn-cyber px-2.5 py-1 rounded-lg text-xs font-semibold border-0" style="background:rgba(244,63,94,0.14);color:var(--accent-rose);">Xóa</button>' +
            '</td>' +
          '</tr>';
        }).join('');
      }

      document.getElementById('admin-stock-tbody').addEventListener('click', function (e) {
        var restockBtn = e.target.closest('[data-restock-id]');
        if (restockBtn) {
          var id = parseInt(restockBtn.getAttribute('data-restock-id'), 10);
          var p = products.find(function (x) { return x.id === id; });
          if (p) {
            p.stock += 100;
            renderAdmin();
            renderProducts();
            toast('Đã nạp thêm +100 tồn kho cho "' + p.name + '"');
          }
          return;
        }
        var delBtn = e.target.closest('[data-delete-id]');
        if (delBtn) {
          var delId = parseInt(delBtn.getAttribute('data-delete-id'), 10);
          products = products.filter(function (x) { return x.id !== delId; });
          renderCategories();
          renderProducts();
          renderAdmin();
          toast('Đã xóa sản phẩm khỏi gian hàng.');
        }
      });

      document.getElementById('admin-add-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var name = document.getElementById('adm-name').value.trim();
        var cat = document.getElementById('adm-cat').value;
        var price = parseInt(document.getElementById('adm-price').value, 10);
        var stock = parseInt(document.getElementById('adm-stock').value, 10);
        var warranty = document.getElementById('adm-warranty').value.trim() || '24h Login';
        if (!name || !price || !stock) {
          toast('Vui lòng nhập đầy đủ thông tin sản phẩm!', true);
          return;
        }
        products.unshift({
          id: Date.now(),
          cat: cat,
          name: name,
          price: price,
          stock: stock,
          badge: 'NEW',
          country: 'VN',
          warranty: warranty,
          format: cat === 'PROXY' ? 'ip:port:user:pass' : 'user|pass|2fa'
        });
        e.target.reset();
        document.getElementById('adm-warranty').value = '30 ngày';
        renderCategories();
        renderProducts();
        renderAdmin();
        toast('Đã đăng bán sản phẩm mới lên gian hàng!');
      });

      /* -----------------------------------------------------------------------
         11. KEYBOARD SHORTCUTS (CTRL+K & ESCAPE)
         ----------------------------------------------------------------------- */
      document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          switchTab('store');
          document.getElementById('search-input').focus();
        }
        if (e.key === 'Escape') {
          closeBuyModal();
          closeDepositModal();
          agencyModal.classList.add('hidden');
        }
      });

      /* -----------------------------------------------------------------------
         12. INIT
         ----------------------------------------------------------------------- */
      updateWalletUI();
      renderCategories();
      setViewMode('table');
      switchTab('store');
      showApiCode('curl');
      update2FA();
    })();
