import { CamelCatalogService, CatalogKind } from '../../../models';
import { StepXmlSerializer } from './step-xml-serializer';

export class BeansXmlSerializer {
  static serialize(beanElement: { [key: string]: unknown }, doc: Document): Element | undefined {
    const bean = doc.createElement('bean');
    const properties = CamelCatalogService.getComponent(CatalogKind.Processor, 'beanFactory')?.properties;
    if (!properties) return undefined;

    StepXmlSerializer.serializeObjectProperties(bean, doc, beanElement, properties);

    if (beanElement['constructors']) {
      bean.appendChild(this.serializeConstructors(beanElement['constructors'], doc));
    }

    if (beanElement['properties']) {
      bean.appendChild(this.serializeProperties(beanElement['properties'], doc));
    }
    return bean;
  }

  static serializeProperties(properties: unknown, doc: Document) {
    const propertiesElement = doc.createElement('properties');
    for (const [key, value] of Object.entries(properties as { [key: string]: string })) {
      const propertyElement = doc.createElement('property');
      propertyElement.setAttribute('key', key);
      propertyElement.setAttribute('value', value);
      propertiesElement.appendChild(propertyElement);
    }
    return propertiesElement;
  }

  static serializeConstructors(constructors: unknown, doc: Document): Element {
    const constructorsElement = doc.createElement('constructors');
    for (const [key, value] of Object.entries(constructors as { [key: string]: string })) {
      const constructorElement = doc.createElement('constructor');
      constructorElement.setAttribute('index', key);
      constructorElement.setAttribute('value', value);
      constructorsElement.appendChild(constructorElement);
    }
    return constructorsElement;
  }
}
