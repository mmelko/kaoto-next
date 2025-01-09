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
import { extractAttributes, extractAttributesUntyped } from '../xml-utils';
import {
  Choice,
  DoCatch,
  DoFinally,
  DoTry,
  ErrorHandler,
  ExpressionDefinition,
  FromDefinition,
  Intercept,
  InterceptFrom,
  InterceptSendToEndpoint,
  OnCompletion,
  OnException,
  OnWhen,
  Otherwise,
  ProcessorDefinition,
  RouteConfigurationDefinition,
  RouteDefinition,
  When1 as When,
} from '@kaoto/camel-catalog/types';
import { CamelComponentSchemaService } from '../../../models/visualization/flows/support/camel-component-schema.service';

const expressionsSchemas: { [key: string]: string } = {
  constant: '#/items/definitions/org.apache.camel.model.language.ConstantExpression',
  simple: '#/items/definitions/org.apache.camel.model.language.SimpleExpression',
  xpath: '#/items/definitions/org.apache.camel.model.language.XPathExpression',
  jsonpath: '#/items/definitions/org.apache.camel.model.language.JsonPathExpression',
  header: '#/items/definitions/org.apache.camel.model.language.HeaderExpression',
  body: '#/items/definitions/org.apache.camel.model.language.BodyExpression',
  property: '#/items/definitions/org.apache.camel.model.language.PropertyExpression',
  exchangeProperty: '#/items/definitions/org.apache.camel.model.language.ExchangePropertyExpression',
  groovy: '#/items/definitions/org.apache.camel.model.language.GroovyExpression',
  mvel: '#/items/definitions/org.apache.camel.model.language.MvelExpression',
  ognl: '#/items/definitions/org.apache.camel.model.language.OgnlExpression',
  spel: '#/items/definitions/org.apache.camel.model.language.SpELExpression',
  sql: '#/items/definitions/org.apache.camel.model.language.SqlExpression',
  tokenize: '#/items/definitions/org.apache.camel.model.language.TokenizeExpression',
  ref: '#/items/definitions/org.apache.camel.model.language.RefExpression',
  method: '#/items/definitions/org.apache.camel.model.language.MethodCallExpression',
  datasonnet: '#/items/definitions/org.apache.camel.model.language.DatasonnetExpression',
  csimple: '#/items/definitions/org.apache.camel.model.language.CSimpleExpression',
  xtokenize: '#/items/definitions/org.apache.camel.model.language.XTokenizeExpression',
};

type ProcessorDefinitionKey = keyof ProcessorDefinition;
const processorKeys: ProcessorDefinitionKey[] = [
  'aggregate',
  'bean',
  'doCatch',
  'choice',
  'circuitBreaker',
  'claimCheck',
  'convertBodyTo',
  'convertHeaderTo',
  'convertVariableTo',
  'delay',
  'dynamicRouter',
  'enrich',
  'filter',
  'doFinally',
  'idempotentConsumer',
  'kamelet',
  'loadBalance',
  'log',
  'loop',
  'marshal',
  'multicast',
  'onFallback',
  'otherwise',
  'pausable',
  'pipeline',
  'policy',
  'poll',
  'pollEnrich',
  'process',
  'recipientList',
  'removeHeader',
  'removeHeaders',
  'removeProperties',
  'removeProperty',
  'removeVariable',
  'resequence',
  'resumable',
  'rollback',
  'routingSlip',
  'saga',
  'sample',
  'script',
  'setBody',
  'setExchangePattern',
  'setHeader',
  'setHeaders',
  'setProperty',
  'setVariable',
  'setVariables',
  'sort',
  'split',
  'step',
  'stop',
  'threads',
  'throttle',
  'throwException',
  'to',
  'toD',
  'tokenizer',
  'transacted',
  'transform',
  'doTry',
  'unmarshal',
  'validate',
  'when',
  'whenSkipSendToEndpoint',
  'wireTap',
  'serviceCall',
];

const expressionKeys = Object.keys(expressionsSchemas);

