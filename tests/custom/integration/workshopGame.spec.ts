import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {cast, toName} from '@/common/utils/utils';
import {CustomCardRegistry} from '@/server/custom/cards/CustomCardRegistry';
import {MemoryCustomStore} from '@/server/custom/store/MemoryCustomStore';
import {Game} from '@/server/Game';
import {IGame} from '@/server/IGame';
import {SelectInitialCards} from '@/server/inputs/SelectInitialCards';
import {IActionCard} from '@/server/cards/ICard';
import {Research} from '@/server/cards/base/Research';
import {testGame} from '../../TestGame';
import {runAllActions} from '../../TestingUtils';
import {greenhouseGrid, marsCoop, microbeVat, outpostColony, seedBank} from '../cards/fixtures';

/**
 * Workshop cards of every kind in one game: dealt, chosen, played, reloaded, and still working
 * after the workshop forgot them.
 */
describe('workshop game', () => {
  let registry: CustomCardRegistry;

  beforeEach(async () => {
    registry = new CustomCardRegistry(new MemoryCustomStore());
    CustomCardRegistry.setInstance(registry);
    for (const def of [greenhouseGrid(), microbeVat(), marsCoop(), seedBank(), outpostColony()]) {
      await registry.save(def);
    }
  });

  afterEach(() => {
    CustomCardRegistry.setInstance(undefined);
  });

  function allProjectNames(game: IGame): Array<string> {
    return [...game.projectDeck.drawPile, ...game.projectDeck.discardPile].map(toName)
      .concat(game.players.flatMap((p) => p.dealtProjectCards.map(toName)));
  }

  it('puts included workshop cards into the decks and colonies, and leaves the rest out', () => {
    const ids = ['greenhouse-grid', 'microbe-vat', 'mars-coop', 'seed-bank', 'outpost'];
    const [game, alice] = testGame(2, {
      coloniesExtension: true,
      preludeExtension: true,
      customCards: ids,
      customCardDefinitions: registry.definitionsFor(ids),
      customColoniesList: ['Outpost', 'Luna', 'Titan', 'Io', 'Ceres'] as any,
      presetHands: {corporations: ['Mars Co-op' as CardName], preludes: ['Seed Bank' as CardName], projectCards: ['Greenhouse Grid', 'Microbe Vat'] as Array<CardName>},
    });
    const projects = allProjectNames(game);
    expect(projects.filter((n) => n === 'Greenhouse Grid')).has.length(2);
    expect(projects.filter((n) => n === 'Microbe Vat')).has.length(2);
    expect(game.colonies.map(toName)).contains('Outpost');
    expect(alice.dealtCorporationCards[0].name).eq('Mars Co-op');
    expect(alice.dealtPreludeCards[0].name).eq('Seed Bank');

    const [plain] = testGame(2, {coloniesExtension: true, preludeExtension: true}, 'plain');
    expect(allProjectNames(plain)).not.contains('Greenhouse Grid');
    expect(plain.colonies.map(toName)).not.contains('Outpost');
  });

  it('plays through the workshop cards, reloads, and survives the cards being deleted', () => {
    const ids = ['greenhouse-grid', 'microbe-vat', 'mars-coop', 'seed-bank', 'outpost'];
    const [original, alice0] = testGame(2, {
      skipInitialCardSelection: false,
      coloniesExtension: true,
      preludeExtension: true,
      customCards: ids,
      customCardDefinitions: registry.definitionsFor(ids),
      customColoniesList: ['Outpost', 'Luna', 'Titan', 'Io', 'Ceres'] as any,
      presetHands: {corporations: ['Mars Co-op' as CardName], preludes: ['Seed Bank' as CardName], projectCards: ['Greenhouse Grid', 'Microbe Vat'] as Array<CardName>},
    });
    expect(alice0.dealtProjectCards[0].name).eq('Greenhouse Grid');

    let game = Game.deserialize(JSON.parse(JSON.stringify(original.serialize())));
    let alice = game.getPlayerById(alice0.id);
    const bob = game.players.find((p) => p.id !== alice0.id);
    if (bob === undefined) {
      throw new Error('no second player');
    }
    // Corporations enter play once everyone has chosen, so the other player chooses too.
    cast(bob.getWaitingFor(), SelectInitialCards).process({
      type: 'initialCards',
      responses: [
        {type: 'card', cards: [bob.dealtCorporationCards[1].name]},
        {type: 'card', cards: [bob.dealtPreludeCards[1].name, bob.dealtPreludeCards[2].name]},
        {type: 'card', cards: []},
      ],
    }, bob);
    const secondPrelude = alice.dealtPreludeCards[1].name;
    cast(alice.getWaitingFor(), SelectInitialCards).process({
      type: 'initialCards',
      responses: [
        {type: 'card', cards: ['Mars Co-op' as CardName]},
        {type: 'card', cards: ['Seed Bank' as CardName, secondPrelude]},
        {type: 'card', cards: ['Greenhouse Grid', 'Microbe Vat'] as Array<CardName>},
      ],
    }, alice);
    runAllActions(game);
    expect(alice.playedCards.corporations()[0].name).eq('Mars Co-op');
    expect(alice.megaCredits).eq(45 - 6);
    expect(alice.production.plants).eq(1);
    expect(alice.cardsInHand.map(toName)).deep.eq(['Greenhouse Grid', 'Microbe Vat']);

    alice.megaCredits = 50;
    alice.playedCards.push(new Research());
    const grid = alice.cardsInHand[0];
    expect(grid.canPlay(alice)).is.true;
    alice.playCard(grid);
    const vat = alice.cardsInHand[0];
    alice.playCard(vat);
    runAllActions(game);
    expect(alice.production.megacredits).eq(2);
    expect(vat.resourceCount).eq(2);

    // Delete everything from the workshop: the game still restores from its embedded definitions.
    for (const id of ids) {
      registry.unregister(id);
    }
    expect(registry.all()).is.empty;
    game = Game.deserialize(JSON.parse(JSON.stringify(game.serialize())));
    alice = game.getPlayerById(alice0.id);
    const reloadedVat = alice.tableau.get('Microbe Vat' as CardName) as IActionCard & {resourceCount: number};
    expect(reloadedVat.resourceCount).eq(2);
    expect(reloadedVat.canAct(alice)).is.true;
    reloadedVat.action(alice);
    runAllActions(game);
    expect(reloadedVat.resourceCount).eq(1);
    expect(game.colonies.map(toName)).contains('Outpost');
    expect(alice.tableau.corporations()[0].name).eq('Mars Co-op');
    expect(game.gameOptions.customCardDefinitions?.map((d) => d.id)).deep.eq(ids);
  });
});
