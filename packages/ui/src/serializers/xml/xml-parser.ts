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

import { RouteXmlParser } from './parsers/route-xml-parser';
import { BeansXmlParser } from './parsers/beans-xml-parser';
import { RestXmlParser } from './parsers/rest-xml-parser';
import { BeanFactory } from '@kaoto/camel-catalog/types';

export function isXML(code: unknown): boolean {
  if (typeof code !== 'string') {
    return false;
  }
  const trimmedCode = code.trim();
  return trimmedCode.startsWith('<') && trimmedCode.endsWith('>');
}

export class XmlParser {
  routeXmlParser: RouteXmlParser;
  beanParser: BeansXmlParser;
  restParser: RestXmlParser;

  constructor() {
    this.routeXmlParser = new RouteXmlParser();
    this.beanParser = new BeansXmlParser();
    this.restParser = new RestXmlParser();
  }

  parseXML = (xml: string): unknown => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'application/xml');

    return this.parseFromXmlDocument(xmlDoc);
  };

  parseFromXmlDocument(xmlDoc: Document): unknown {
    const rawEntities: unknown[] = [];

    // Helper function to process elements by tag name
    const processElements = (tagName: string, transformer: (element: Element) => any): any[] => {
      return Array.from(xmlDoc.getElementsByTagName(tagName)).map(transformer);
    };

    // Process route entities
    const routes = processElements('route', this.routeXmlParser.transformRoute);
    if (routes.length > 0) {
      routes.forEach((r) => rawEntities.push({ route: r }));
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
    // rest of the elements
    const rootCamelElement = xmlDoc.getElementsByTagName('camel')[0];
    const children = rootCamelElement ? rootCamelElement.children : xmlDoc.children;
    Array.from(children).forEach((child) => {
      console.log('going to parse child', child);
      if (
        [
          'restConfiguration',
          'routeTemplate',
          'templatedRoute',
          'errorHandler',
          'intercept',
          'interceptFrom',
          'interceptSendToEndpoint',
          'onCompletion',
        ].includes(child.tagName)
      ) {
        const entity = this.routeXmlParser.transformElement(child);
        console.log('entity', entity);
        if (entity) {
          rawEntities.push({ [child.tagName]: entity });
        }
      }
    });

    return rawEntities;
  }
}
