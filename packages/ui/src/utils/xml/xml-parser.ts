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
    const rootElement = xmlDoc.documentElement;

    const rawEntities: any[] = [];

    // Helper function to process elements by tag name
    const processElements = (tagName: string, transformer: (element: Element) => any): any[] => {
      return Array.from(xmlDoc.getElementsByTagName(tagName)).map(transformer);
    };

    // Process route entities
    const routes = processElements('route', this.routeXmlParser.transformRoute);
    if (routes.length > 0) {
      rawEntities.push(...routes);
    }

    // Process beans (bean factory)
    const beansSection = routes.length > 1 ? xmlDoc.getElementsByTagName('beans')[0] : xmlDoc;
    const beans = beansSection ? processElements('bean', this.beanParser.transformBeanFactory) : [];
    if (beans.length > 0) {
      rawEntities.push({ beans });
    }

    // Process rest entities
    const restEntities = processElements('rest', this.restParser.transformRest).map((rest) => ({ rest }));
    if (restEntities.length > 0) {
      rawEntities.push(...restEntities);
    }

    // Process route configurations
    const routeConfigurations = processElements(
      'routeConfiguration',
      this.routeXmlParser.transformRouteConfiguration,
    ).map((routeConf) => ({ routeConfiguration: routeConf }));
    if (routeConfigurations.length > 0) {
      rawEntities.push(...routeConfigurations);
    }

    // Helper to process root-level child elements (intercept, errorHandler, onCompletion, etc.)
    const processRootChildren = (parent: Element, tagName: string, transformer: (element: Element) => any): any[] => {
      return Array.from(parent.children)
        .filter((child) => child.tagName === tagName)
        .map(transformer);
    };

    // Process root-level intercepts, errorHandlers, and onCompletions as children of the root
    const intercepts = processRootChildren(rootElement, 'intercept', this.routeXmlParser.transformIntercepts);

    if (intercepts.length > 0) {
      rawEntities.push(...intercepts);
    }
    const interceptsFrom = processRootChildren(rootElement, 'interceptFrom', this.routeXmlParser.transformIntercepts);
    if (interceptsFrom.length > 0) {
      rawEntities.push(...interceptsFrom);
    }
    const interceptsSendToEndpoint = processRootChildren(
      rootElement,
      'interceptSendToEndpoint',
      this.routeXmlParser.transformIntercepts,
    );
    if (interceptsSendToEndpoint.length > 0) {
      rawEntities.push(...interceptsSendToEndpoint);
    }

    const errorHandlers = processRootChildren(rootElement, 'errorHandler', (errorHandler) => ({
      errorHandler: this.routeXmlParser.transformErrorHandler(errorHandler),
    }));
    if (errorHandlers.length > 0) {
      rawEntities.push(...errorHandlers);
    }

    const onCompletions = processRootChildren(rootElement, 'onCompletion', (onCompletion) => ({
      onCompletion: this.routeXmlParser.transformOnCompletion(onCompletion),
    }));
    if (onCompletions.length > 0) {
      rawEntities.push(...onCompletions);
    }

    return rawEntities;
  };

  dereferenceSchema = (schema: JSONSchema4): JSONSchema4 => {
    return this.routeXmlParser.dereferenceSchema(schema);
  };
}
