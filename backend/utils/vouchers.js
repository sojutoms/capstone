// Computes the peso discount a voucher grants against a given subtotal.
//
// Two voucher shapes exist:
//   - Percentage vouchers (admin/promo): discountPercent > 0, maxDiscount is
//     an optional cap on the computed percentage discount.
//   - Flat-amount vouchers (loyalty points redemption — see redeemPoints in
//     userController.js): created with discountPercent: 0 and maxDiscount
//     set to the actual peso value. discountPercent === 0 never means a real
//     "0% off" voucher — it's the flat-voucher marker — so maxDiscount IS the
//     discount here, not a cap on one.
function computeVoucherDiscount(voucher, subtotal) {
  const isFlatVoucher = !voucher.discountPercent || voucher.discountPercent <= 0;
  const raw = isFlatVoucher
    ? Number(voucher.maxDiscount || 0)
    : (subtotal * voucher.discountPercent) / 100;
  const capped = !isFlatVoucher && voucher.maxDiscount > 0 ? Math.min(raw, voucher.maxDiscount) : raw;
  return Math.max(0, Math.min(subtotal, Math.round(capped * 100) / 100));
}

module.exports = { computeVoucherDiscount };
