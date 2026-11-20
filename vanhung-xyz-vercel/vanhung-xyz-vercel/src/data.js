/**
 * VANHUNG.XYZ — Dữ liệu danh mục, sản phẩm & tài liệu API
 * Chỉnh sửa tệp này để cập nhật sản phẩm, giá bán, tồn kho hoặc snippet API.
 */

export const INITIAL_PRODUCTS = [
        { id: 1, cat: 'AI', name: 'ChatGPT Plus Private (Cấp riêng 1 Tháng - Bảo hành Full)', price: 145000, stock: 84, badge: 'HOT', country: 'US', warranty: '30 ngày', format: 'email|pass|2fa' },
        { id: 2, cat: 'AI', name: 'Claude Pro 3.7 Sonnet (Tài khoản chính chủ, không chung)', price: 320000, stock: 26, badge: 'VIP', country: 'US', warranty: '30 ngày', format: 'email|pass' },
        { id: 3, cat: 'AI', name: 'Cursor Pro 14 Ngày / 1 Tháng (Fast Request Full)', price: 110000, stock: 52, badge: 'NEW', country: 'US', warranty: '14 ngày', format: 'email|pass' },
        { id: 4, cat: 'FB', name: 'Via Việt XMDT Cổ 2015-2020 (Đã bật 2FA, bao đổi pass)', price: 75000, stock: 310, badge: 'HOT', country: 'VN', warranty: '24h Login', format: 'uid|pass|2fa|mail|passmail' },
        { id: 5, cat: 'FB', name: 'Via Phi Kháng 902 Limit 5m8 (Chạy Ads siêu khỏe)', price: 165000, stock: 95, badge: 'ADS', country: 'PH', warranty: '24h Login', format: 'uid|pass|2fa|cookie' },
        { id: 6, cat: 'FB', name: 'Clone Việt NVR Tương Tác Thật (Reg Phone sạch)', price: 6500, stock: 2450, badge: '', country: 'VN', warranty: 'Check Live', format: 'uid|pass|2fa' },
        { id: 7, cat: 'MAIL', name: 'Gmail Cổ 2014-2018 (Trust cao, đã ngâm IP sạch)', price: 18000, stock: 1280, badge: 'HOT', country: 'US', warranty: '48h Login', format: 'mail|pass|recovery' },
        { id: 8, cat: 'MAIL', name: 'Hotmail / Outlook Live (Mở sẵn IMAP/POP3 đọc OTP)', price: 1200, stock: 6800, badge: '', country: 'GL', warranty: 'Check Live', format: 'mail|pass|refresh_token' },
        { id: 9, cat: 'PROXY', name: 'Proxy Dân Cư Việt Nam Private (IPv4 Tĩnh 30 Ngày)', price: 35000, stock: 420, badge: 'FAST', country: 'VN', warranty: '30 ngày', format: 'ip:port:user:pass' },
        { id: 10, cat: 'PROXY', name: 'Proxy ISP US Tĩnh (Sạch 100% nuôi Ebay / Etsy / TikTok)', price: 55000, stock: 190, badge: 'CLEAN', country: 'US', warranty: '30 ngày', format: 'ip:port:user:pass' }
      ];

export const CATEGORIES = [
        { key: 'ALL', label: 'Tất cả' },
        { key: 'AI', label: 'Tài khoản AI' },
        { key: 'FB', label: 'Via & Clone FB' },
        { key: 'MAIL', label: 'Gmail & Mail Cổ' },
        { key: 'PROXY', label: 'Proxy & VPS' }
      ];

export const API_SNIPPETS = {
        curl: 'curl -X POST https://vanhung.xyz/api/v1/orders/create \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"product_id": 1, "quantity": 5}\'',
        node: 'const res = await fetch("https://vanhung.xyz/api/v1/orders/create", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer YOUR_API_KEY",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({ product_id: 1, quantity: 5 })\n});\nconsole.log(await res.json());',
        python: 'import requests\nr = requests.post(\n  "https://vanhung.xyz/api/v1/orders/create",\n  headers={"Authorization": "Bearer YOUR_API_KEY"},\n  json={"product_id": 1, "quantity": 5}\n)\nprint(r.json())'
      };
