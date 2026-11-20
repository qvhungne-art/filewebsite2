const DEFAULT_COUPONS = {
  VANHUNG10: { type: 'PERCENT', value: 10, minOrder: 0, label: 'Giảm 10% toàn đơn' },
  MMO2026: { type: 'PERCENT', value: 15, minOrder: 100000, label: 'Mã VIP giảm 15%' },
  NEWUSER50K: { type: 'FIXED', value: 50000, minOrder: 200000, label: 'Giảm thẳng 50.000đ' }
};

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { code, orderAmount } = req.body || {};
  const key = String(code || '').trim().toUpperCase();
  const coupon = DEFAULT_COUPONS[key];
  if (!coupon) return res.status(404).json({ valid: false, error: 'Mã giảm giá không hợp lệ.' });
  if (Number(orderAmount || 0) < coupon.minOrder) {
    return res.status(400).json({ valid: false, error: `Đơn tối thiểu ${coupon.minOrder.toLocaleString('vi-VN')}đ.` });
  }
  return res.status(200).json({ valid: true, code: key, ...coupon });
}
