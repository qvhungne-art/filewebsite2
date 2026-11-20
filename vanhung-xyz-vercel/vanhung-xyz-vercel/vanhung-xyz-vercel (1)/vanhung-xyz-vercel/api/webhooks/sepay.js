import pg from 'pg';

const { Pool } = pg;
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

/**
 * POST /api/webhooks/sepay
 * Tự động phân tích nội dung chuyển khoản dạng "VH <USER_ID>" và cộng ví bằng Transaction.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (process.env.SEPAY_API_KEY && req.headers.authorization !== `Apikey ${process.env.SEPAY_API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized Webhook' });
  }
  if (!pool) return res.status(503).json({ error: 'DATABASE_URL chưa được cấu hình.' });

  const { content, transferAmount, referenceCode } = req.body || {};
  const match = String(content || '').toUpperCase().match(/VH\s*(\d+)/);
  const amount = parseInt(transferAmount, 10);
  if (!match || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Không nhận diện được mã nạp VH <USER_ID> hoặc số tiền.' });
  }

  const userId = parseInt(match[1], 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const uRes = await client.query('SELECT id, balance, total_deposited FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!uRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User ID không tồn tại.' });
    }
    const u = uRes.rows[0];
    const newBal = Number(u.balance) + amount;
    const newDep = Number(u.total_deposited) + amount;

    await client.query('UPDATE users SET balance = $1, total_deposited = $2 WHERE id = $3', [newBal, newDep, userId]);
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_code, description)
       VALUES ($1, 'DEPOSIT', $2, $3, $4, $5, $6)`,
      [userId, amount, u.balance, newBal, referenceCode || `SEPAY-${Date.now()}`, `Nạp tự động VietQR · VH ${userId}`]
    );
    await client.query('COMMIT');
    return res.status(200).json({ status: 'credited', userId, amount, balanceAfter: newBal });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Lỗi xử lý webhook SePay.' });
  } finally {
    client.release();
  }
}
