import { charge } from './payments';

/**
 * Completes an order and charges the customer.
 * TODO: support partial refunds
 */
export async function checkout(order: Order, user: User) {
  // ! Prices are in cents — never pass floats here
  const total = order.items.reduce((sum, i) => sum + i.price * i.qty, 0);

  // ? Should guests be able to check out without an account
  if (!user.verified) throw new Error('unverified');

  // * Idempotency key prevents double charges on retries
  const key = `${order.id}:${user.id}`;

  // FIXME: tax is calculated before discounts are applied
  const tax = Math.round(total * 0.17);

  // // const legacyTotal = computeLegacy(order);
  // HACK: wait for the inventory service to settle
  await sleep(250);

  return charge(user, total + tax, { idempotencyKey: key });
}
