import { isXML, XmlParser } from './xml/xml-parser';
import { XmlConverter } from './xml/xml-converter';
import { CamelResource, sourceSchemaConfig, SourceSchemaType } from '../models/camel';
import { JSONSchema4 } from 'json-schema';
import { formatXml } from './xml/xml-utils';
import { CamelResourceSerializer } from './camel-resource-serializer';

export class XmlCamelResourceSerializer implements CamelResourceSerializer {
  getLabel(): string {
    return 'XML';
  }
  static isApplicable(code: unknown): boolean {
    return isXML(code as string);
  }
  xmlSerializer: XMLSerializer = new XMLSerializer();

  parse(code: unknown): unknown {
    const xmlParser = new XmlParser(sourceSchemaConfig.config[SourceSchemaType.Route].schema?.schema as JSONSchema4);
    const entities = xmlParser.parseXML(code as string);

    return entities;
  }

  serialize(resource: CamelResource): string {
    const xmlDocument = new XmlConverter().generateXmlDocument(resource);
    return formatXml(this.xmlSerializer.serializeToString(xmlDocument));
  }

  parseComments(_code: string): string[] {
    //TODO implement
    return [];
  }
}
