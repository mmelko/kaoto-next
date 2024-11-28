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

import { XmlParser, isXML } from './xml-parser';
import catalogLibrary from '@kaoto/camel-catalog/index.json';
import { getFirstCatalogMap } from '../../stubs/test-load-catalog';
import { CatalogLibrary } from '@kaoto/camel-catalog/types';
import { JSONSchema4 } from 'json-schema';
import { doTryCamelRouteJson, doTryCamelRouteXml } from '../../stubs';
import { beanWithConstructorAandProperties, beanWithConstructorAandPropertiesXML } from '../../stubs/beans';
import { CamelResource, CamelRouteResource } from '../../models/camel';
import { CamelRouteVisualEntity } from '../../models';
import { formatXml } from './xml-utils';

describe('XmlParser', () => {
  let parser: XmlParser;
  let schema: JSONSchema4;

  beforeEach(async () => {
    const cat = await getFirstCatalogMap(catalogLibrary as CatalogLibrary);
    schema = await import(cat.catalogPath + cat.catalogDefinition.schemas['camelYamlDsl'].file);
    parser = new XmlParser(schema);
  });

  it('parses XML with a single route correctly', () => {
    const xml = `<routes><route><from uri="direct:start" /></route></routes>`;
    const result = parser.parseXML(xml);
    expect(result).toEqual([
      {
        route: {
          from: { uri: 'direct:start', steps: [] },
        },
      },
    ]);
  });

  it('parses XML with multiple routes correctly', () => {
    const xml = `<routes><route id="test"><from uri="direct:first" /></route><route><from uri="direct:second" /></route></routes>`;
    const result = parser.parseXML(xml);
    expect(result).toEqual([
      {
        route: { id: 'test', from: { uri: 'direct:first', steps: [] } },
      },
      {
        route: {
          from: { uri: 'direct:second', steps: [] },
        },
      },
    ]);
  });

  it('returns an empty array for XML with no routes', () => {
    const xml = `<routes></routes>`;
    const result = parser.parseXML(xml);
    expect(result).toEqual([]);
  });

  it('dereferences schema correctly', () => {
    const dSchema = { $ref: '#/items/definitions/org.apache.camel.model.language.ConstantExpression' };
    const result = parser.dereferenceSchema(dSchema);
    const expectedSchema = (schema.items as JSONSchema4).definitions as unknown as Record<string, JSONSchema4>;
    expect(result).toEqual(expectedSchema['org.apache.camel.model.language.ConstantExpression']);
  });

  it('returns the same schema if no $ref is present', () => {
    const dSchema = { type: 'string' };
    const result = parser.dereferenceSchema(dSchema as JSONSchema4);
    expect(result).toEqual(dSchema);
  });

  it('identifies valid XML correctly', () => {
    const xml = `<routes><route><from uri="direct:start" /></route></routes>`;
    expect(isXML(xml)).toBe(true);
  });

  it('identifies invalid XML correctly', () => {
    const xml = `not an xml`;
    expect(isXML(xml)).toBe(false);
  });

  it('parses XML with doTry correctly', () => {
    const result = parser.parseXML(doTryCamelRouteXml);
    expect(result).toEqual([doTryCamelRouteJson]);
  });

  it('parse beans correctly', () => {
    const result = parser.parseXML(beanWithConstructorAandPropertiesXML);
    expect(result).toEqual([beanWithConstructorAandProperties]);
  });

  describe('ToXMLConverter', () => {
    let parser: XmlParser;
    let schema: JSONSchema4;
    const domParser = new DOMParser();
    const xmlSerializer = new XMLSerializer();

    beforeEach(async () => {
      const cat = await getFirstCatalogMap(catalogLibrary as CatalogLibrary);
      schema = await import(cat.catalogPath + cat.catalogDefinition.schemas['camelYamlDsl'].file);
      parser = new XmlParser(schema);
    });

    it('Convert single route entity to XML correctly', () => {
      const doc = domParser.parseFromString(
        `<camel><routes><route id="route-1234"><from uri="direct:start"/></route></routes></camel>`,
        'application/xml',
      );

      const entity = new CamelRouteResource([
        {
          route: {
            from: { uri: 'direct:start', steps: [{ to: { uri: 'direct:end' } }] },
          },
        },
      ]);

      const result = parser.generateXmlDocument(entity);
      console.log('result', formatXml(xmlSerializer.serializeToString(result)));
      expect(xmlSerializer.serializeToString(result)).toEqual(xmlSerializer.serializeToString(doc));
    });

    it('converts to XML correctly', () => {
      const result = xmlSerializer.serializeToString(parser.generateXmlDocument([doTryCamelRouteJson]));
      expect(result).toEqual(doTryCamelRouteXml);
    });
  });
});
