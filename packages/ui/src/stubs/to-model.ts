import { CatalogKind, ICamelProcessorDefinition } from '../models';

export const toModel: ICamelProcessorDefinition = {
  model: {
    kind: CatalogKind.Processor,
    name: 'to',
    title: 'To',
    description: 'Sends the message to a static endpoint',
    deprecated: false,
    label: 'eip,routing',
    javaType: 'org.apache.camel.model.ToDefinition',
    abstract: false,
    input: true,
    output: false,
  },
  properties: {
    uri: {
      index: 0,
      kind: 'attribute',
      displayName: 'Uri',
      required: true,
      type: 'string',
      javaType: 'java.lang.String',
      deprecated: false,
      autowired: false,
      secret: false,
      description: 'Sets the uri of the endpoint to send to.',
    },
    disabled: {
      index: 1,
      kind: 'attribute',
      displayName: 'Disabled',
      label: 'advanced',
      required: false,
      type: 'boolean',
      javaType: 'java.lang.Boolean',
      deprecated: false,
      autowired: false,
      secret: false,
      defaultValue: false,
      description:
        'Whether to disable this EIP from the route during build time. Once an EIP has been disabled then it cannot be enabled later at runtime.',
    },
    pattern: {
      index: 2,
      kind: 'attribute',
      displayName: 'Pattern',
      label: 'advanced',
      required: false,
      type: 'enum',
      javaType: 'org.apache.camel.ExchangePattern',
      enum: ['InOnly', 'InOut'],
      deprecated: false,
      autowired: false,
      secret: false,
      description: 'Sets the optional ExchangePattern used to invoke this endpoint',
    },
    id: {
      index: 3,
      kind: 'attribute',
      displayName: 'Id',
      required: false,
      type: 'string',
      javaType: 'java.lang.String',
      deprecated: false,
      autowired: false,
      secret: false,
      description: 'Sets the id of this node',
    },
    description: {
      index: 4,
      kind: 'element',
      displayName: 'Description',
      required: false,
      type: 'string',
      javaType: 'java.lang.String',
      deprecated: false,
      autowired: false,
      secret: false,
      description: 'Sets the description of this node',
    },
  },
};