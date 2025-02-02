import { isXML, KaotoXmlParser } from './xml/kaoto-xml-parser';
import { CamelResource } from '../models/camel/camel-resource';
import { KaotoXmlSerializer } from './xml/serializers/kaoto-xml-serializer';
import { formatXml } from './xml/xml-utils';
import { CamelResourceSerializer } from './camel-resource-serializer';
import { CamelYamlDsl, Integration, Kamelet, KameletBinding, Pipe } from '@kaoto/camel-catalog/types';
import { EntityType } from '../models/camel/entities';

export class XmlCamelResourceSerializer implements CamelResourceSerializer {
  getLabel(): string {
    return 'XML';
  }

  static isApplicable(code: unknown): boolean {
    return isXML(code as string);
  }
  xmlSerializer: XMLSerializer = new XMLSerializer();

  parse(code: unknown): CamelYamlDsl | Integration | Kamelet | KameletBinding | Pipe {
    const xmlParser = new KaotoXmlParser();
    const entities = xmlParser.parseXML(code as string);
    return entities as CamelYamlDsl;
  }

  serialize(resource: CamelResource): string {
    const entities = resource.getEntities().filter((entity) => entity.type === EntityType.Beans);
    entities.push(...resource.getVisualEntities());

    const xmlDocument = KaotoXmlSerializer.serialize(entities);
    return formatXml(this.xmlSerializer.serializeToString(xmlDocument));
  }

  getComments(): string[] {
    return [];
  }

  setComments(_comments: string[]): void {
    //TODO implement
  }
}
