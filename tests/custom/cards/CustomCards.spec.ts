import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {Resource} from '@/common/Resource';
import {instantiateCustomCard, CustomActiveCard, CustomActiveCorporation, CustomPrelude, CustomProjectCard} from '@/server/custom/cards/CustomCards';
import {CustomColony} from '@/server/custom/cards/CustomColony';
import {IGame} from '@/server/IGame';
import {Research} from '@/server/cards/base/Research';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';
import {greenhouseGrid, marsCoop, microbeVat, outpostColony, seedBank} from './fixtures';
import {cast} from '@/common/utils/utils';
import {IPreludeCard} from '@/server/cards/prelude/IPreludeCard';

describe('workshop cards in play', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2);
    player.megaCredits = 50;
  });

  it('a project card is gated by its requirements and applies its effect', () => {
    const card = cast(instantiateCustomCard(greenhouseGrid()), CustomProjectCard);
    expect(card.name).eq('Greenhouse Grid');
    expect(card.cost).eq(10);
    expect(card.tags).deep.eq([Tag.BUILDING, Tag.PLANT]);
    player.cardsInHand.push(card);
    expect(card.canPlay(player)).is.false;
    player.playedCards.push(new Research());
    expect(card.canPlay(player)).is.true;
    const tr = player.terraformRating;
    player.playCard(card);
    runAllActions(game);
    expect(player.production.megacredits).eq(2);
    expect(player.terraformRating).eq(tr + 1);
    expect(card.getVictoryPoints(player)).eq(1);
    expect(player.tableau.has('Greenhouse Grid' as CardName)).is.true;
  });

  it('an active card has a once-per-generation action with a price, and scaling VP', () => {
    const card = cast(instantiateCustomCard(microbeVat()), CustomActiveCard);
    player.playCard(card);
    runAllActions(game);
    expect(card.resourceCount).eq(2);
    expect(card.canAct(player)).is.true;
    player.megaCredits = 0;
    card.action(player);
    runAllActions(game);
    expect(card.resourceCount).eq(1);
    expect(player.megaCredits).eq(2);
    expect(player.getPlayableActionCards().map((c) => c.name)).contains('Microbe Vat');
    player.actionsThisGeneration.add('Microbe Vat' as CardName);
    expect(player.getPlayableActionCards().map((c) => c.name)).not.contains('Microbe Vat');
    card.resourceCount = 0;
    expect(card.canAct(player)).is.false;
    card.resourceCount = 5;
    expect(card.getVictoryPoints(player)).eq(2);
  });

  it('a corporation starts with money, applies its effect and has an action', () => {
    const corp = cast(instantiateCustomCard(marsCoop()), CustomActiveCorporation);
    expect(corp.startingMegaCredits).eq(45);
    player.megaCredits = 0;
    player.playCorporationCard(corp);
    runAllActions(game);
    expect(player.megaCredits).eq(45);
    expect(player.production.plants).eq(1);
    expect(corp.canAct(player)).is.true;
    corp.action(player);
    runAllActions(game);
    expect(player.plants).eq(1);
  });

  it('a prelude plays from the prelude hand', () => {
    const prelude = cast(instantiateCustomCard(seedBank()), CustomPrelude) as CustomPrelude & IPreludeCard;
    player.preludeCardsInHand.push(prelude);
    player.playCard(prelude);
    runAllActions(game);
    expect(player.plants).eq(8);
    expect(player.production.plants).eq(2);
    expect(player.preludeCardsInHand).is.empty;
    expect(player.playedCards.preludes().map((c) => c.name)).deep.eq(['Seed Bank']);
  });

  it('an active kind without an action becomes a plain card', () => {
    const card = instantiateCustomCard(microbeVat({action: undefined}));
    expect(card).instanceOf(CustomProjectCard);
    expect((card as any).canAct).is.undefined;
  });

  it('a colony pays its bonuses', () => {
    const [colonyGame, alice, bob] = testGame(2, {coloniesExtension: true});
    const colony = new CustomColony(outpostColony());
    expect(colony.name).eq('Outpost');
    expect(colony.metadata.module).eq('custom');
    colony.addColony(alice);
    runAllActions(colonyGame);
    expect(alice.production.steel).eq(1);
    colony.trackPosition = 4;
    colony.trade(bob);
    runAllActions(colonyGame);
    expect(bob.titanium).eq(2);
    expect(alice.steel).eq(2);
    expect(bob.production.steel).eq(0);
    expect(colony.metadata.build.description).contains('steel production');
  });

  it('rejects instantiating a colony as a card', () => {
    expect(() => instantiateCustomCard(outpostColony())).throws('colony');
    expect(() => new CustomColony(greenhouseGrid())).throws('no colony definition');
    expect(player.production.get(Resource.STEEL)).eq(0);
  });
});
