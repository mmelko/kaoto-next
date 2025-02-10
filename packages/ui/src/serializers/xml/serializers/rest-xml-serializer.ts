import { StepXmlSerializer } from './step-xml-serializer';
import { Rest } from '@kaoto/camel-catalog/types';

export class RestXmlSerializer {
  private static readonly REST_ELEMENT_NAME = 'rest';
  private static readonly REST_VERBS = ['get', 'post', 'put', 'delete', 'patch', 'head'];
  //properties that are missing in the catalog (up to 4.9)
  private static readonly MISSING_PROPERTIES = ['param', 'security', 'responseMessage'];

  static serialize(rest: { [key: string]: unknown }, doc: Document): Element {
    const element = StepXmlSerializer.serialize(RestXmlSerializer.REST_ELEMENT_NAME, rest, doc);

    const restObject = rest as Rest;
    this.REST_VERBS.forEach((verb) => {
      const verbKey = verb as keyof Rest;
      if (restObject[verbKey]) {
        (rest[verbKey] as { [key: string]: unknown }[]).forEach((verbInstance: { [key: string]: unknown }) => {
          const verbElement = StepXmlSerializer.serialize(verb, verbInstance, doc, element);
          this.handleMissingProperties(verbElement, verbInstance, doc);
          element.appendChild(verbElement);
        });
      }
    });

    return element;
  }
  private static handleMissingProperties(element: Element, rest: { [key: string]: unknown }, doc: Document) {
    for (const prop of this.MISSING_PROPERTIES) {
      if (!rest[prop] || this.containsMissingProperty(prop, element)) continue;
      (rest[prop] as unknown[]).forEach((propInstance) => {
        element.appendChild(
          StepXmlSerializer.serialize(prop, propInstance as { [key: string]: unknown }, doc, element),
        );
      });
    }
  }

  private static containsMissingProperty(prop: string, element: Element): boolean {
    return Array.from(element.children).filter((child) => child.tagName === prop).length > 0;
  }
}
