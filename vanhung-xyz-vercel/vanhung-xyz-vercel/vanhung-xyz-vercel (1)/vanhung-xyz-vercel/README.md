# VANHUNG.XYZ v2.0 — Full-Stack GitHub + Vercel Edition

Gói mã nguồn đầy đủ gồm **Frontend (Vite)** và **Backend Serverless API (Vercel Functions + PostgreSQL Row-Level Locking)** cho hệ thống bán tài nguyên MMO & AI tự động.

## Tính năng mới ở bản v2.0

1. **Mở đầu Đăng nhập & Đăng ký khách hàng:** Mỗi tài khoản tự động được cấp `USER_ID` định danh duy nhất (VD: `VH 10482`), lưu số dư, đơn hàng và lịch sử biến động số dư riêng.
2. **3.3 Luồng Mua Hàng & Giao Hàng Tự Động:**
   - **Quick Buy Modal:** Tự giới hạn số lượng theo tồn kho thực, kiểm tra mã giảm giá (`VANHUNG10`, `MMO2026`, `NEWUSER50K`), hiển thị đầy đủ Đơn giá, Giảm giá, Tổng thanh toán và Số dư hiện tại.
   - **Backend Transaction + Row-Level Locking (`api/orders/purchase.js` & `sql/schema.sql`):** Dùng `SELECT ... FOR UPDATE` trên bảng `users` và `SELECT ... FOR UPDATE SKIP LOCKED` trên bảng `stock_items` để chống tuyệt đối lỗi bán vượt tồn kho hoặc trừ âm số dư khi nhiều người mua cùng lúc.
   - **Chi tiết đơn hàng & Bảo hành:** Trừ ví, ghi nhận vào bảng **Biến động số dư**, chuyển ngay sang Modal Chi tiết đơn hàng có nút **Sao chép tất cả**, **Tải file `.txt`** và **Yêu cầu bảo hành**.
3. **3.4 Hệ Thống Nạp Tiền Đa Kênh (`/deposit`):**
   - **Tab 1 — Chuyển khoản Ngân hàng (VietQR):** Chọn ngân hàng (MB, VCB, TCB, ACB), nhập số tiền, tự động sinh mã QR chuẩn VietQR kèm Số tài khoản, Chủ tài khoản và Nội dung chuyển khoản duy nhất `VH <USER_ID>`.
   - **Tab 2 & 3:** Ví điện tử (MoMo/ZaloPay) và Crypto (USDT TRC20/BEP20).

## Cách cập nhật lên GitHub & Vercel

1. Giải nén `vanhung-xyz-vercel.zip` và ghi đè vào repo GitHub hiện tại, sau đó `git add . && git commit -m "v2.0: Auth, Quick Buy Row-Lock, Multi-Channel Deposit" && git push`.
2. Vercel tự động build lại và cập nhật lên `https://vanhung.xyz`.
3. Khi muốn nối cơ sở dữ liệu PostgreSQL thật (Neon / Supabase), chạy `sql/schema.sql` và thêm biến môi trường `DATABASE_URL`, `SEPAY_API_KEY` trong **Vercel → Settings → Environment Variables**.
