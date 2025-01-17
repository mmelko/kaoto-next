import { isXML, XmlParser } from './xml/xml-parser';
import { CamelResource } from '../models/camel/camel-resource';
import { XmlConverter } from './xml/xml-converter';
import { formatXml } from './xml/xml-utils';
import { CamelResourceSerializer } from './camel-resource-serializer';
import { CamelYamlDsl, Integration, Kamelet, KameletBinding, Pipe } from '@kaoto/camel-catalog/types';

export class XmlCamelResourceSerializer implements CamelResourceSerializer {
  getLabel(): string {
    return 'XML';
  }

  static isApplicable(code: unknown): boolean {
    return isXML(code as string);
  }
  xmlSerializer: XMLSerializer = new XMLSerializer();

  parse(code: unknown): CamelYamlDsl | Integration | Kamelet | KameletBinding | Pipe {
    const xmlParser = new XmlParser();
    const entities = xmlParser.parseXML(code as string);
    return entities as CamelYamlDsl;
  }

  serialize(resource: CamelResource): string {
    const entities = resource.getEntities();
    entities.push(...resource.getVisualEntities());

    //todo parse entities in general not only visual entities.. I have to check the entityFDef and beans
    const xmlDocument = new XmlConverter().generateXmlDocument(entities);
    return formatXml(this.xmlSerializer.serializeToString(xmlDocument));
  }

  getComments(): string[] {
    return [];
  }

  setComments(_comments: string[]): void {
    //TODO implement
  }
}
