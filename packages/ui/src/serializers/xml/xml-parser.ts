// @ts-nocheck
/*
 * Copyright (C) 2023 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { JSONSchema4 } from 'json-schema';
import { RouteXmlParser } from './parsers/route-xml-parser';
import { BeansXmlParser } from './parsers/beans-xml-parser';
import { RestXmlParser } from './parsers/rest-xml-parser';
import {
  BeanFactory,
  ErrorHandler,
  Intercept,
  InterceptSendToEndpoint,
  OnCompletion,
  ProcessorDefinition,
} from '@kaoto/camel-catalog/types';
import { SourceSchemaType } from '../../models/camel/source-schema-config';

export function isXML(code: unknown): boolean {
  if (typeof code !== 'string') {
    return false;
  }
  const trimmedCode = code.trim();
  return trimmedCode.startsWith('<') && trimmedCode.endsWith('>');
}

export class XmlParser {
  schemaDefinitions: Record<string, JSONSchema4>;
  routeXmlParser: RouteXmlParser;
  beanParser: BeansXmlParser;
  restParser: RestXmlParser;

  constructor() {
    this.routeXmlParser = new RouteXmlParser();
    this.beanParser = new BeansXmlParser();
    this.restParser = new RestXmlParser();
    // CamelComponentSchemaService.getComponentNameFromUri();
    // CamelComponentSchemaService.getProcessorStepsProperties();
  }

  parseXML = (xml: string): any[] => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'application/xml');
    const rootElement = xmlDoc.documentElement;

    const rawEntities: any[] = [];

    // Helper function to process elements by tag name
    //TOTO chyba
    const processElements = (tagName: string, transformer: (element: Element) => any): any[] => {
      return Array.from(xmlDoc.getElementsByTagName(tagName)).map(transformer);
    };

    // Process route entities
    const routes = processElements('route', this.routeXmlParser.transformRoute);
    if (routes.length > 0) {
      routes.forEach((r) => rawEntities.push({ route: r }));
      console.log(routes, rawEntities);
    }

    // Process beans (bean factory)
    const beansSection = xmlDoc.getElementsByTagName('beans')[0];
    const beans: BeanFactory[] = beansSection ? this.beanParser.transformBeansSection(beansSection) : [];
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

    //todo check root level
    // Helper to process root-level child elements (intercept, errorHandler, onCompletion, etc.)
    const processRootChildren = (parent: Element, tagName: string, transformer: (element: Element) => any): any[] => {
      const childs = Array.from(parent.children).filter((child) => child.tagName === tagName);
      if (childs.length > 0) {
        return childs.map(transformer);
      } else {
        return [];
      }
    };

    // Process root-level intercepts, errorHandlers, and onCompletions as children of the root
    const intercepts = processRootChildren(rootElement, 'intercept', (element) => {
      return this.routeXmlParser.transformRouteConfigurationElement<Intercept>(element, 'intercept');
    });

    if (intercepts.length > 0) {
      rawEntities.push(...intercepts);
    }
    const interceptsFrom = processRootChildren(rootElement, (element) => {
      return this.routeXmlParser.transformRouteConfigurationElement<InterceptFrom>(element, 'interceptFrom');
    });

    if (interceptsFrom.length > 0) {
      rawEntities.push(...interceptsFrom);
    }
    const interceptsSendToEndpoint = processRootChildren(rootElement, 'interceptSendToEndpoint', (element) => {
      return this.routeXmlParser.transformRouteConfigurationElement<InterceptSendToEndpoint>(
        element,
        'interceptSendToEndpoint',
      );
    });
    if (interceptsSendToEndpoint.length > 0) {
      rawEntities.push(...interceptsSendToEndpoint);
    }

    const errorHandlers = processRootChildren(rootElement, 'errorHandler', (errorHandler) => ({
      errorHandler: this.routeXmlParser.transformElementWithSteps<ErrorHandler>(errorHandler),
    }));
    if (errorHandlers.length > 0) {
      rawEntities.push(...errorHandlers);
    }

    const onCompletions = processRootChildren(rootElement, 'onCompletion', (onCompletion) => {
      return this.routeXmlParser.transformRouteConfigurationElement<OnCompletion>(onCompletion, 'onCompletion');
    });
    if (onCompletions.length > 0) {
      rawEntities.push(...onCompletions);
    }

    return rawEntities;
  };

  dereferenceSchema = (schema: JSONSchema4): JSONSchema4 => {
    return this.routeXmlParser.dereferenceSchema(schema);
  };
}
