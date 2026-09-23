import {ClientCard} from '@/common/cards/ClientCard';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyName} from '@/common/colonies/ColonyName';
import {paths} from '@/common/app/paths';
import {addClientCards} from '@/client/cards/ClientCardManifest';
import {addColonies} from '@/client/colonies/ClientColonyManifest';

export type CustomClientContent = {
  cards: Array<ClientCard>;
  colonies: Array<ColonyMetadata & {image?: string}>;
};

const colonyImages: Map<ColonyName, string> = new Map();

/** Registers workshop cards and colonies with the client manifests. */
export function registerCustomContent(content: CustomClientContent): void {
  addClientCards(content.cards);
  addColonies(content.colonies);
  for (const colony of content.colonies) {
    if (colony.image !== undefined) {
      colonyImages.set(colony.name, colony.image);
    }
  }
}

/** Fetches the workshop's cards and colonies and registers them. Never throws: the game works without them. */
export async function loadCustomContent(fetchImpl: typeof fetch = fetch): Promise<void> {
  try {
    const response = await fetchImpl(paths.API_CUSTOM_CLIENT_CARDS);
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    registerCustomContent(await response.json());
  } catch (e) {
    console.warn('Workshop cards were not loaded:', e);
  }
}

/** The picture for a workshop colony, if it has one. */
export function customColonyImage(name: ColonyName): string | undefined {
  return colonyImages.get(name);
}
