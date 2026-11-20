# VANHUNG.XYZ — Automated Digital Store (GitHub + Vercel Ready)

Mã nguồn hoàn chỉnh chuẩn **Vite + Vercel** cho hệ sinh thái tài nguyên MMO & AI tự động 24/7 **VANHUNG.XYZ**. Chỉ cần đẩy lên GitHub và bấm **Import** trên Vercel là tự động build và deploy.

## Cấu trúc dự án

```text
vanhung-xyz-vercel/
├── index.html                # HTML gốc cho Vite
├── package.json              # Scripts dev/build/preview & Vite 6
├── vite.config.js            # Cấu hình đóng gói dist/
├── vercel.json               # Cấu hình deploy Vercel (framework, rewrite, headers)
├── public/
│   └── logo.svg              # Logo thương hiệu VANHUNG.XYZ
├── src/
│   ├── styles.css            # Design Tokens (Dark/Light), glassmorphism, ticker
│   ├── data.js               # Dữ liệu sản phẩm, danh mục & API snippets
│   └── main.js               # Toàn bộ logic Gian hàng, Ví VietQR, 2FA & Admin
├── .github/workflows/ci.yml  # Tự kiểm tra build khi push lên GitHub
├── .gitignore
├── LICENSE
└── README.md
```

## Chạy thử trên máy cá nhân (Local)

```bash
npm install
npm run dev
```

## Đưa lên GitHub & Deploy tự động qua Vercel

1. Giải nén thư mục `vanhung-xyz-vercel`, mở Terminal bên trong thư mục đó và đẩy lên GitHub:

```bash
git init
git add .
git commit -m "Initial commit: VANHUNG.XYZ Store"
git branch -M main
git remote add origin https://github.com/<ten-github>/<ten-repo>.git
git push -u origin main
```

2. Đăng nhập [Vercel](https://vercel.com) → chọn **Add New… → Project** → chọn repository vừa tạo.
3. Vercel tự nhận diện `vercel.json` (`Framework: Vite`, `Build Command: npm run build`, `Output Directory: dist`). Bấm **Deploy** là hoàn tất.
