// TODO: retry with exponential backoff on 5xx
export async function charge(user: User, cents: number, opts: ChargeOptions) {
  // BUG: currency is always USD
  return api.post('/charges', { user: user.id, cents, ...opts });
}
