/*
    Copyright (C) 2024 Red Hat, Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

            http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

import { SourceSchemaType } from './source-schema-type';
import { CamelResource } from './camel-resource';
import { CamelResourceSerializer, XmlCamelResourceSerializer, YamlCamelResourceSerializer } from '../../serializers';
import { CamelRouteResource } from './camel-route-resource';
import { CamelKResourceFactory } from './camel-k-resource-factory';

export class CamelResourceFactory {
  /**
   * Creates a CamelResource based on the given {@link type} and {@link source}. If
   * both are not specified, a default empty {@link CamelRouteResource} is created.
   * If only {@link type} is specified, an empty {@link CamelResource} of the given
   * {@link type} is created.
   * @param type
   * @param source
   */
  static createCamelResource(source?: string, type?: SourceSchemaType): CamelResource {
    const serializer: CamelResourceSerializer = XmlCamelResourceSerializer.isApplicable(source)
      ? new XmlCamelResourceSerializer()
      : new YamlCamelResourceSerializer();

    const parsedCode = source ? serializer.parse(source) : source;
    const resource = CamelKResourceFactory.getCamelKResource(parsedCode, type);

    if (resource) return resource;
    return new CamelRouteResource(parsedCode, serializer);
  }
}
