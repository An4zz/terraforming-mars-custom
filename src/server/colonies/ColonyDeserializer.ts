import {ColonyName} from '../../common/colonies/ColonyName';
import {SerializedColony} from '../SerializedColony';
import {ALL_COLONIES_TILES} from './ColonyManifest';
import {IColony} from './IColony';
import {CustomCardRegistry} from '../custom/cards/CustomCardRegistry'; // CUSTOM(workshop)

export class ColonyDeserializer {
  public static deserialize(serialized: SerializedColony | ColonyName): IColony | undefined {
    const name = typeof(serialized) === 'string' ? serialized : serialized.name;
    const factory = ALL_COLONIES_TILES.find((cf) => cf.colonyName === name);
    const colony = factory !== undefined ? new factory.Factory() : CustomCardRegistry.getInstance().newColony(name); // CUSTOM(workshop)
    if (colony === undefined) {
      console.warn(`colony ${name} not found`);
      return undefined;
    }

    if (typeof(serialized) !== 'string') {
      colony.colonies = serialized.colonies;
      colony.isActive = serialized.isActive;
      colony.trackPosition = serialized.trackPosition;
      colony.visitor = serialized.visitor;
    }
    return colony;
  }

  public static deserializeAndFilter(serialized: Array<SerializedColony | ColonyName>): Array<IColony> {
    return serialized.map((c) => this.deserialize(c)).filter((c) => c !== undefined);
  }
}
