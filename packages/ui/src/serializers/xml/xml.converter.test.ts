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
