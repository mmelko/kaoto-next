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

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
