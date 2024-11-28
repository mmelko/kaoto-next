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

import { getAttributesFromSchema } from '../xml-utils';
import { JSONSchema4 } from 'json-schema';

export class BeansXmlParser {
  schemaDefinitions: JSONSchema4;

  constructor(schemaDefinitions: Record<string, any>) {
    this.schemaDefinitions = schemaDefinitions;
  }

  transformBeanFactory = (beanElement: Element): any => {
    const beanSchema = this.schemaDefinitions['org.apache.camel.model.BeanFactoryDefinition'];

    // Initialize the bean object
    let bean: any = {};

    bean = getAttributesFromSchema(beanElement, beanSchema);
    console.log('bean', getAttributesFromSchema(beanElement, beanSchema));
    // Special case for 'name/id' and 'type/class'
    const name = beanElement.getAttribute('id');
    if (name) {
      bean['name'] = name;
    }

    const type = beanElement.getAttribute('class');
    if (type) {
      bean['type'] = type;
    }

    const constructorsElement = beanElement.getElementsByTagName('constructors')[0];
    if (constructorsElement) {
      let constructors: { [key: string]: string } = {};

      Array.from(beanElement.getElementsByTagName('constructors')[0].children).forEach((constructorElement) => {
        const constructorIndex = constructorElement.getAttribute('index');
        const constructorValue = constructorElement.getAttribute('value');

        if (constructorIndex && constructorValue) {
          constructors = { ...constructors, [constructorIndex]: constructorValue };
        }
      });

      if (Object.keys(constructors).length > 0) {
        bean['constructors'] = constructors;
      }
    }
    const propertiesElement = beanElement.getElementsByTagName('properties')[0];
    if (propertiesElement) {
      let properties: { [key: string]: string } = {};

      Array.from(beanElement.getElementsByTagName('properties')[0].children).forEach((propertyElement) => {
        const propName = propertyElement.getAttribute('key') || propertyElement.getAttribute('name');
        const propValue = propertyElement.getAttribute('value') || propertyElement.getAttribute('ref');

        if (propName && propValue) {
          properties = { ...properties, [propName]: propValue };
        }
      });

      if (Object.keys(properties).length > 0) {
        bean['properties'] = properties;
      }
    }

    return bean;
  };
}
