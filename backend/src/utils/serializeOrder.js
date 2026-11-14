import {
  ACTIVE_DELIVERY_STATUSES,
  CUSTOMER_CANCELLABLE_STATUSES,
  INVOICE_STATUS,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  ROLES,
} from '../config/constants.js';

const idOf = (value) => (value ? String(value._id ?? value) : null);

export function serializeInvoice(invoice) {
  if (!invoice) return null;
  return {
    id: invoice.id,
    orderId: idOf(invoice.order),
    version: invoice.version,
    status: invoice.status,
    lineItems: invoice.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      lineTotalPaise: item.lineTotalPaise,
      isSubstitute: item.isSubstitute,
      substituteFor: item.substituteFor ?? null,
    })),
    subtotalPaise: invoice.subtotalPaise,
    discountPaise: invoice.discountPaise,
    taxPaise: invoice.taxPaise,
    deliveryChargePaise: invoice.deliveryChargePaise,
    grandTotalPaise: invoice.grandTotalPaise,
    deliveryDistanceKm: invoice.deliveryDistanceKm ?? null,
    deliveryDurationMinutes: invoice.deliveryDurationMinutes ?? null,
    isDeliveryChargeOverridden: invoice.isDeliveryChargeOverridden,
    remarks: invoice.remarks ?? null,
    rejectionReason: invoice.rejectionReason ?? null,
    createdAt: invoice.createdAt,
    sentAt: invoice.sentAt ?? null,
    approvedAt: invoice.approvedAt ?? null,
    rejectedAt: invoice.rejectedAt ?? null,
  };
}

export function serializePayment(payment, { viewerRole } = {}) {
  if (!payment) return null;
  const isOpen = [PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.PENDING].includes(payment.status);
  return {
    id: payment.id,
    method: payment.method,
    status: payment.status,
    amountPaise: payment.amountPaise,
    paymentReference: payment.paymentReference ?? null,
    paidAt: payment.paidAt ?? null,
    collectedAt: payment.collectedAt ?? null,
    collectedAmountPaise: payment.collectedAmountPaise ?? null,
    collectedBy: payment.collectedBy?.fullName
      ? { id: idOf(payment.collectedBy), fullName: payment.collectedBy.fullName }
      : null,
    settlementStatus: payment.settlementStatus,
    settledAt: payment.settledAt ?? null,
    refundReference: payment.refundReference ?? null,
    refundedAt: payment.refundedAt ?? null,
    hasUpiLink: Boolean(payment.gatewayLinkId),
    // Only the customer needs the payment link, and only while the payment is open.
    upiLinkUrl: viewerRole === ROLES.CUSTOMER && isOpen ? (payment.gatewayLinkUrl ?? null) : null,
    createdAt: payment.createdAt,
  };
}

export function serializeDelivery(delivery, { events } = {}) {
  if (!delivery) return null;
  const rider = delivery.rider;
  return {
    id: delivery.id,
    orderId: idOf(delivery.order),
    status: delivery.status,
    isCurrent: delivery.isCurrent,
    rider: rider?.fullName
      ? { id: idOf(rider), fullName: rider.fullName, phone: rider.phone, riderId: rider.riderProfile?.riderId ?? null }
      : null,
    assignedAt: delivery.assignedAt,
    outForDeliveryAt: delivery.outForDeliveryAt ?? null,
    reachedAt: delivery.reachedAt ?? null,
    deliveredAt: delivery.deliveredAt ?? null,
    failedAt: delivery.failedAt ?? null,
    failureReason: delivery.failureReason ?? null,
    failureNotes: delivery.failureNotes ?? null,
    events: events?.map((event) => ({
      status: event.status,
      actorRole: event.actorRole,
      note: event.note ?? null,
      at: event.createdAt,
    })),
  };
}

export function serializeAddress(address) {
  if (!address) return null;
  return {
    fullAddress: address.fullAddress,
    area: address.area,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    location: address.location?.lat != null ? { lat: address.location.lat, lng: address.location.lng } : null,
    deliveryInstructions: address.deliveryInstructions ?? null,
  };
}

/** One row in an order list. */
export function serializeOrderSummary(order, { viewerRole, invoice, payment, delivery } = {}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customer:
      viewerRole === ROLES.ADMIN && order.customer?.fullName
        ? { id: idOf(order.customer), fullName: order.customer.fullName, phone: order.customer.phone }
        : null,
    photoCount: order.requestPhotos.length,
    itemCount: order.requestedItems.length,
    grandTotalPaise: invoice && invoice.status !== INVOICE_STATUS.DRAFT ? invoice.grandTotalPaise : null,
    paymentMethod: payment?.method ?? null,
    paymentStatus: payment?.status ?? null,
    riderName: delivery?.rider?.fullName ?? null,
  };
}

