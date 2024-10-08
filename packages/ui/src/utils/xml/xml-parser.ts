import { JSONSchema4 } from 'json-schema';
import { RouteXmlParser } from './parsers/route-xml-parser';
import { BeansXmlParser } from './parsers/beans-xml-parser';
import { RestXmlParser } from './parsers/rest-xml-parser';

// function extractProperties(schema: JSONSchema4): Record<string, any> {
//   if (schema.properties) {
//     return schema.properties;
//   }
//   if (schema.oneOf || schema.anyOf) {
//     const combinedSchemas = schema.oneOf || schema.anyOf || [];
//     for (const subSchema of combinedSchemas) {
//       if (subSchema.properties) {
//         return subSchema.properties;
//       }
//     }
//   }
//   return {};
// }

export function isXML(code: string): boolean {
  const trimmedCode = code.trim();
  return trimmedCode.startsWith('<') && trimmedCode.endsWith('>');
}

export class XmlParser {
  schemaDefinitions: Record<string, JSONSchema4>;
  routeXmlParser: RouteXmlParser;
  beanParser: BeansXmlParser;
  restParser: RestXmlParser;

  constructor(schema: JSONSchema4) {
    this.schemaDefinitions = (schema.items as JSONSchema4).definitions as unknown as Record<string, JSONSchema4>;
    this.routeXmlParser = new RouteXmlParser(this.schemaDefinitions);
    this.beanParser = new BeansXmlParser(this.schemaDefinitions);
    this.restParser = new RestXmlParser(this.schemaDefinitions);
    // CamelComponentSchemaService.getComponentNameFromUri();
    // CamelComponentSchemaService.getProcessorStepsProperties();
  }

  parseXML = (xml: string): any => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'application/xml');

    const rawEntities = Array.from(xmlDoc.getElementsByTagName('route')).map(this.routeXmlParser.transformRoute);

    const beansSection = rawEntities.length > 1 ? xmlDoc.getElementsByTagName('beans')[0] : xmlDoc;
    const beans = beansSection
      ? Array.from(beansSection.getElementsByTagName('bean')).map(this.beanParser.transformBeanFactory)
      : [];

    const rest = xmlDoc.getElementsByTagName('rest');
    const restEntities =
      rest.length > 0 ? Array.from(rest).map((rest) => ({ rest: this.restParser.transformRest(rest) })) : [];
    if (restEntities.length > 0) {
      rawEntities.push(...restEntities);
    }

    //TODO route configuration
    // const routeConfiguration = xmlDoc.getElementsByTagName('routeConfiguration');

    if (beans.length > 0) {
      rawEntities.push({ beans });
    }
    return rawEntities;
  };

  dereferenceSchema = (schema: JSONSchema4): JSONSchema4 => {
    return this.routeXmlParser.dereferenceSchema(schema);
  };
}
