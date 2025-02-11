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

import { BaseCamelEntity, EntityType } from '../../../models/camel/entities';
import { StepXmlSerializer } from './step-xml-serializer';
import { RestXmlSerializer } from './rest-xml-serializer';
import { BeansEntity } from '../../../models/visualization/metadata';
import { BeansXmlSerializer } from './beans-xml-serializer';

export class KaotoXmlSerializer {
  // General helper for creating elements with nested structure

  static serializeRoute(route: RouteDefinition, doc: Document): Element {
    const routeElement = StepXmlSerializer.serialize('route', route, doc);

    const steps = StepXmlSerializer.serializeSteps(route.from.steps, doc, routeElement);
    routeElement.append(...steps);

    return routeElement;
  }

  static convertPropertiesToXml(properties: unknown, doc: Document): Element {
    const propertiesElement = doc.createElement('properties');
    for (const [key, value] of Object.entries(properties)) {
      const propertyElement = doc.createElement('property');
      propertyElement.setAttribute('key', key);
      propertyElement.setAttribute('value', value);
      propertiesElement.appendChild(propertyElement);
    }
    return propertiesElement;
  }

  convertConstructorsToXml = (constructors: unknown, doc: Document): Element => {
    const constructorsElement = doc.createElement('constructors');
    for (const [key, value] of Object.entries(constructors)) {
      const constructorElement = doc.createElement('constructor');
      constructorElement.setAttribute('index', key);
      constructorElement.setAttribute('value', value);
      constructorsElement.appendChild(constructorElement);
    }
    return constructorsElement;
  };

  static serialize(entityDefinitions: BaseCamelEntity[]): Document {
    const parser = new DOMParser();
    const doc: XMLDocument = parser.parseFromString('<camel></camel>', 'text/xml');

    const rootElement = doc.documentElement;
    const beans = doc.createElement('beans');

    entityDefinitions.forEach((entity) => {
      const entityType = entity.type;

      switch (entity.type) {
        case EntityType.Beans:
          (entity as BeansEntity).parent.beans.forEach((bean) => {
            beans.appendChild(BeansXmlSerializer.serialize(bean, doc));
          });
          break;
        case EntityType.Route:
          {
            const routeElement = this.serializeRoute(entity.entityDef[EntityType.Route], doc);
            rootElement.appendChild(routeElement);
          }
          break;
        case EntityType.ErrorHandler:
          {
            const element = StepXmlSerializer.serialize(entityType, entity.errorHandlerDef, doc, rootElement);
            rootElement.appendChild(element);
          }
          break;
        case EntityType.Rest:
          rootElement.appendChild(RestXmlSerializer.serialize(entity.entityDef[entityType], doc));
          break;
        case defaut: {
          const element = StepXmlSerializer.serialize(entityType, entity.entityDef[entityType], doc, rootElement);
          rootElement.appendChild(element);
        }
      }
    });

    if (beans.hasChildNodes()) rootElement.appendChild(beans);
    return doc;
  }
}
