import { CamelResourceSerializer } from './camel-resource-serializer';
import { isXML, XmlParser } from './xml/xml-parser';
import { sourceSchemaConfig } from '../models/camel/source-schema-config';
import { SourceSchemaType } from '../models/camel/source-schema-type';
import { CamelResource } from '../models/camel/camel-resource';
import { JSONSchema4 } from 'json-schema';
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
    const xmlParser = new XmlParser(sourceSchemaConfig.config[SourceSchemaType.Route].schema?.schema as JSONSchema4);

    const entities = xmlParser.parseXML(code as string);
    return entities;
  }

  serialize(resource: CamelResource): string {
    const visualEntities = resource.getVisualEntities().map((e) => e as unknown as { entityDef: any });
    const xmlDocument = new XmlConverter().generateXmlDocument(visualEntities);
    return formatXml(this.xmlSerializer.serializeToString(xmlDocument));
  }

  parseComments(_code: string): string[] {
    //TODO implement
    return [];
  }
}
