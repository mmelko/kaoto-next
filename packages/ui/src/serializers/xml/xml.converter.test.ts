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

import { XmlConverter } from './xml-converter';
import { CamelRouteResource } from '../../models/camel';
import { formatXml } from './xml-utils';
import { doTryCamelRouteJson, doTryCamelRouteXml } from '../../stubs';

describe('ToXMLConverter', () => {
  const converter: XmlConverter = new XmlConverter();
  const domParser = new DOMParser();
  const xmlSerializer = new XMLSerializer();

  it('Convert single route entity to XML correctly', () => {
    const doc = domParser.parseFromString(
      `<camel><routes><route><from uri="direct:start"/></route></routes></camel>`,
      'application/xml',
    );

    const entity = new CamelRouteResource([
      {
        route: {
          from: { uri: 'direct:start', steps: [{ to: { uri: 'direct:end' } }] },
        },
      },
    ]);

    const result = converter.generateXmlDocument(entity);
    console.log('result', formatXml(xmlSerializer.serializeToString(result)));
    expect(xmlSerializer.serializeToString(result)).toEqual(xmlSerializer.serializeToString(doc));
  });

  it('converts to XML correctly', () => {
    const result = xmlSerializer.serializeToString(converter.generateXmlDocument([doTryCamelRouteJson]));
    expect(result).toEqual(doTryCamelRouteXml);
  });
});
