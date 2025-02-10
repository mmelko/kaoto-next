// @ts-nocheck
/*
 * Copyright (C) 2023 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use RouteXmlParser. file except in compliance with the License.
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

import { CamelCatalogService, CatalogKind, ICamelProcessorProperty } from '../../../models';
import { PROCESSOR_NAMES } from '../xml-utils';
import { ExpressionXmlSerializer } from './expression-xml-serializer';
import { CamelComponentSchemaService } from '../../../models/visualization/flows/support/camel-component-schema.service';
import { CamelUriHelper, ParsedParameters } from '../../../utils';
import { DoTry } from '@kaoto/camel-catalog/types';

export class StepXmlSerializer {
  static serialize(elementName: string, obj: { [key: string]: unknown }, doc: Document, parent?: Element): Element {
    const element = doc.createElement(elementName);

    if (obj[elementName]) {
      // for cases like errorHandler, intercept in the route configuration etc where the element is nested i.e intercept:{intercept:{...}}
      obj = obj[elementName];
    }
    const routeParent = elementName === 'route' ? element : parent;
    const properties = CamelCatalogService.getComponent(
      CatalogKind.Processor,
      PROCESSOR_NAMES.get(elementName) ?? elementName,
    )?.properties;

    if (!properties) {
      this.serializeUnknownType(element, obj, doc, routeParent);
      return element;
    }

    const processor = obj as { [key: string]: unknown };

    for (const [key, props] of Object.entries(properties)) {
      switch (props.kind) {
        case 'attribute':
          this.serializeAttribute(element, key, processor, processor[key]);
          break;

        case 'expression':
          ExpressionXmlSerializer.serialize(key, processor[key], doc, element, routeParent);
          break;

        case 'element':
          this.serializeElementType(element, key, processor, props, doc, routeParent);
          break;
      }

      //   // parse object cases
      //   else if (typeof value === 'object' && key !== 'parameters') {
      //     let childElement;
      //     switch (key) {
      //       case 'properties':
      //         childElement = this.convertPropertiesToXml(value, doc);
      //         break;
      //       case 'constructors':
      //         childElement = this.convertConstructorsToXml(value, doc);
      //         break;
      //       default:
      //         childElement = this.convertToXmlElement(key, value, doc, parent);
      //         break;
      //     }
      //     // element.appendChild(childElement!);
      //     if (childElement.tagName === element.tagName) {
      //       element = childElement;
      //     } else {
      //       element.appendChild(childElement);
      //     }
      //   }
      // }
    }
    if (elementName === 'doTry') {
      this.decorateDoTry(obj, element, doc);
    }

    return element;
  }

  private static serializeUnknownType(element: Element, obj: unknown, doc: Document, routeParent: Element) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object') {
        const childElement = this.serialize(key, value, doc, routeParent);
        element.appendChild(childElement);
      } else {
        element.setAttribute(key, String(value));
      }
    }
  }

  private static serializeElementType(
    element: Element,
    key: string,
    processor: any,
    properties: ICamelProcessorProperty,
    doc: Document,
    routeParent: Element,
  ) {
    if (properties.type === 'array') {
      this.serializeArrayType(element, key, processor, properties, doc, routeParent);
    } else {
      this.serializeObjectType(element, key, processor, properties, doc, routeParent);
    }
  }

  private static serializeArrayType(
    element: Element,
    key: string,
    processor: unknown,
    props: ICamelProcessorProperty,
    doc: Document,
    routeParent: Element,
  ) {
    if (key === 'outputs' && processor['steps']) {
      const steps = this.serializeSteps(processor['steps'], doc, routeParent);
      element.append(...steps);
      return;
    }

    processor[key]?.forEach((v) => {
      let childElement;
      if (props.javaType !== 'java.util.List<java.lang.String>') {
        childElement = this.serialize(key, v, doc, routeParent);
      } else {
        childElement = doc.createElement(key);
        childElement.textContent = v;
      }

      element.appendChild(childElement);
    });
  }

  private static serializeObjectType(
    element: Element,
    key: string,
    processor: any,
    properties: ICamelProcessorProperty,
    doc: Document,
    routeParent: Element,
  ) {
    const childElementKey = processor[key] ? key : properties.oneOf?.find((key) => processor[key] !== undefined);
    if (childElementKey) {
      const childElement = this.serialize(childElementKey, processor[childElementKey], doc, routeParent);
      element.appendChild(childElement);
    }
  }
  s;

  static serializeSteps(steps: any[], doc: Document, routeParent: Element): Element[] {
    const stepElements: Element[] = [];

    steps.forEach((step) => {
      Object.entries(step).forEach(([stepKey, stepValue]) => {
        const stepElement = this.serialize(stepKey, stepValue, doc, routeParent);
        if (stepValue.uri) {
          const uri = this.createUriFromParameters(stepValue);
          stepElement.setAttribute('uri', uri);
        }
        stepElements.push(stepElement);
      });
    });
    return stepElements;
  }

  static createUriFromParameters(step: any) {
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
  }

  private static serializeAttribute(element: Element, key: string, processor: unknown, attributeValue: unknown): void {
    if (attributeValue) {
      const value = key === 'uri' ? this.createUriFromParameters(processor) : attributeValue;
      element.setAttribute(key, value);
    }
  }

  static decorateDoTry(doTry: DoTry, doTryElement: Element, doc: Document): Element {
    doTry.doCatch?.forEach((doCatch) => {
      doTryElement.append(this.serialize('doCatch', doCatch, doc));
    });

    doTryElement.append(this.serialize('doFinally', doTry.doFinally, doc));
    return doTryElement;
  }
}