export class RouteXmlParser {
  transformRoute = (routeElement: Element): RouteDefinition => {
    const fromElement: Element = routeElement.getElementsByTagName('from')[0];
    const from = this.transformElementWithSteps<FromDefinition>(fromElement);
    const routeDef = extractAttributes<RouteDefinition>(routeElement);

    return {
      ...routeDef,
      from: { ...from, steps: this.transformSteps(routeElement) },
    };
  };

  transformRouteConfigurationElement = <T>(routeConfigElement: Element, elementName: string): { [key: string]: T } => {
    return {
      [elementName]: this.transformElementWithSteps<T>(routeConfigElement),
    };
  };

  transformRouteConfiguration = (routeConfigElement: Element): RouteConfigurationDefinition => {
    const routeConfig = extractAttributes<RouteConfigurationDefinition>(routeConfigElement);
    return {
      ...routeConfig,
      errorHandler: this.transformElementWithSteps<ErrorHandler>(
        routeConfigElement.getElementsByTagName('errorHandler')[0],
      ),
      intercept: Array.from(routeConfigElement.getElementsByTagName('intercept')).map((element) =>
        this.transformRouteConfigurationElement<Intercept>(element, 'intercept'),
      ),

      interceptFrom: Array.from(routeConfigElement.getElementsByTagName('interceptFrom')).map((element) =>
        this.transformRouteConfigurationElement<InterceptFrom>(element, 'interceptFrom'),
      ),

      interceptSendToEndpoint: Array.from(routeConfigElement.getElementsByTagName('interceptSendToEndpoint')).map(
        (element) =>
          this.transformRouteConfigurationElement<InterceptSendToEndpoint>(element, 'interceptSendToEndpoint'),
      ),

      onCompletion: Array.from(routeConfigElement.getElementsByTagName('onCompletion')).map((element) =>
        this.transformRouteConfigurationElement<OnCompletion>(element, 'onCompletion'),
      ),

      onException: Array.from(routeConfigElement.getElementsByTagName('onException')).map((onException) =>
        this.transformRouteConfigurationElement<OnException>(onException, 'onException'),
      ),
    };
  };

  transformOnException = (onExceptionElement: Element): OnException => {
    return {
      ...extractAttributes<OnException>(onExceptionElement),
      exception: Array.from(onExceptionElement.getElementsByTagName('exception')).map(
        (exception) => exception.textContent,
      ) as string[],
      handled: this.transformOptionalExpression(onExceptionElement, 'handled'),
      continued: this.transformOptionalExpression(onExceptionElement, 'continued'),
      steps: this.transformSteps(onExceptionElement), // Nested steps inside onException
    };
  };

  transformOptionalExpression = (parentElement: Element, tagName: string): ExpressionDefinition | undefined => {
    const expressionElement = parentElement.getElementsByTagName(tagName)[0]?.children[0];
    return expressionElement ? this.transformExpression(expressionElement) : undefined;
  };

  transformSteps = (parentElement: Element): ProcessorDefinition[] => {
    return Array.from(parentElement.children)
      .filter((child) => {
        const stepKey = child.tagName as ProcessorDefinitionKey;
        return processorKeys.includes(stepKey) && !['doCatch', 'doFinally'].includes(stepKey); // Filter out elements not needed
      })
      .map((child) => {
        const step: ProcessorDefinition = {
          [child.tagName as keyof ProcessorDefinition]: this.transformElement(child),
        };
        return step;
      });
  };

  transformElementWithSteps = <T>(element: Element): T => {
    return {
      ...extractAttributes<T>(element),
      steps: this.transformSteps(element),
    } as T;
  };

