// src/types/events.ts
export type MovementType =
  | 'adjust'
  | 'in'
  | 'out'
  | 'transfer_in'
  | 'transfer_out';

export type EventTypeString =
  | 'stock.received'
  | 'stock.issued'
  | 'stock.adjustment'
  | 'stock.transfer.in'
  | 'stock.transfer.out'
  | 'order.requested'
  | 'order.approved'
  | 'order.rejected'
  | 'order.shipped'
  | 'order.received'
  | 'order.cancelled';

/** ใช้เป็น single source of truth เวลาจาก movement.type ไปเป็น eventType */
export const mapStockTypeToEvent = (t: MovementType): EventTypeString => {
  switch (t) {
    case 'in':
      return 'stock.received';
    case 'out':
      return 'stock.issued';
    case 'adjust':
      return 'stock.adjustment';
    case 'transfer_in':
      return 'stock.transfer.in';
    case 'transfer_out':
      return 'stock.transfer.out';
    default:
      return 'stock.adjustment';
  }
};
