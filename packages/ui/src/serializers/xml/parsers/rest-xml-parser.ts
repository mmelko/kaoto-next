/*
 * Copyright (C) 2023 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { JSONSchema4 } from 'json-schema';
import {
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  ResponseMessage,
  Rest,
  RestSecurity,
  To,
} from '@kaoto/camel-catalog/types';
import { extractAttributes } from '../xml-utils';

export class RestXmlParser {
  schemaDefinitions: Record<string, JSONSchema4>;
  // readonly restTypes = {
  //   get: Get,
  //   post: Post,
  // };

  constructor(schemaDefinitions: Record<string, JSONSchema4>) {
    this.schemaDefinitions = schemaDefinitions;
  }

  // Main transformation for <rest> elements
  transformRest = (restElement: Element): Rest => {
    return {
      ...extractAttributes<Rest>(restElement),
      ...this.transformRestVerbs(restElement),
    };
  };

  // Transform verbs like <get>, <post>, etc.
  transformRestVerbs = (restElement: Element): Rest => {
    const verbs: { [key: string]: unknown } = {};
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

  private extractAttributes = (verb: string, element: Element): Partial<Get | Post | Patch | Put | Delete> => {
    switch (verb) {
      case 'get':
        return extractAttributes<Get>(element);
      case 'post':
        return extractAttributes<Post>(element);
      case 'put':
        return extractAttributes<Put>(element);
      case 'delete':
        return extractAttributes<Delete>(element);
      case 'patch':
        return extractAttributes<Patch>(element);
    }
    return {};
  };
  // Transform each individual HTTP verb (get, post, etc.)
  transformRestVerb = (verbElement: Element, verb: string): Get | Post | Patch | Put | Delete => {
    const partial = this.extractAttributes(verb, verbElement);

    return {
      ...partial,
      to: this.transformTo(verbElement.getElementsByTagName('to')[0]),
      param: this.transformParams(verbElement),
      security: this.transformSecurity(verbElement), // New
      responseMessage: this.transformResponseMessages(verbElement), // New
    };
  };

  // Transform the <param> elements inside each verb
  transformParams = (verbElement: Element): Param[] => {
    return Array.from(verbElement.getElementsByTagName('param')).map((paramElement) => ({
      name: paramElement.getAttribute('name')!,
      type: paramElement.getAttribute('type') as 'body' | 'formData' | 'header' | 'path' | 'query',
      required: paramElement.getAttribute('required') === 'true',
      defaultValue: paramElement.getAttribute('defaultValue') ?? undefined,
    }));
  };

  // Transform the <to> element inside each verb
  transformTo = (toElement: Element): To | undefined => {
    return toElement ? extractAttributes<To>(toElement) : undefined;
  };

  // New: Transform <security> elements inside verbs
  transformSecurity = (verbElement: Element): RestSecurity[] => {
    return Array.from(verbElement.getElementsByTagName('security')).map((securityElement) => {
      return {
        [securityElement.getAttribute('type')!]: {
          roles: securityElement.getAttribute('roles')?.split(',') || [],
        },
      } as unknown as RestSecurity;
    });
  };

  // New: Transform <responseMessage> elements inside verbs
  transformResponseMessages = (verbElement: Element): ResponseMessage[] => {
    return Array.from(verbElement.getElementsByTagName('responseMessage')).map((responseMessageElement) => ({
      code: responseMessageElement.getAttribute('code') ?? undefined,
      message: responseMessageElement.getAttribute('message') as string,
    }));
  };

  // Helper method to extract attributes from schema

  // Helper to capitalize the first letter of verbs like 'get' to 'Get'
  capitalize = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };
}