  transformElement = (element: Element): unknown => {
    // if (element.textContent !== null) {
    //   return element.textContent;
    // }

    const processorName = (
      element.tagName ? element.tagName : (element as unknown as string)
    ) as ProcessorDefinitionKey;

    if (processorName === 'doTry') {
      return this.transformDoTry(element);
    } else if (['unmarshal', 'marshal'].includes(processorName)) {
      return this.transformWithDataformat(element);
    } else if (processorName === 'choice') {
      return this.transformChoice(element);
    }

    const processorProperties = CamelComponentSchemaService.getProcessorStepsProperties(processorName);
    let step = { ...extractAttributesUntyped(element) } as { [key: string]: unknown };

    // if the step has an expression, find the expression element and transform it
    const expressionElement = Array.from(element.children).find((child) =>
      expressionKeys.includes(child.tagName.toLowerCase()),
    );

    if (expressionElement) {
      step = { ...step, expression: this.transformExpression(expressionElement) };
    }

    if (processorProperties.length === 1 && processorProperties[0].name === 'steps') {
      step['steps'] = this.transformSteps(element); // Call transformSteps on the element
    }

    return step;
  };

  transformDoTry = (doTryElement: Element): DoTry => {
    const doCatchArray: DoCatch[] = [];
    let doFinallyElement = undefined;

    Array.from(doTryElement.children).forEach((child) => {
      const tagNameLower = child.tagName;
      if (child.tagName === 'doCatch') {
        doCatchArray.push(this.transformDoCatch(child));
      } else if (tagNameLower === 'doFinally') {
        doFinallyElement = this.transformElementWithSteps<DoFinally>(child);
      }
    });

    return {
      ...extractAttributes<DoTry>(doTryElement),
      steps: this.transformSteps(doTryElement), // All other steps except doCatch and doFinally
      doCatch: doCatchArray,
      doFinally: doFinallyElement,
    };
  };

  transformDoCatch = (doCatchElement: Element): DoCatch => {
    // Process exceptions
    const exceptionElements = Array.from(doCatchElement.getElementsByTagName('exception'));
    const exceptions = exceptionElements
      .map((exceptionElement) => exceptionElement.textContent)
      .filter((e) => e !== null);

    // Process the onWhen element if present
    const onWhenElement = doCatchElement.getElementsByTagName('onWhen')[0];
    const onWhen = onWhenElement ? this.transformOnWhen(onWhenElement) : undefined;

    return {
      ...extractAttributes<DoCatch>(doCatchElement),
      exception: exceptions, // Capture the exceptions
      onWhen: onWhen, // Capture onWhen if available
      steps: this.transformSteps(doCatchElement), // Process steps inside doCatch
    };
  };

  transformOnWhen = (onWhenElement: Element): OnWhen => {
    const expressionElement = Array.from(onWhenElement.children).find((child) => {
      return expressionKeys.includes(child.tagName.toLowerCase()); // Check if it's an expression
    });

    return {
      ...extractAttributes<OnWhen>(onWhenElement),
      expression: expressionElement ? this.transformExpression(expressionElement) : null, // Transform expression if available
    };
  };

  transformExpression = (expressionElement: Element): ExpressionDefinition => {
    const expressionType = expressionElement.tagName;
    const expressionAttributes = extractAttributesUntyped(expressionElement);

    return {
      [expressionType]: { expression: expressionElement.textContent, ...expressionAttributes },
    } as ExpressionDefinition;
  };

  transformChoice = (choiceElement: Element): Choice => {
    const whenElements = Array.from(choiceElement.getElementsByTagName('when'));
    const otherwiseElement = choiceElement.getElementsByTagName('otherwise')[0];

    return {
      ...extractAttributes<Choice>(choiceElement),
      when: whenElements.map(this.transformWhen),
      otherwise: otherwiseElement ? this.transformElementWithSteps<Otherwise>(otherwiseElement) : undefined,
    };
  };

  transformWhen = (whenElement: Element): When => {
    const expressionElement = Array.from(whenElement.children).find((child) => {
      return expressionKeys.includes(child.tagName); // Check if it's an expression
    });

    return {
      ...this.transformElementWithSteps<When>(whenElement),
      expression: expressionElement ? this.transformExpression(expressionElement) : null, // Call transformExpression
    };
  };

  transformWithDataformat = (unmarshalElement: Element): unknown => {
    const dataFormatElement = unmarshalElement.children[0];

    if (!dataFormatElement) return {};
    return {
      [dataFormatElement.tagName]: {
        ...extractAttributesUntyped(dataFormatElement),
      },
    };
  };
}
