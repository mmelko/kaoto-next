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
import catalogLibrary from '@kaoto/camel-catalog/index.json';
import { RouteXmlParser } from './route-xml-parser';
import { CatalogLibrary } from '@kaoto/camel-catalog/types';
import { getFirstCatalogMap } from '../../../stubs/test-load-catalog';
import { CamelCatalogService, CatalogKind } from '../../../models';
import { XmlParser } from '../xml-parser';
import { describe } from 'node:test';

export const getElementFromXml = (xml: string): Element => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, 'application/xml');
  return xmlDoc.documentElement;
};

describe('RouteXmlParser', () => {
  let parser: RouteXmlParser;
  beforeAll(async () => {
    const catalogsMap = await getFirstCatalogMap(catalogLibrary as CatalogLibrary);
    CamelCatalogService.setCatalogKey(CatalogKind.Processor, catalogsMap.modelCatalogMap);
  });

  beforeEach(async () => {
    parser = new RouteXmlParser();
  });

  it('transforms intercept element correctly', () => {
    const interceptElement = getElementFromXml(` <intercept id="intercept1">
      <when>
          <simple>\${in.body} contains 'Hello'</simple>
      </when>
      <to uri="mock:intercepted"/>
  </intercept>`);
    const result = parser.transformRouteConfigurationElement(interceptElement, 'intercept');
    expect(result).toEqual({
      intercept: {
        id: 'intercept1',
        steps: [
          {
            when: {
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
    const result = parser.transformRouteConfigurationElement(interceptFromElement, 'interceptFrom');
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

    const result = parser.transformRouteConfigurationElement(interceptSendToEndpointElement, 'interceptSendToEndpoint');
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

    const result = parser.transformElement(onExceptionElement);
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

    const result = parser.transformElement(onCompletionElement);
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

    const result = parser.transformElement(choiceElement);
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

  it('transforms xpath with namespaces set', () => {
    const parser = new XmlParser();
    const namespaceDocument = new DOMParser().parseFromString(
      `
  <camel xmlns:ns1="n1">
    <routes xmlns:ns2="n2" >
    <route xmlns:ns3="n3" >
    <from uri="direct:one"/>
    <choice>
    <when>
      <xpath>/ns1:foo/</xpath>
      <to uri="mock:bar"/>
    </when>
    </choice>
    </route>
</routes>
</camel>  
  `,
      'application/xml',
    );

    const result = parser.parseFromXmlDocument(namespaceDocument);
    expect(result).toEqual([
      {
        route: {
          from: {
            steps: [
              {
                choice: {
                  when: [
                    {
                      expression: {
                        xpath: {
                          expression: '/ns1:foo/',
                          namespace: [
                            { key: 'ns1', value: 'n1' },
                            { key: 'ns2', value: 'n2' },
                            { key: 'ns3', value: 'n3' },
                          ],
                        },
                      },
                      steps: [{ to: { uri: 'mock:bar' } }],
                    },
                  ],
                },
              },
            ],
            uri: 'direct:one',
          },
        },
      },
    ]);
  });
});
