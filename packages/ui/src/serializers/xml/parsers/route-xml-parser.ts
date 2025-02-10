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
import { capitalize, getAttributesFromSchema } from '../xml-utils';

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
};

const expressionKeys = Object.keys(expressionsSchemas);

export class RouteXmlParser {
  schemaDefinitions: Record<string, JSONSchema4>;

  constructor(schemaDefinitions: Record<string, JSONSchema4>) {
    this.schemaDefinitions = schemaDefinitions;
  }

  public dereferenceSchema = (dSchema: JSONSchema4): JSONSchema4 => {
    const definitions: Record<string, JSONSchema4> = this.schemaDefinitions;
    if (dSchema.$ref) {
      const refPath = dSchema.$ref.replace(/^#\/items\/definitions\//, '');
      return definitions[refPath];
    }
    return dSchema;
  };

  dereferenceSchemaByRef = (ref: string): JSONSchema4 => {
    const refPath = ref.replace(/^#\/items\/definitions\//, '');
    return this.schemaDefinitions[refPath];
  };

  transformRoute = (routeElement: Element): any => {
    const routeSchema = this.schemaDefinitions['org.apache.camel.model.RouteDefinition'];

    const fromElement: Element = routeElement.getElementsByTagName('from')[0];
    const from = this.transformFrom(fromElement);
    return {
      ...getAttributesFromSchema(routeElement, routeSchema),
      from: from,
    };
  };

  transformRouteConfiguration = (routeConfigElement: Element): any => {
    const routeConfigSchema = this.schemaDefinitions[
      'org.apache.camel.model.RouteConfigurationDefinition'
    ] as JSONSchema4;
    return {
      ...getAttributesFromSchema(routeConfigElement, routeConfigSchema),
      errorHandler: this.transformErrorHandler(routeConfigElement.getElementsByTagName('errorHandler')[0]),

      intercept: Array.from(routeConfigElement.getElementsByTagName('intercept')).map(this.transformIntercepts),

      interceptFrom: Array.from(routeConfigElement.getElementsByTagName('interceptFrom')).map(this.transformIntercepts),

      interceptSendToEndpoint: Array.from(routeConfigElement.getElementsByTagName('interceptSendToEndpoint')).map(
        this.transformIntercepts,
      ),

      onCompletion: this.transformOnCompletion(routeConfigElement.getElementsByTagName('onCompletion')[0]),

      onException: Array.from(routeConfigElement.getElementsByTagName('onException')).map((onException) => ({
        onException: this.transformOnException(onException),
      })),
    };
  };

  transformIntercepts = (interceptElement: Element): any => {
    const interceptSchema = this.schemaDefinitions[
      'org.apache.camel.model.' + capitalize(interceptElement.tagName) + 'Definition'
    ] as JSONSchema4;
    return {
      [interceptElement.tagName]: {
        ...getAttributesFromSchema(interceptElement, interceptSchema),
        steps: this.transformSteps(interceptElement),
      },
    };
  };
  transformOnException = (onExceptionElement: Element): any => {
    const onExceptionSchema = this.schemaDefinitions['org.apache.camel.model.OnExceptionDefinition'] as JSONSchema4;
    const step = {
      ...getAttributesFromSchema(onExceptionElement, onExceptionSchema),
      exception: Array.from(onExceptionElement.getElementsByTagName('exception')).map(
        (exception) => exception.textContent,
      ),
      handled: this.transformOptionalExpression(onExceptionElement, 'handled'),
      continued: this.transformOptionalExpression(onExceptionElement, 'continued'),
      steps: this.transformSteps(onExceptionElement), // Nested steps inside onException
    };

    return step;
  };

  transformErrorHandler = (errorHandlerElement: Element): any => {
    if (!errorHandlerElement) return null;
    const errorHandlerSchema = this.schemaDefinitions['org.apache.camel.model.ErrorHandlerDefinition'] as JSONSchema4;
    return {
      ...getAttributesFromSchema(errorHandlerElement, errorHandlerSchema),
      steps: this.transformSteps(errorHandlerElement), // If any steps are inside errorHandler
    };
  };

  transformOnCompletion = (onCompletionElement: Element): any => {
    if (!onCompletionElement) return null;
    const onCompletionSchema = this.schemaDefinitions['org.apache.camel.model.OnCompletionDefinition'] as JSONSchema4;
    return {
      ...getAttributesFromSchema(onCompletionElement, onCompletionSchema),
      steps: this.transformSteps(onCompletionElement), // Process steps
    };
  };
  transformOptionalExpression = (parentElement: Element, tagName: string): any => {
    const expressionElement = parentElement.getElementsByTagName(tagName)[0]?.children[0];
    return expressionElement ? this.transformExpression(expressionElement) : undefined;
  };

  transformFrom = (fromElement: Element): any => {
    const fromSchema = this.schemaDefinitions['org.apache.camel.model.FromDefinition'] as JSONSchema4;
    //const uri = fromElement.getAttribute('uri') ?? '';
    //const component = CamelComponentSchemaService.getComponentNameFromUri(uri);

    // console.log(JSON.stringify(CamelCatalogService.getComponent(CatalogKind.Component, component)?.propertiesSchema));
    return {
      ...getAttributesFromSchema(fromElement, fromSchema),
      steps: this.transformSteps(fromElement.parentElement!),
    };
  };

  transformSteps = (parentElement: Element): any[] => {
    const allowedSteps: {
      [key: string]: any;
    } = this.schemaDefinitions['org.apache.camel.model.ProcessorDefinition'].properties!;

    return Array.from(parentElement.children)
      .filter((child) => {
        const tagNameLower = child.tagName.toLowerCase();
        const stepKey = Object.keys(allowedSteps).find((key) => key.toLowerCase() === tagNameLower);
        return stepKey && !['doCatch', 'doFinally'].includes(stepKey); // Filter out elements not needed
      })
      .map((child) => {
        let stepSchema = allowedSteps[child.tagName!]; // `!` asserts that stepKey is not null/undefined

        // Dereference the schema if it's a reference
        if (stepSchema.$ref) {
          stepSchema = this.dereferenceSchema(stepSchema);
        }

        const step: any = {};
        step[child.tagName] = this.transformElement(child, stepSchema);
        return step;
      });
  };

  transformElement = (element: Element, elementSchema?: JSONSchema4): any => {
    if (!elementSchema) {
      // Handle primitive type
      return element.textContent;
    }

    const tagNameLower = element.tagName ? element.tagName : (element as unknown as string);
    if (tagNameLower === 'doTry') {
      return this.transformDoTry(element, elementSchema);
    } else if (['unmarshal', 'marshal'].includes(tagNameLower)) {
      return this.transformWithDataformat(element);
    } else if (tagNameLower === 'choice') {
      return this.transformChoice(element, elementSchema);
    } else if (['unmarshal', 'marshal'].includes(tagNameLower)) {
      return this.transformWithDataformat(element);
    }

    const step = { ...getAttributesFromSchema(element, elementSchema) };

    // If the schema has an 'expression' property, process the expression
    if (elementSchema.properties?.expression) {
      const expressionElement = Array.from(element.children).find((child) =>
        expressionKeys.includes(child.tagName.toLowerCase()),
      );

      if (expressionElement) {
        step['expression'] = this.transformExpression(expressionElement);
      }
    }

    // find property in the schema that is type of array
    if (elementSchema.properties?.steps) {
      step['steps'] = this.transformSteps(element); // Call transformSteps on the element
    }

    return step;
  };

  transformDoTry = (doTryElement: Element, doTrySchema: JSONSchema4): any => {
    const doCatchArray: any[] = [];
    let doFinallyElement = undefined;

    Array.from(doTryElement.children).forEach((child) => {
      const tagNameLower = child.tagName;

      // Check if the element is a doCatch
      if (child.tagName === 'doCatch') {
        doCatchArray.push(this.transformDoCatch(child));
      }
      // Check if the element is a doFinally
      else if (tagNameLower === 'doFinally') {
        doFinallyElement = this.transformDoFinally(child);
      }
    });

    return {
      ...getAttributesFromSchema(doTryElement, doTrySchema),
      steps: this.transformSteps(doTryElement), // All other steps except doCatch and doFinally
      doCatch: doCatchArray, // Processed doCatch elements
      doFinally: doFinallyElement, // Processed doFinally element if present
    };
  };

  transformDoCatch = (doCatchElement: Element): any => {
    const doCatchSchema = this.schemaDefinitions['org.apache.camel.model.CatchDefinition'] as JSONSchema4;

    // Process exceptions
    const exceptionElements = Array.from(doCatchElement.getElementsByTagName('exception'));
    const exceptions = exceptionElements.map((exceptionElement) => exceptionElement.textContent);

    // Process the onWhen element if present
    const onWhenElement = doCatchElement.getElementsByTagName('onWhen')[0];
    const onWhen = onWhenElement ? this.transformOnWhen(onWhenElement) : undefined;

    return {
      ...getAttributesFromSchema(doCatchElement, doCatchSchema),
      exception: exceptions, // Capture the exceptions
      onWhen: onWhen, // Capture onWhen if available
      steps: this.transformSteps(doCatchElement), // Process steps inside doCatch
    };
  };

  transformDoFinally = (doFinallyElement: Element): any => {
    const doFinallySchema = this.schemaDefinitions['org.apache.camel.model.FinallyDefinition'];
    return {
      ...getAttributesFromSchema(doFinallyElement, doFinallySchema),
      steps: this.transformSteps(doFinallyElement), // Process the steps inside doFinally
    };
  };

  transformOnWhen = (onWhenElement: Element): any => {
    const onWhenSchema = this.schemaDefinitions['org.apache.camel.model.WhenDefinition'];
    const expressionElement = Array.from(onWhenElement.children).find((child) => {
      return expressionKeys.includes(child.tagName.toLowerCase()); // Check if it's an expression
    });

    return {
      ...getAttributesFromSchema(onWhenElement, onWhenSchema),
      expression: expressionElement ? this.transformExpression(expressionElement) : null, // Transform expression if available
    };
  };

  transformExpression = (expressionElement: Element): any => {
    const expressionType = expressionElement.tagName;
    const expressionSchema = this.dereferenceSchemaByRef(expressionsSchemas[expressionType]);
    const expressionAttributes = getAttributesFromSchema(expressionElement, expressionSchema);

    return {
      [expressionType]: { expression: expressionElement.textContent, ...expressionAttributes },
    };
  };
  transformChoice = (choiceElement: Element, choiceSchema: JSONSchema4): any => {
    const whenElements = Array.from(choiceElement.getElementsByTagName('when'));
    const otherwiseElement = choiceElement.getElementsByTagName('otherwise')[0];

    return {
      ...getAttributesFromSchema(choiceElement, choiceSchema),
      when: whenElements.map(this.transformWhen),
      otherwise: otherwiseElement ? this.transformOtherwise(otherwiseElement) : null,
    };
  };

  transformOtherwise = (otherwiseElement: Element): any => {
    const otherwiseSchema = this.schemaDefinitions['org.apache.camel.model.OtherwiseDefinition']
      .properties as unknown as JSONSchema4;
    return {
      ...getAttributesFromSchema(otherwiseElement, otherwiseSchema),
      steps: this.transformSteps(otherwiseElement),
    };
  };

  transformWhen = (whenElement: Element): any => {
    const whenSchema: JSONSchema4 = this.schemaDefinitions['org.apache.camel.model.WhenDefinition']
      .properties as unknown as JSONSchema4;
    const expressionElement = Array.from(whenElement.children).find((child) => {
      return expressionKeys.includes(child.tagName.toLowerCase()); // Check if it's an expression
    });

    return {
      ...getAttributesFromSchema(whenElement, whenSchema),
      expression: expressionElement ? this.transformExpression(expressionElement) : null, // Call transformExpression
      steps: this.transformSteps(whenElement), // Continue transforming steps if any
    };
  };

  transformWithDataformat = (unmarshalElement: Element): any => {
    const dataFormatElement = unmarshalElement.children[0];

    if (!dataFormatElement) return {};

    // Check if there's a definition for this specific data format (e.g., json, xml, etc.)
    const dataFormatKey = `org.apache.camel.model.dataformat.${capitalize(dataFormatElement.tagName)}DataFormat`;
    const dataFormatSchema = this.schemaDefinitions[dataFormatKey];

    if (!dataFormatSchema) {
      console.warn(`Data format ${dataFormatElement.tagName} is not defined in schema.`);
      return {};
    }

    return {
      [dataFormatElement.tagName]: {
        ...getAttributesFromSchema(dataFormatElement, dataFormatSchema),
      },
    };
  };
}
