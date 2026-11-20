import pg from 'pg';

const { Pool } = pg;
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

/**
 * POST /api/orders/purchase
 * Xử lý mua hàng tự động bằng PostgreSQL Transaction + Row-Level Locking:
 * - SELECT ... FOR UPDATE trên bảng users (chống trừ âm số dư khi mua đồng thời)
 * - SELECT ... FOR UPDATE SKIP LOCKED trên bảng stock_items (chống bán trùng / vượt tồn kho)
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!pool) {
    return res.status(503).json({ error: 'Chưa cấu hình DATABASE_URL trong Vercel Environment Variables.' });
  }

  const { userId, productId, quantity, couponCode } = req.body || {};
  const qty = parseInt(quantity, 10);
  if (!userId || !productId || !Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ error: 'Tham số userId, productId hoặc quantity không hợp lệ.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Khóa dòng ví người dùng (Row-Level Lock)
    const userRes = await client.query(
      'SELECT id, balance, total_deposited FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (!userRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy tài khoản người dùng.' });
    }
    const user = userRes.rows[0];

    // 2. Lấy thông tin sản phẩm
    const prodRes = await client.query(
      'SELECT id, name, price FROM products WHERE id = $1 AND is_active = TRUE',
      [productId]
    );
    if (!prodRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sản phẩm không tồn tại hoặc đã ngừng bán.' });
    }
    const product = prodRes.rows[0];

    // 3. Khóa đúng N item chưa bán trong kho (FOR UPDATE SKIP LOCKED chống race condition)
    const stockRes = await client.query(
      `SELECT id, payload FROM stock_items
        WHERE product_id = $1 AND status = 'AVAILABLE'
        ORDER BY id ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED`,
      [productId, qty]
    );
    if (stockRes.rows.length < qty) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Tồn kho hiện chỉ còn ${stockRes.rows.length} sản phẩm khả dụng.`
      });
    }

    // 4. Tính chiết khấu hạng + coupon
    const rawTotal = Number(product.price) * qty;
    let discount = 0;
    if (couponCode) {
      const cRes = await client.query(
        `SELECT code, discount_type, discount_value, min_order
           FROM coupons
          WHERE code = $1 AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())`,
        [String(couponCode).trim().toUpperCase()]
      );
      if (cRes.rows.length && rawTotal >= Number(cRes.rows[0].min_order)) {
        const c = cRes.rows[0];
        discount = c.discount_type === 'PERCENT'
          ? Math.round(rawTotal * (Number(c.discount_value) / 100))
          : Number(c.discount_value);
      }
    }
    const finalTotal = Math.max(0, rawTotal - discount);

    if (Number(user.balance) < finalTotal) {
      await client.query('ROLLBACK');
      return res.status(402).json({ error: 'Số dư ví không đủ để thanh toán đơn hàng.' });
    }

    // 5. Trừ số dư ví
    const newBalance = Number(user.balance) - finalTotal;
    await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, user.id]);

    // 6. Tạo đơn hàng
    const orderCode = 'VH-' + Date.now().toString().slice(-6);
    const orderRes = await client.query(
      `INSERT INTO orders (order_code, user_id, product_id, quantity, unit_price, discount_amount, total_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, order_code, created_at`,
      [orderCode, user.id, product.id, qty, product.price, discount, finalTotal]
    );
    const order = orderRes.rows[0];

    // 7. Đánh dấu SOLD và gán từng item vào đơn hàng
    const itemIds = stockRes.rows.map((r) => r.id);
    await client.query(
      `UPDATE stock_items
          SET status = 'SOLD', order_id = $1, sold_at = NOW()
        WHERE id = ANY($2::bigint[])`,
      [order.id, itemIds]
    );

    // 8. Ghi nhận vào bảng Biến động số dư (wallet_transactions)
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_code, description)
       VALUES ($1, 'PURCHASE', $2, $3, $4, $5, $6)`,
      [user.id, -finalTotal, user.balance, newBalance, orderCode, `Mua ${qty}x ${product.name}`]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      status: 'success',
      orderCode: order.order_code,
      totalPaid: finalTotal,
      balanceAfter: newBalance,
      items: stockRes.rows.map((r) => r.payload)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Purchase transaction error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống khi xử lý giao dịch.' });
  } finally {
    client.release();
  }
}
