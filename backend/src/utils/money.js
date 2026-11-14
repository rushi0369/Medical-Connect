import { AppError } from './AppError.js';

/**
 * Works out every total on a bill from the line items. Totals sent by a browser
 * are never trusted: they are always recalculated here, in whole paise.
 */
export function calculateBill({ lineItems, discountPaise = 0, taxPaise = 0, deliveryChargePaise = 0 }) {
  const lines = lineItems.map((item) => ({ ...item, lineTotalPaise: item.quantity * item.unitPricePaise }));
  const subtotalPaise = lines.reduce((sum, item) => sum + item.lineTotalPaise, 0);
  const grandTotalPaise = subtotalPaise - discountPaise + taxPaise + deliveryChargePaise;

  if (discountPaise > subtotalPaise) {
    throw new AppError(422, 'VALIDATION_ERROR', 'The discount cannot be more than the medicines subtotal.', {
      fieldErrors: { discountPaise: ['The discount cannot be more than the medicines subtotal.'] },
    });
  }

  return { lineItems: lines, subtotalPaise, discountPaise, taxPaise, deliveryChargePaise, grandTotalPaise };
}

/** Formats paise for documents such as the PDF invoice. */
export function formatRupees(paise) {
  return `Rs. ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
