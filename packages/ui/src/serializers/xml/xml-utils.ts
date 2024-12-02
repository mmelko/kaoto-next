// @ts-nocheck
import { JSONSchema4 } from 'json-schema';

export function getAttributesFromSchema(element: Element, schema: JSONSchema4): any {
  const attributes: { [key: string]: string } = {};
  const properties = extractProperties(schema);

  Object.keys(properties).forEach((key) => {
    if (element.hasAttribute(key)) {
      attributes[key] = element.getAttribute(key) as string;
    }
  });
  return attributes;
}

export function extractProperties(schema: JSONSchema4): Record<string, any> {
  if (schema.properties) {
    return schema.properties;
  }

  if (schema.oneOf || schema.anyOf) {
    const combinedSchemas = schema.oneOf || schema.anyOf || [];
    for (const subSchema of combinedSchemas) {
      if (subSchema.properties) {
        return subSchema.properties;
      }
    }
  }
  return {};
}

export function formatXml(xml: string) {
  // simple XML format used instead of HTML formatting in monaco
  const PADDING = ' '.repeat(2);
  const reg = /(>)(<)(\/*)/g;
  let pad = 0;

  xml = xml.replace(reg, '$1\r\n$2$3');

  return xml
    .split('\r\n')
    .map((node) => {
      let indent = 0;
      if (node.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (node.match(/^<\/\w/) && pad > 0) {
        pad -= 1;
      } else if (node.match(/^<\w[^>]*[^/]>.*$/)) {
        indent = 1;
      } else {
        indent = 0;
      }
      pad += indent;

      return PADDING.repeat(pad - indent) + node;
    })
    .join('\r\n');
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
