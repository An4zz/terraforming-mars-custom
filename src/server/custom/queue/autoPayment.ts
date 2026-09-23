import {Payment} from '@/common/inputs/Payment';
import {IPlayer} from '@/server/IPlayer';

export type AutoPaymentOptions = {
  steel?: boolean;
  titanium?: boolean;
};

/**
 * Chooses how to pay `cost`: megacredits first, then steel and titanium where allowed.
 *
 * Returns `undefined` when the player cannot cover the cost that way. Heat, plants and card
 * resources are never spent automatically.
 */
export function autoPayment(player: IPlayer, cost: number, options: AutoPaymentOptions = {}): Payment | undefined {
  const payment = {...Payment.EMPTY};
  let remaining = Math.max(0, cost);
  payment.megacredits = Math.min(player.megaCredits, remaining);
  remaining -= payment.megacredits;
  if (remaining > 0 && options.steel === true && player.steel > 0) {
    const value = player.getSteelValue();
    payment.steel = Math.min(player.steel, Math.ceil(remaining / value));
    remaining -= payment.steel * value;
  }
  if (remaining > 0 && options.titanium === true && player.titanium > 0) {
    const value = player.getTitaniumValue();
    payment.titanium = Math.min(player.titanium, Math.ceil(remaining / value));
    remaining -= payment.titanium * value;
  }
  if (remaining > 0) {
    return undefined;
  }
  // Steel or titanium may have overshot; give back megacredits that are no longer needed.
  const covered = payment.steel * player.getSteelValue() + payment.titanium * player.getTitaniumValue();
  payment.megacredits = Math.max(0, Math.min(payment.megacredits, cost - covered));
  return payment;
}
