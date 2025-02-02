import { describe } from 'node:test';
import catalogLibrary from '@kaoto/camel-catalog/index.json';
import { StepParser } from './step-parser';
import { getElementFromXml } from './route-xml-parser.test';
import { getFirstCatalogMap } from '../../../stubs/test-load-catalog';
import { CatalogLibrary } from '@kaoto/camel-catalog/types';
import { CamelCatalogService, CatalogKind } from '../../../models';
import {
  aggregateXml,
  choiceXml,
  circuitBreakerXml,
  deadLetterChannelXml,
  doTryXml,
  dynamicRouterXml,
  enrichXml,
  filterXml,
  loadBalanceXml,
  loopXml,
  multicastXml,
  pipelineXml,
  recipientListXml,
  resequenceXml,
  routingSlipXml,
  sagaXml,
  splitXml,
  throttleXml,
} from '../../../stubs/eip-xml-snippets';
import {
  aggregateEntity,
  choiceEntity,
  circuitBreakerEntity,
  deadLetterChannelEntity,
  doTryEntity,
  dynamicRouterEntity,
  enrichEntity,
  filterEntity,
  loadBalanceEntity,
  loopEntity,
  multicastEntity,
  pipelineEntity,
  recipientListEntity,
  resequenceEntity,
  routingSlipEntity,
  sagaEntity,
  splitEntity,
  throttleEntity,
} from '../../../stubs/eip-entity-snippets';

describe('ProcessorParser', () => {
  beforeAll(async () => {
    const catalogsMap = await getFirstCatalogMap(catalogLibrary as CatalogLibrary);
    CamelCatalogService.setCatalogKey(CatalogKind.Processor, catalogsMap.modelCatalogMap);
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

    const result = StepParser.parseElement(onExceptionElement);
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

    const result = StepParser.parseElement(onCompletionElement);
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

    const result = StepParser.parseElement(choiceElement);
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
});

describe('Route EIPs xml parsing', () => {
  let transformElement: (element: string) => unknown;

  beforeAll(async () => {
    const catalogsMap = await getFirstCatalogMap(catalogLibrary as CatalogLibrary);
    CamelCatalogService.setCatalogKey(CatalogKind.Processor, catalogsMap.modelCatalogMap);

    transformElement = (element: string) => {
      const xmlDoc = getElementFromXml(element);
      return StepParser.parseElement(xmlDoc);
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
  ];

  it.each(testCases)('Parse $name', ({ xml, entity }) => {
    const result = transformElement(xml);
    expect(result).toEqual(entity);
  });
});