/**
 * What the viewer may do next. The backend still checks every action itself; this
 * only lets the screens show the right buttons.
 */
function allowedActions(order, { viewerRole, latestInvoice, payment, upiAvailable }) {
  const status = order.status;
  const openPayment = payment && [PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.PENDING].includes(payment.status);
  const beforeDispatch = [ORDER_STATUS.CONFIRMED, ORDER_STATUS.RIDER_ASSIGNED].includes(status);

  if (viewerRole === ROLES.CUSTOMER) {
    return {
      canCancel: CUSTOMER_CANCELLABLE_STATUSES.includes(status),
      canRespondToInvoice:
        status === ORDER_STATUS.WAITING_FOR_CUSTOMER_APPROVAL && latestInvoice?.status === INVOICE_STATUS.SENT,
      canChangePaymentMethod: Boolean(openPayment && beforeDispatch),
      canPayByUpi: Boolean(
        openPayment &&
          payment.method === PAYMENT_METHOD.UPI &&
          upiAvailable &&
          status !== ORDER_STATUS.CANCELLED &&
          status !== ORDER_STATUS.DELIVERED,
      ),
      canCheckPayment: Boolean(openPayment && payment.gatewayLinkId),
      canReorder: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED].includes(status),
    };
  }

  if (viewerRole === ROLES.ADMIN) {
    const latest = latestInvoice?.status;
    return {
      canStartReview: status === ORDER_STATUS.PENDING_ADMIN_REVIEW,
      canEditReview: status === ORDER_STATUS.UNDER_REVIEW,
      canEditBill: status === ORDER_STATUS.UNDER_REVIEW && latest !== INVOICE_STATUS.SENT,
      canSendInvoice: status === ORDER_STATUS.UNDER_REVIEW && latest === INVOICE_STATUS.DRAFT,
      canWithdrawInvoice: status === ORDER_STATUS.WAITING_FOR_CUSTOMER_APPROVAL && latest === INVOICE_STATUS.SENT,
      canAssignRider: status === ORDER_STATUS.CONFIRMED,
      canReassignRider: [
        ORDER_STATUS.RIDER_ASSIGNED,
        ORDER_STATUS.OUT_FOR_DELIVERY,
        ORDER_STATUS.REACHED_CUSTOMER,
        ORDER_STATUS.DELIVERY_FAILED,
      ].includes(status),
      canCancel: ![ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED].includes(status),
      canCheckPayment: Boolean(openPayment && payment.gatewayLinkId),
    };
  }

  return {};
}

/** The full order page, shaped for the person viewing it. */
export function serializeOrderDetail(order, { viewerRole, invoices = [], payment, deliveries = [], eventsByDelivery, upiAvailable }) {
  // Customers never see a bill the admin is still preparing.
  const visibleInvoices =
    viewerRole === ROLES.ADMIN ? invoices : invoices.filter((invoice) => invoice.status !== INVOICE_STATUS.DRAFT);
  const latestInvoice = invoices[0] ?? null;
  const currentInvoice = visibleInvoices[0] ?? null;
  const currentDelivery = deliveries.find((delivery) => delivery.isCurrent) ?? null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customer: order.customer?.fullName
      ? {
          id: idOf(order.customer),
          fullName: order.customer.fullName,
          phone: order.customer.phone,
          email: order.customer.email ?? null,
        }
      : null,
    address: serializeAddress(order.addressSnapshot),
    photos: order.requestPhotos.map((photo) => ({ id: photo.storageKey, name: photo.originalName ?? null })),
    requestedItems: order.requestedItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      notes: item.notes ?? null,
      isUnavailable: item.isUnavailable,
      alternativeNote: item.alternativeNote ?? null,
    })),
    customerInstructions: order.customerInstructions ?? null,
    adminRemarks: order.adminRemarks ?? null,
    statusHistory: order.statusHistory.map((entry) => ({
      status: entry.status,
      actorRole: entry.actorRole,
      note: entry.note ?? null,
      at: entry.at,
    })),
    invoice: serializeInvoice(currentInvoice),
    invoices: visibleInvoices.map(serializeInvoice),
    payment: serializePayment(payment, { viewerRole }),
    delivery: serializeDelivery(currentDelivery),
    deliveries:
      viewerRole === ROLES.ADMIN
        ? deliveries.map((delivery) => serializeDelivery(delivery, { events: eventsByDelivery?.get(delivery.id) ?? [] }))
        : [],
    cancellation: order.cancellation
      ? { reason: order.cancellation.reason ?? null, byRole: order.cancellation.byRole, at: order.cancellation.at }
      : null,
    isDeliveryActive: Boolean(currentDelivery && ACTIVE_DELIVERY_STATUSES.includes(currentDelivery.status)),
    allowedActions: allowedActions(order, { viewerRole, latestInvoice, payment, upiAvailable }),
  };
}
