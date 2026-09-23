import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {cast} from '@/common/utils/utils';
import {TurnNotifier} from '@/server/custom/discord/TurnNotifier';
import {MemoryCustomStore} from '@/server/custom/store/MemoryCustomStore';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectInitialCards} from '@/server/inputs/SelectInitialCards';
import {SelectCard} from '@/server/inputs/SelectCard';
import {SelectOption} from '@/server/inputs/SelectOption';
import {FakeClock} from '../../common/FakeClock';
import {testGame} from '../../TestGame';
import {runAllActions} from '../../TestingUtils';
import {FakeDiscordClient} from '../discord/FakeDiscordClient';
import {IPlayer} from '@/server/IPlayer';

/**
 * Three players, two of them opted in, from the starting selection through two action rounds.
 * Checks who gets a message and when.
 */
describe('discord turn flow', () => {
  let client: FakeDiscordClient;
  let clock: FakeClock;
  let notifier: TurnNotifier;

  beforeEach(() => {
    client = new FakeDiscordClient();
    clock = new FakeClock();
    notifier = new TurnNotifier(client, clock, new MemoryCustomStore());
    TurnNotifier.setInstance(notifier);
  });

  afterEach(() => {
    TurnNotifier.setInstance(undefined);
  });

  function recipients(): Array<string> {
    const list = client.sent.map((m) => m.userId ?? '?');
    client.sent = [];
    return list;
  }

  function pass(player: IPlayer) {
    const options = cast(player.getWaitingFor(), OrOptions);
    const index = options.options.findIndex((o) => o instanceof SelectOption && o.title === 'Pass for this generation');
    player.process({type: 'or', index, response: {type: 'option'}});
  }

  function pickStartingCards(player: IPlayer) {
    const select = cast(player.getWaitingFor(), SelectInitialCards);
    select.process({
      type: 'initialCards',
      responses: [
        {type: 'card', cards: [player.dealtCorporationCards[0].name]},
        {type: 'card', cards: []},
      ],
    }, player);
  }

  it('notifies on the starting selection, each turn start, and the research phase', async () => {
    const [game, alice, bob, cara] = testGame(3, {skipInitialCardSelection: false});
    await notifier.setOptIn(alice.id, {enabled: true, discordUserId: 'alice', delivery: 'dm'});
    await notifier.setOptIn(bob.id, {enabled: true, discordUserId: 'bob', delivery: 'channel'});
    // The opt-ins arrived after the game started, so re-issue the starting prompts as a reload would.
    for (const p of [alice, bob, cara]) {
      const input = p.getWaitingFor();
      p.clearWaitingFor();
      if (input !== undefined) {
        p.setWaitingFor(input);
      }
    }
    await notifier.flush();
    expect(recipients().sort()).deep.eq(['alice', 'bob']);

    clock.millis += 60_000;
    pickStartingCards(alice);
    clock.millis += 60_000;
    pickStartingCards(bob);
    clock.millis += 60_000;
    pickStartingCards(cara);
    runAllActions(game);
    await notifier.flush();
    expect(game.phase).eq(Phase.ACTION);
    expect(game.activePlayer).eq(alice);
    // Alice starts the action phase; she chose her cards long ago, so she is told.
    expect(recipients()).deep.eq(['alice']);

    clock.millis += 60_000;
    pass(alice);
    runAllActions(game);
    await notifier.flush();
    expect(game.activePlayer).eq(bob);
    expect(recipients()).deep.eq(['bob']);

    clock.millis += 60_000;
    pass(bob);
    runAllActions(game);
    await notifier.flush();
    expect(game.activePlayer).eq(cara);
    expect(recipients()).deep.eq([]);

    clock.millis += 60_000;
    pass(cara);
    runAllActions(game);
    await notifier.flush();
    expect(game.phase).eq(Phase.RESEARCH);
    expect(recipients().sort()).deep.eq(['alice', 'bob']);
    for (const p of [alice, bob]) {
      expect(cast(p.getWaitingFor(), SelectCard).title).contains('Select');
    }
  });

  it('does not notify a player for prompts inside their own turn', async () => {
    const [game, alice, bob] = testGame(2);
    await notifier.setOptIn(bob.id, {enabled: true, discordUserId: 'bob', delivery: 'dm'});
    bob.megaCredits = 50;
    game.activePlayer = alice;
    alice.takeAction();
    clock.millis += 60_000;
    pass(alice);
    runAllActions(game);
    await notifier.flush();
    expect(game.activePlayer).eq(bob);
    expect(recipients()).deep.eq(['bob']);

    clock.millis += 5_000;
    const options = cast(bob.getWaitingFor(), OrOptions);
    const standard = options.options.findIndex((o) => o.type === 'projectCard' && o.title === 'Standard projects');
    bob.process({type: 'or', index: standard, response: {type: 'projectCard', card: CardName.CITY_STANDARD_PROJECT, payment: {...{heat: 0, megacredits: 25, steel: 0, titanium: 0, plants: 0, microbes: 0, floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0, auroraiData: 0, graphene: 0, kuiperAsteroids: 0}}}});
    runAllActions(game);
    await notifier.flush();
    expect(bob.getWaitingFor()?.type).eq('space');
    expect(recipients()).deep.eq([]);
  });
});
