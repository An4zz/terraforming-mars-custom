import {expect} from 'chai';
import {autoPayment} from '@/server/custom/queue/autoPayment';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';

describe('autoPayment', () => {
  let player: TestPlayer;

  beforeEach(() => {
    [, player] = testGame(1);
    player.megaCredits = 10;
    player.steel = 4;
    player.titanium = 2;
  });

  it('pays with megacredits alone when they suffice', () => {
    const payment = autoPayment(player, 7, {steel: true, titanium: true});
    expect(payment?.megacredits).eq(7);
    expect(payment?.steel).eq(0);
    expect(payment?.titanium).eq(0);
  });

  it('adds steel for building cards, giving back surplus megacredits', () => {
    const payment = autoPayment(player, 13, {steel: true});
    expect(payment?.steel).eq(2);
    expect(payment?.megacredits).eq(9);
  });

  it('adds titanium for space cards', () => {
    const payment = autoPayment(player, 15, {titanium: true});
    expect(payment?.titanium).eq(2);
    expect(payment?.megacredits).eq(9);
  });

  it('uses both when allowed', () => {
    const payment = autoPayment(player, 23, {steel: true, titanium: true});
    expect(payment?.steel).eq(4);
    expect(payment?.titanium).eq(2);
    expect(payment?.megacredits).eq(9);
  });

  it('refuses when the cost cannot be met', () => {
    expect(autoPayment(player, 11)).is.undefined;
    expect(autoPayment(player, 19, {steel: true})).is.undefined;
    expect(autoPayment(player, 25, {steel: true, titanium: true})).is.undefined;
  });

  it('never spends heat or plants', () => {
    player.heat = 50;
    player.plants = 50;
    expect(autoPayment(player, 11, {steel: false, titanium: false})).is.undefined;
  });

  it('handles a zero cost', () => {
    const payment = autoPayment(player, 0);
    expect(payment?.megacredits).eq(0);
  });
});
