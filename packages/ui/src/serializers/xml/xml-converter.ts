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

import { CamelComponentSchemaService } from '../../models/visualization/flows/support/camel-component-schema.service';
import { CamelCatalogService, CatalogKind } from '../../models';
import { CamelUriHelper, ParsedParameters } from '../../utils/camel-uri-helper';
import { BeansEntity } from '../../models/visualization/metadata';

export class XmlConverter {
  // General helper for creating elements with nested structure
  createElementWithAttributesAndChildren = (elementName: string, elementData: any, doc: Document): Element => {
    const element = doc.createElement(elementName);

    if (elementData.uri) {
      element.setAttribute('uri', this.createUriFromParameters(elementData));
    }

    for (const [key, value] of Object.entries(elementData)) {
      if (['steps', 'parameters', 'uri'].includes(key)) {
        continue;
      }

      if (typeof value === 'object') {
        const childElement = this.convertToXmlDocument(key, value, doc);
        element.appendChild(childElement);
      } else {
        element.setAttribute(key, String(value));
      }
    }

    return element;
  };

  convertStepsToXml = (steps: any[], doc: Document): Element[] => {
    const stepElements: Element[] = [];
    steps.forEach((step) => {
      Object.entries(step).forEach(([stepKey, stepValue]) => {
        const stepElement = this.convertToXmlDocument(stepKey, stepValue, doc);
        if (stepValue.uri) {
          const uri = this.createUriFromParameters(stepValue);
          stepElement.setAttribute('uri', uri);
        }
        stepElements.push(stepElement);
      });
    });
    return stepElements;
  };

  createUriFromParameters = (step: any): string => {
    const camelElementLookup = CamelComponentSchemaService.getCamelComponentLookup('from', step);
    if (camelElementLookup.componentName === undefined) {
      return step.uri;
    }

    const catalogLookup = CamelCatalogService.getCatalogLookup(camelElementLookup.componentName);
    if (
      catalogLookup.catalogKind === CatalogKind.Component &&
      catalogLookup.definition?.component.syntax !== undefined
    ) {
      const requiredParameters: string[] = [];
      const defaultValues: ParsedParameters = {};
      if (catalogLookup.definition?.properties !== undefined) {
        Object.entries(catalogLookup.definition.properties).forEach(([key, value]) => {
          if (value.required) requiredParameters.push(key);
          if (value.defaultValue) defaultValues[key] = value.defaultValue;
        });
      }

      return CamelUriHelper.getUriStringFromParameters(
        step.uri,
        catalogLookup.definition.component.syntax,
        step.parameters,
        {
          requiredParameters,
          defaultValues,
        },
      );
    }
    return step.uri;
  };

  convertToXmlDocument = (elementName: string, obj: unknown, doc: Document, parent?: Element): Element => {
    const element = doc.createElement(elementName);

    if (obj.from) {
      const fromElement = this.createElementWithAttributesAndChildren('from', obj.from, doc);
      element.appendChild(fromElement);
      const steps = this.convertStepsToXml(obj.from.steps, doc);
      element.append(...steps);
    }

    // Process the rest of the properties, skipping 'from' since it was handled above
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'from') continue;

      if (typeof value !== 'object') {
        element.setAttribute(key, String(value));
      }
      // parse array cases
      else if (Array.isArray(value)) {
        if (key === 'steps') {
          const steps = this.convertStepsToXml(value, doc);
          element.append(...steps);
        } else if (key === 'exception') {
          value.forEach((exception) => {
            const exceptionElement = doc.createElement('exception');
            exceptionElement.textContent = exception;
            element.appendChild(exceptionElement);
          });
        } else {
          value.forEach((v) => {
            const childElement = this.convertToXmlDocument(key, v, doc, parent);
            element.appendChild(childElement);
          });
        }
      }
      // parse object cases
      else if (typeof value === 'object' && key !== 'parameters') {
        let childElement;
        switch (key) {
          case 'expression':
            childElement = this.convertExpressionToXml(value, doc);
            break;
          case 'properties':
            childElement = this.convertPropertiesToXml(value, doc);
            break;
          case 'constructors':
            childElement = this.convertConstructorsToXml(value, doc);
            break;
          default:
            childElement = this.convertToXmlDocument(key, value, doc, parent);
            break;
        }
        element.appendChild(childElement!);
      }
    }
    return element;
  };

  convertDoTryToXml = (doTry: any, doc: Document): Element => {
    const doTryElement = doc.createElement('doTry');
    const doTrySteps = this.convertStepsToXml(doTry.steps, doc);
    doTryElement.append(...doTrySteps);
    return doTryElement;
  };

  convertExpressionToXml = (expression: any, doc: Document): Element => {
    const expressionObject = Object.entries(expression)[0];
    const expressionElement = doc.createElement(expressionObject[0]);
    expressionElement.textContent = expressionObject[1].expression;
    for (const [key, value] of Object.entries(expressionObject[1])) {
      if (key === 'expression') continue;
      expressionElement.setAttribute(key, String(value));
    }
    return expressionElement;
  };
  convertPropertiesToXml = (properties: any, doc: Document): Element => {
    const propertiesElement = doc.createElement('properties');
    for (const [key, value] of Object.entries(properties)) {
      const propertyElement = doc.createElement('property');
      propertyElement.setAttribute('key', key);
      propertyElement.setAttribute('value', value);
      propertiesElement.appendChild(propertyElement);
    }
    return propertiesElement;
  };

  convertConstructorsToXml = (constructors: any, doc: Document): Element => {
    const constructorsElement = doc.createElement('constructors');
    for (const [key, value] of Object.entries(constructors)) {
      const constructorElement = doc.createElement('constructor');
      constructorElement.setAttribute('index', key);
      constructorElement.setAttribute('value', value);
      constructorsElement.appendChild(constructorElement);
    }
    return constructorsElement;
  };
  generateXmlDocument = (entityDefinitions: CamelBaseEntity[]): Document => {
    const parser = new DOMParser();
    const doc: XMLDocument = parser.parseFromString('<camel></camel>', 'text/xml');
    const rootElement = doc.documentElement;

    const routesElement = doc.createElement('routes');
    const beans = doc.createElement('beans');
    // const restConfigurationsElement = doc.createElement('restConfigurations');
    // const restsElement = doc.createElement('rests');

    entityDefinitions.forEach((entity) => {
      const entityType = entity.type;
      let element: Element;

      // Append to the appropriate section based on type
      switch (entityType) {
        case 'route':
          element = this.convertToXmlDocument('route', entity.entityDef[entityType], doc);
          routesElement.appendChild(element);
          break;
        case 'beans':
          entity.parent.beans.forEach((bean) => {
            element = this.convertToXmlDocument('bean', bean, doc);
            beans.appendChild(element);
          });
          break;
        // case "restConfiguration":
        //   restConfigurationsElement.appendChild(entityElement);
        //   break;
        // case "rest":
        //   restsElement.appendChild(entityElement);
        //   break;
        // default:
        //   // Handle any additional or unknown types if necessary
        //   break;
      }
    });

    // Append non-empty sections to the <camel> root element
    if (routesElement.hasChildNodes()) rootElement.appendChild(routesElement);
    if (beans.hasChildNodes()) rootElement.appendChild(beans);
    // if (restConfigurationsElement.hasChildNodes()) doc.getRootNode().appendChild(restConfigurationsElement);
    // if (restsElement.hasChildNodes()) doc.getRootNode().appendChild(restsElement);
    return doc;
  };
}
