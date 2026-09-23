import {expect} from 'chai';
import {customColonyImage, loadCustomContent, registerCustomContent} from '@/client/custom/customContent';
import {getCard} from '@/client/cards/ClientCardManifest';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {CardType} from '@/common/cards/CardType';
import {ClientCard} from '@/common/cards/ClientCard';

const CARD: ClientCard = {
  module: 'custom',
  name: 'Greenhouse Grid' as CardName,
  tags: [],
  type: CardType.AUTOMATED,
  cost: 10,
  metadata: {description: 'x', image: 'data:image/png;base64,AAAA'},
  compatibility: [],
  hasAction: false,
};

describe('customContent', () => {
  it('registers cards and colonies with the client manifests', () => {
    registerCustomContent({
      cards: [CARD],
      colonies: [{name: 'Outpost' as ColonyName, module: 'custom', build: {description: 'b', type: 0, quantity: [1, 1, 1]}, trade: {description: 't', type: 0, quantity: [1, 1, 1, 1, 1, 1, 1]}, colony: {description: 'c', type: 0, quantity: 1}, expansion: undefined, shouldIncreaseTrack: 'yes', image: 'data:image/png;base64,BBBB'}],
    });
    expect(getCard('Greenhouse Grid' as CardName)?.metadata.image).eq('data:image/png;base64,AAAA');
    expect(getColony('Outpost' as ColonyName).name).eq('Outpost');
    expect(customColonyImage('Outpost' as ColonyName)).eq('data:image/png;base64,BBBB');
    expect(customColonyImage(ColonyName.LUNA)).is.undefined;
    // Registering again replaces rather than duplicates.
    registerCustomContent({cards: [{...CARD, cost: 12}], colonies: []});
    expect(getCard('Greenhouse Grid' as CardName)?.cost).eq(12);
  });

  it('loads from the server and tolerates failure', async () => {
    await loadCustomContent((() => Promise.resolve({ok: true, json: () => Promise.resolve({cards: [{...CARD, name: 'Loaded'}], colonies: []})} as Response)) as typeof fetch);
    expect(getCard('Loaded' as CardName)?.module).eq('custom');
    await loadCustomContent((() => Promise.reject(new Error('down'))) as typeof fetch);
    await loadCustomContent((() => Promise.resolve({ok: false, statusText: 'nope'} as Response)) as typeof fetch);
    expect(getCard('Loaded' as CardName)).is.not.undefined;
  });
});
