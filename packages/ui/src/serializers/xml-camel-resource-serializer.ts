import { CamelResourceSerializer } from './camel-resource-serializer';
import { isXML, XmlParser } from './xml/xml-parser';
import { CamelResource } from '../models/camel/camel-resource';
import { XmlConverter } from './xml/xml-converter';
import { formatXml } from './xml/xml-utils';

export class XmlCamelResourceSerializer implements CamelResourceSerializer {
  getLabel(): string {
    return 'XML';
  }

  static isApplicable(code: unknown): boolean {
    return isXML(code as string);
  }
  xmlSerializer: XMLSerializer = new XMLSerializer();

  parse(code: string): unknown {
    const xmlParser = new XmlParser();

    const entities = xmlParser.parseXML(code as string);
    return entities;
  }

  serialize(resource: CamelResource): string {
    const entities = resource.getEntities();
    entities.push(...resource.getVisualEntities());

    //todo parse entities in general not only visual entities.. I have to check the entityFDef and beans
    const xmlDocument = new XmlConverter().generateXmlDocument(entities);
    return formatXml(this.xmlSerializer.serializeToString(xmlDocument));
  }

  parseComments(_code: string): string[] {
    //TODO implement
    return [];
  }
}
