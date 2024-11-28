import { isXML, XmlParser } from './xml/xml-parser';
import { XmlConverter } from './xml/xml-converter';
import { CamelResource, sourceSchemaConfig, SourceSchemaType } from '../models/camel';
import { JSONSchema4 } from 'json-schema';
import { formatXml } from './xml/xml-utils';
import { CamelResourceSerializer } from './camel-resource-serializer';
import { CamelYamlDsl, Integration, Kamelet, KameletBinding, Pipe } from '@kaoto/camel-catalog/types';

export class XmlCamelResourceSerializer implements CamelResourceSerializer {
  static isApplicable(code: unknown): boolean {
    return isXML(code as string);
  }
  xmlSerializer: XMLSerializer = new XMLSerializer();
  xmlConverter: XmlConverter;
  xmlParser: XmlParser;

  parse(code: unknown): CamelYamlDsl | Integration | Kamelet | KameletBinding | Pipe {
    this.xmlParser = new XmlParser(sourceSchemaConfig.config[SourceSchemaType.Route].schema?.schema as JSONSchema4);
    const entities = this.xmlParser.parseXML(code as string);

    return entities;
  }

  serialize(resource: CamelResource): string {
    this.xmlConverter = new XmlConverter();
    const xmlDocument = this.xmlConverter.generateXmlDocument(resource);
    return formatXml(this.xmlSerializer.serializeToString(xmlDocument));
  }

  getComments(): string[] {
    return [];
  }

  setComments(_comments: string[]): void {
    //TODO implement
  }
}
