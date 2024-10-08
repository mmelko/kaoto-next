import { JSONSchema4 } from 'json-schema';

export class RestXmlParser {
  schemaDefinitions: Record<string, JSONSchema4>;

  constructor(schemaDefinitions: Record<string, JSONSchema4>) {
    this.schemaDefinitions = schemaDefinitions;
  }

  // Main transformation for <rest> elements
  transformRest = (restElement: Element): any => {
    return {
      path: restElement.getAttribute('path'),
      ...this.transformRestVerbs(restElement),
    };
  };

  // Transform verbs like <get>, <post>, etc.
  transformRestVerbs = (restElement: Element): any => {
    const verbs: { [key: string]: any } = {};
    const verbNames = ['get', 'post', 'put', 'delete', 'patch', 'head'];

    // For each verb, look for its elements and transform them
    verbNames.forEach((verb) => {
      const verbInstances = Array.from(restElement.getElementsByTagName(verb));
      if (verbInstances.length > 0) {
        verbs[verb] = verbInstances.map((verbElement: Element) => this.transformRestVerb(verbElement, verb));
      }
    });

    return verbs; // Return the dynamically populated verbs object
  };

  // Transform each individual HTTP verb (get, post, etc.)
  transformRestVerb = (verbElement: Element, verb: string): any => {
    // Get the corresponding definition from the schema, e.g., GetDefinition for <get>
    const verbSchemaKey = `org.apache.camel.model.rest.${this.capitalize(verb)}Definition`;
    const verbSchema = this.schemaDefinitions[verbSchemaKey];

    return {
      ...this.getAttributesFromSchema(verbElement, verbSchema),
      to: this.transformTo(verbElement.getElementsByTagName('to')[0]),
      params: this.transformParams(verbElement),
      security: this.transformSecurity(verbElement), // New
      responseMessages: this.transformResponseMessages(verbElement), // New
    };
  };

  // Transform the <param> elements inside each verb
  transformParams = (verbElement: Element): any[] => {
    return Array.from(verbElement.getElementsByTagName('param')).map((paramElement) => ({
      name: paramElement.getAttribute('name'),
      type: paramElement.getAttribute('type'),
      required: paramElement.getAttribute('required') === 'true',
      defaultValue: paramElement.getAttribute('defaultValue'),
    }));
  };

  // Transform the <to> element inside each verb
  transformTo = (toElement: Element): any => {
    return toElement ? { uri: toElement.getAttribute('uri') } : null;
  };

  // New: Transform <security> elements inside verbs
  transformSecurity = (verbElement: Element): any[] => {
    return Array.from(verbElement.getElementsByTagName('security')).map((securityElement) => {
      return {
        [securityElement.getAttribute('type')!]: {
          roles: securityElement.getAttribute('roles')?.split(',') || [],
        },
      };
    });
  };

  // New: Transform <responseMessage> elements inside verbs
  transformResponseMessages = (verbElement: Element): any[] => {
    return Array.from(verbElement.getElementsByTagName('responseMessage')).map((responseMessageElement) => ({
      code: responseMessageElement.getAttribute('code'),
      message: responseMessageElement.getAttribute('message'),
    }));
  };

  // Helper method to extract attributes from schema
  getAttributesFromSchema = (element: Element, schema: JSONSchema4): any => {
    const attributes: { [key: string]: string } = {};
    const properties = schema.properties || {};

    Object.keys(properties).forEach((key) => {
      if (element.hasAttribute(key)) {
        attributes[key] = element.getAttribute(key) as string;
      }
    });

    return attributes;
  };

  // Helper to capitalize the first letter of verbs like 'get' to 'Get'
  capitalize = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };
}
