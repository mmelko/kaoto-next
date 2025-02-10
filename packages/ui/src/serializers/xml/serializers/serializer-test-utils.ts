import { formatXml } from '../xml-utils';

export const normalizeXml = (xml: string) =>
  xml
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();

export const getDocument = () => {
  const parser = new DOMParser();
  return parser.parseFromString('', 'text/xml');
};

export const testSerializer = (expectedXML: string, result: Element) => {
  const xmlSerializer: XMLSerializer = new XMLSerializer();
  const resultString = formatXml(xmlSerializer.serializeToString(result));
  const expected = formatXml(expectedXML);
  expect(result).toBeDefined();
  ``;
  expect(normalizeXml(resultString)).toEqual(normalizeXml(expected));
};
