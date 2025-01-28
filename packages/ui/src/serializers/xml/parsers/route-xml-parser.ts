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
import { collectNamespaces, extractAttributes, extractAttributesWithCatalogCheck } from '../xml-utils';
import {
  DoCatch,
  DoTry,
  ExpressionDefinition,
  FromDefinition,
  ProcessorDefinition,
  RouteConfigurationDefinition,
  RouteDefinition,
} from '@kaoto/camel-catalog/types';

import { CamelCatalogService, CatalogKind, ICamelProcessorProperty } from '../../../models';

export class RouteXmlParser {
  readonly PROCESSOR_NAMES: Map<string, string> = new Map([
    // necessary for different definition names
    ['onWhen', 'when'],
    // route configuration
    ['templateBean', 'beanFactory'],
    // rest configuration
    ['apiProperty', 'restProperty'],
    ['dataFormatProperty', 'restProperty'],
    ['componentProperty', 'restProperty'],
    ['endpointProperty', 'restProperty'],
    ['apiProperty', 'restProperty'],
    //saga
    ['option', 'propertyExpression'],
  ]);

  namespaces: Map<string, PropertyDefinition[]> = new Map();

  transformElement: (element: Element, transformer?: (element: Element) => unknown) => unknown = (
    element: Element,
    transformer: (element: Element) => unknown = this.transformElement,
  ): unknown => {
    if (!element) return {};
    const processorName = this.PROCESSOR_NAMES.get(element.tagName) ?? element.tagName;

    if (['unmarshal', 'marshal'].includes(processorName)) {
      return this.transformWithDataformat(element);
    }

    const processorModel = CamelCatalogService.getComponent(CatalogKind.Processor, processorName);

    //Some elements are not defined in the catalog even if they are defined in the schemas, so we need to extract them as plan objects
    if (!processorModel) {
      return extractAttributesWithCatalogCheck(element);
    }

    const processor = { ...extractAttributesWithCatalogCheck(element, processorModel.properties) } as {
      [key: string]: unknown;
    };

    Object.entries(processorModel.properties).forEach(([name, properties]) => {
      if (properties.type === 'object') {
        if (properties.kind === 'expression') {
          processor[name] = this.transformOptionalExpression(
            element,
            properties,
            name === 'expression' ? undefined : name,
          );
        } else if (properties.kind === 'element') {
          let singleElement;
          if (properties.oneOf) {
            for (const tag of properties.oneOf) {
              singleElement = element.getElementsByTagName(tag)[0];
              if (singleElement) break;
            }
          } else {
            singleElement = element.getElementsByTagName(name)[0];
          }
          if (singleElement) processor[singleElement.tagName] = this.transformElement(singleElement);
        }
      } else if (properties.type === 'array') {
        if (name === 'outputs') {
          // if outputs is specified then the processor has steps
          const steps = this.transformSteps(element, properties.oneOf!);
          if (steps.length > 0) processor['steps'] = steps;
        } else {
          const arrayClause = Array.from(element.getElementsByTagName(name)).map((el) =>
            properties.javaType === 'java.util.List<java.lang.String>' ? el.textContent : transformer(el),
          );
          if (arrayClause.length > 0) processor[name] = arrayClause;
        }
      }
    });

    // because of the missing elements in catalog 4.9
    if (processorName === 'doTry') {
      return this.decorateDoTry(element, processor);
    }

    return processor;
  };

  transformRoute = (routeElement: Element): RouteDefinition => {
    const fromElement: Element = routeElement.getElementsByTagName('from')[0];
    const from = extractAttributes<FromDefinition>(fromElement) as FromDefinition;
    const routeProperties = CamelCatalogService.getComponent(CatalogKind.Processor, routeElement.tagName)!;
    const routeDef = extractAttributesWithCatalogCheck(routeElement, routeProperties.properties);
    return {
      ...routeDef,
      from: {
        ...from,
        steps: this.transformSteps(routeElement, routeProperties.properties.outputs.oneOf as string[]),
      },
    };
  };

  transformRouteConfigurationElement = (routeConfigElement: Element, elementName: string): unknown => {
    return {
      [elementName]: this.transformElement(routeConfigElement),
    };
  };

  transformRouteConfiguration = (routeConfigElement: Element): RouteConfigurationDefinition => {
    return this.transformElement(routeConfigElement, (element: Element) => {
      return this.transformRouteConfigurationElement(element, element.tagName);
    }) as RouteConfigurationDefinition;
  };

  transformOptionalExpression = (
    parentElement: Element,
    properties: ICamelProcessorProperty,
    tagName?: string,
  ): ExpressionDefinition | undefined => {
    const element = tagName ? parentElement.getElementsByTagName(tagName)[0] : parentElement;
    if (!element) return undefined;

    const expressionElement = Array.from(element.children).find((expression) =>
      properties.oneOf?.includes(expression.tagName),
    );

    return expressionElement ? this.transformExpression(expressionElement) : undefined;
  };

  transformSteps = (parentElement: Element, processorKeys: string[]): ProcessorDefinition[] => {
    return Array.from(parentElement.children)
      .filter((child) => {
        // onFallback is listed as a processor in the catalog, but it is not a processor. This is already fixed in the main branch of the camel
        return processorKeys.includes(child.tagName) && !['doCatch', 'doFinally', 'onFallback'].includes(child.tagName); // Filter out elements not needed
      })
      .map((child) => {
        const step: ProcessorDefinition = {
          [child.tagName as keyof ProcessorDefinition]: this.transformElement(child),
        };
        return step;
      });
  };

  decorateDoTry = (doTryElement: Element, processor: DoTry): ProcessorDefinition => {
    const doCatchArray: DoCatch[] = [];
    let doFinallyElement = undefined;

    Array.from(doTryElement.children).forEach((child) => {
      const tagNameLower = child.tagName;
      const element = this.transformElement(child);
      if (child.tagName === 'doCatch') {
        doCatchArray.push(element as DoCatch);
      } else if (tagNameLower === 'doFinally') {
        doFinallyElement = element;
      }
    });

    return {
      ...processor,
      doCatch: doCatchArray,
      doFinally: doFinallyElement,
    } as ProcessorDefinition;
  };

  transformExpression = (expressionElement: Element): ExpressionDefinition => {
    const expressionType = expressionElement.tagName;
    const expressionTypeProperties = CamelCatalogService.getComponent(
      CatalogKind.Processor,
      expressionType,
    )?.properties;
    const expressionAttributes = extractAttributesWithCatalogCheck(expressionElement, expressionTypeProperties);
    const namespaces = expressionTypeProperties?.namespace ? collectNamespaces(expressionElement) : [];

    return {
      [expressionType]: {
        expression: expressionTypeProperties?.expression ? expressionElement.textContent : undefined,
        ...expressionAttributes,
        namespace: namespaces.length > 0 ? namespaces : undefined,
      },
    } as ExpressionDefinition;
  };

  transformWithDataformat = (dataformatElement: Element): ProcessorDefinition => {
    const dataFormatElement = dataformatElement.children[0];

    if (!dataFormatElement) return {};
    return {
      [dataFormatElement.tagName]: {
        ...extractAttributesWithCatalogCheck(dataFormatElement),
      },
    };
  };
}
