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

import { RouteXmlParser } from './route-xml-parser';
import { JSONSchema4 } from 'json-schema';
import { getFirstCatalogMap } from '../../../stubs/test-load-catalog';
import { CatalogLibrary } from '@kaoto/camel-catalog/types';
import catalogLibrary from '@kaoto/camel-catalog/index.json';
import { XmlParser } from '../xml-parser';

const getElementFromXml = (xml: string): Element => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, 'application/xml');
  return xmlDoc.documentElement;
};

describe('RouteXmlParser', () => {
  let parser: RouteXmlParser;
  let schemaDefinitions: Record<string, JSONSchema4>;

  beforeEach(async () => {
    const cat = await getFirstCatalogMap(catalogLibrary as CatalogLibrary);
    const schema = await import(cat.catalogPath + cat.catalogDefinition.schemas['camelYamlDsl'].file);
    schemaDefinitions = (schema.items as JSONSchema4).definitions as unknown as Record<string, JSONSchema4>;
    parser = new RouteXmlParser(schemaDefinitions);
  });

  it('transforms intercept element correctly', () => {
    const interceptElement = getElementFromXml(` <intercept id="intercept1">
      <when>
          <simple>\${in.body} contains 'Hello'</simple>
      </when>
      <to uri="mock:intercepted"/>
  </intercept>`);
    const result = parser.transformIntercepts(interceptElement);
    expect(result).toEqual({
      intercept: {
        id: 'intercept1',
        steps: [
          {
            when: {
              steps: [],
              expression: {
                simple: {
                  expression: "${in.body} contains 'Hello'",
                },
              },
            },
          },
          {
            to: { uri: 'mock:intercepted' },
          },
        ],
      },
    });
  });

  it('transforms interceptFrom element correctly', () => {
    const interceptFromElement = getElementFromXml(`<interceptFrom id="interceptFrom1" uri="jms*">
    <to uri="log:incoming"/>
  </interceptFrom>`);
    const result = parser.transformIntercepts(interceptFromElement);
    expect(result).toEqual({
      interceptFrom: {
        id: 'interceptFrom1',
        uri: 'jms*',
        steps: [{ to: { uri: 'log:incoming' } }],
      },
    });
  });

  it('transforms interceptSendToEndpoint element correctly', () => {
    const interceptSendToEndpointElement = getElementFromXml(`
      <interceptSendToEndpoint uri="kafka*" afterUri="bean:afterKafka">
    <to uri="bean:beforeKafka"/>
      </interceptSendToEndpoint>
    `);

    const result = parser.transformIntercepts(interceptSendToEndpointElement);
    expect(result).toEqual({
      interceptSendToEndpoint: {
        uri: 'kafka*',
        afterUri: 'bean:afterKafka',
        steps: [
          {
            to: {
              uri: 'bean:beforeKafka',
            },
          },
        ],
      },
    });
  });
  it('transforms onException element correctly', () => {
    const onExceptionElement = getElementFromXml(`
    <onException>
      <exception>java.lang.Exception</exception>
      <handled>
        <constant>true</constant>
      </handled>
      <to uri="mock:error"/>
    </onException>
  `);

    const result = parser.transformOnException(onExceptionElement);
    expect(result).toEqual({
      exception: ['java.lang.Exception'],
      handled: { constant: { expression: 'true' } },
      steps: [{ to: { uri: 'mock:error' } }],
    });
  });

  it('transforms onCompletion element correctly', () => {
    const onCompletionElement = getElementFromXml(`
    <onCompletion>
      <to uri="mock:completion"/>
    </onCompletion>
  `);

    const result = parser.transformOnCompletion(onCompletionElement);
    expect(result).toEqual({
      steps: [{ to: { uri: 'mock:completion' } }],
    });
  });

  it('transforms choice element correctly', () => {
    const choiceElement = getElementFromXml(`
    <choice>
      <when>
        <simple>\${header.foo} == 'bar'</simple>
        <to uri="mock:when"/>
      </when>
      <otherwise>
        <to uri="mock:otherwise"/>
      </otherwise>
    </choice>
  `);

    const result = parser.transformChoice(choiceElement, schemaDefinitions['org.apache.camel.model.ChoiceDefinition']);
    expect(result).toEqual({
      when: [
        {
          expression: { simple: { expression: "${header.foo} == 'bar'" } },
          steps: [{ to: { uri: 'mock:when' } }],
        },
      ],
      otherwise: {
        steps: [{ to: { uri: 'mock:otherwise' } }],
      },
    });
  });

  it('transforms doTry and doCatch elements correctly', () => {
    const doTryElement = getElementFromXml(`
    <doTry>
      <to uri="mock:try"/>
      <doCatch>
        <exception>java.lang.Exception</exception>
        <to uri="mock:catch"/>
      </doCatch>
      <doFinally>
        <to uri="mock:finally"/>
      </doFinally>
    </doTry>
  `);

    const result = parser.transformDoTry(doTryElement, schemaDefinitions['org.apache.camel.model.TryDefinition']);
    expect(result).toEqual({
      steps: [{ to: { uri: 'mock:try' } }],
      doCatch: [
        {
          exception: ['java.lang.Exception'],
          steps: [{ to: { uri: 'mock:catch' } }],
        },
      ],
      doFinally: {
        steps: [{ to: { uri: 'mock:finally' } }],
      },
    });
  });
});
