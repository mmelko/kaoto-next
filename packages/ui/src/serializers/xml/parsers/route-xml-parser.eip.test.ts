// packages/ui/src/serializers/xml/parsers/route-xml-parser.eip.test.ts

import catalogLibrary from '@kaoto/camel-catalog/index.json';
import { describe } from 'node:test';
import { RouteXmlParser } from './route-xml-parser';
import { getFirstCatalogMap } from '../../../stubs/test-load-catalog';
import { CatalogLibrary } from '@kaoto/camel-catalog/types';
import { CamelCatalogService, CatalogKind } from '../../../models';
import { getElementFromXml } from './route-xml-parser.test';
import {
  aggregateXml,
  circuitBreakerXml,
  filterXml,
  loadBalanceXml,
  loopXml,
  multicastXml,
  pipelineXml,
  resequenceXml,
  sagaXml,
  splitXml,
  choiceXml,
  doTryXml,
  deadLetterChannelXml,
  enrichXml,
  dynamicRouterXml,
  recipientListXml,
  routingSlipXml,
  throttleXml,
  sampleXml,
} from '../../../stubs/eip-xml-snippets';
import {
  aggregateEntity,
  circuitBreakerEntity,
  filterEntity,
  loadBalanceEntity,
  loopEntity,
  multicastEntity,
  pipelineEntity,
  resequenceEntity,
  sagaEntity,
  splitEntity,
  choiceEntity,
  doTryEntity,
  deadLetterChannelEntity,
  enrichEntity,
  dynamicRouterEntity,
  recipientListEntity,
  routingSlipEntity,
  throttleEntity,
  sampleEntity,
} from '../../../stubs/eip-entity-snippets';

describe('Route EIPs xml parsing', () => {
  let parser: RouteXmlParser;
  let transformElement: (element: string) => unknown;

  beforeAll(async () => {
    parser = new RouteXmlParser();
    const catalogsMap = await getFirstCatalogMap(catalogLibrary as CatalogLibrary);
    CamelCatalogService.setCatalogKey(CatalogKind.Processor, catalogsMap.modelCatalogMap);

    transformElement = (element: string) => {
      const xmlDoc = getElementFromXml(element);
      return parser.transformElement(xmlDoc);
    };
  });

  const testCases = [
    { name: 'aggregate', xml: aggregateXml, entity: aggregateEntity },
    { name: 'circuitBreaker', xml: circuitBreakerXml, entity: circuitBreakerEntity },
    { name: 'filter', xml: filterXml, entity: filterEntity },
    { name: 'loadBalance', xml: loadBalanceXml, entity: loadBalanceEntity },
    { name: 'loop', xml: loopXml, entity: loopEntity },
    { name: 'multicast', xml: multicastXml, entity: multicastEntity },
    { name: 'pipeline', xml: pipelineXml, entity: pipelineEntity },
    { name: 'resequence', xml: resequenceXml, entity: resequenceEntity },
    { name: 'saga', xml: sagaXml, entity: sagaEntity },
    { name: 'split', xml: splitXml, entity: splitEntity },
    { name: 'choice', xml: choiceXml, entity: choiceEntity },
    { name: 'doTry', xml: doTryXml, entity: doTryEntity },
    { name: 'deadLetterChannel', xml: deadLetterChannelXml, entity: deadLetterChannelEntity },
    { name: 'enrich', xml: enrichXml, entity: enrichEntity },
    { name: 'dynamicRouter', xml: dynamicRouterXml, entity: dynamicRouterEntity },
    { name: 'recipientList', xml: recipientListXml, entity: recipientListEntity },
    { name: 'routingSlip', xml: routingSlipXml, entity: routingSlipEntity },
    { name: 'throttle', xml: throttleXml, entity: throttleEntity },
    { name: 'sample', xml: sampleXml, entity: sampleEntity },
  ];

  it.each(testCases)('Parse $name', ({ xml, entity }) => {
    const result = transformElement(xml);
    expect(result).toEqual(entity);
  });
});
