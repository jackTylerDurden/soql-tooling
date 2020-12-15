/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { api, createElement } from 'lwc';
import App from 'querybuilder/app';
import {
  ToolingModelJson,
  ToolingModelService
} from '../services/toolingModelService';
import { ToolingSDK } from '../services/toolingSDK';
import {
  MessageType,
  SoqlEditorEvent
} from '../services/message/soqlEditorEvent';
import { BehaviorSubject, Observable } from 'rxjs';
import { MessageServiceFactory } from '../services/message/messageServiceFactory';
import { IMessageService } from '../services/message/iMessageService';
import { StandaloneMessageService } from '../services/message/standaloneMessageService';
import * as globals from '../services/globals';

class TestMessageService implements IMessageService {
  messagesToUI: Observable<SoqlEditorEvent> = new BehaviorSubject(
    ({} as unknown) as SoqlEditorEvent
  );
  sendMessage() {}
  setState() {}
  getState() {}
}

class TestApp extends App {
  @api
  fields;
  @api
  isFromLoading = false;
  @api
  isFieldsLoading = false;
  @api
  hasUnrecoverableError = false;
  @api
  query: ToolingModelJson = ToolingModelService.toolingModelTemplate;
}

describe('App should', () => {
  let app;
  let messageService;
  let loadSObjectDefinitionsSpy;
  let loadSObjectMetadataSpy;
  let accountQuery = 'SELECT Id FROM Account';
  let soqlEditorEvent = {
    type: MessageType.TEXT_SOQL_CHANGED,
    payload: accountQuery
  };
  let originalCreateFn;
  function createSoqlEditorEvent(queryOverride = accountQuery, eventOverride?) {
    const query = queryOverride;
    const event = { ...soqlEditorEvent, ...eventOverride };
    event.payload = query;
    return event;
  }
  beforeEach(() => {
    messageService = (new TestMessageService() as unknown) as StandaloneMessageService;
    originalCreateFn = MessageServiceFactory.create;
    MessageServiceFactory.create = () => {
      return messageService;
    };
    loadSObjectDefinitionsSpy = jest.spyOn(
      ToolingSDK.prototype,
      'loadSObjectDefinitions'
    );
    loadSObjectMetadataSpy = jest.spyOn(
      ToolingSDK.prototype,
      'loadSObjectMetatada'
    );
    jest.spyOn(globals, 'getBodyClass').mockReturnValue('vscode-dark');
    app = createElement('querybuilder-app', {
      is: TestApp
    });
    document.body.appendChild(app);
  });

  afterEach(() => {
    MessageServiceFactory.create = originalCreateFn;
    jest.clearAllMocks();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  describe('GENERAL', () => {
    it('display the app', () => {
      const from = app.shadowRoot.querySelectorAll('querybuilder-from');
      expect(from.length).toEqual(1);

      const fields = app.shadowRoot.querySelectorAll('querybuilder-fields');
      expect(fields.length).toEqual(1);

      const preview = app.shadowRoot.querySelectorAll(
        'querybuilder-query-preview'
      );
      expect(preview.length).toEqual(1);

      const where = app.shadowRoot.querySelectorAll('querybuilder-where');
      expect(where.length).toEqual(1);

      const orderBy = app.shadowRoot.querySelectorAll('querybuilder-order-by');
      expect(orderBy.length).toEqual(1);

      const limit = app.shadowRoot.querySelectorAll('querybuilder-limit');
      expect(limit.length).toEqual(1);
    });

    it('set the body class on the sub components', () => {
      const darkElements = app.shadowRoot.querySelectorAll('.dark');
      expect(darkElements.length).toBeGreaterThan(1);
    });

    it('should clear fields when sobject is same but fields are empty', async () => {
      expect(loadSObjectMetadataSpy).not.toHaveBeenCalled();
      app.fields = [];
      messageService.messagesToUI.next(
        createSoqlEditorEvent('SELECT Id, Name FROM Account')
      );
      expect(loadSObjectMetadataSpy.mock.calls.length).toEqual(1);
      expect(app.fields.length).toEqual(0);
    });

    it('should send a runquery message to vs code with runquery event', async () => {
      const header = app.shadowRoot.querySelector('querybuilder-header');
      const postMessageSpy = jest.spyOn(messageService, 'sendMessage');
      header.dispatchEvent(new Event('runquery'));

      return Promise.resolve().then(() => {
        expect(postMessageSpy).toHaveBeenCalled();
        expect(postMessageSpy).toHaveBeenCalledWith({
          type: MessageType.RUN_SOQL_QUERY
        });
      });
    });
  });

  describe('HANDLE METADATA', () => {
    it('load sobjects immediately but not fields', () => {
      expect(app.isFromLoading).toEqual(true);
      expect(app.isFieldsLoading).toEqual(false);
    });

    it('should load sobject definitions at creation', () => {
      expect(loadSObjectDefinitionsSpy).toHaveBeenCalled();
    });

    it('should load sobject metadata with valid query and stop loading when returned', async () => {
      expect(app.isFieldsLoading).toEqual(false);
      expect(loadSObjectMetadataSpy).not.toHaveBeenCalled();
      messageService.messagesToUI.next(createSoqlEditorEvent());
      expect(loadSObjectMetadataSpy).toHaveBeenCalled();
      expect(app.isFieldsLoading).toEqual(true);
      messageService.messagesToUI.next({
        type: MessageType.SOBJECT_METADATA_RESPONSE,
        payload: { fields: [] }
      });
      expect(app.isFieldsLoading).toEqual(false);
    });

    it('should request sobject metadata when sobject is changed', async () => {
      expect(loadSObjectMetadataSpy).not.toHaveBeenCalled();
      messageService.messagesToUI.next(createSoqlEditorEvent());
      expect(loadSObjectMetadataSpy.mock.calls.length).toEqual(1);
      messageService.messagesToUI.next(
        createSoqlEditorEvent('SELECT Id FROM Contact')
      );
      expect(loadSObjectMetadataSpy.mock.calls.length).toEqual(2);
      expect(loadSObjectMetadataSpy.mock.calls[1][0]).toEqual('Contact');
    });

    it('should stop the loading flag when sobjects return', async () => {
      expect(app.isFromLoading).toEqual(true);
      messageService.messagesToUI.next({
        type: MessageType.SOBJECTS_RESPONSE,
        payload: ['Hey', 'Joe']
      });
      expect(app.isFromLoading).toEqual(false);
    });
  });

  describe('HANDLE ERRORS', () => {
    it('block the query builder ui on unrecoverable error', async () => {
      let blockingElement = app.shadowRoot.querySelectorAll(
        '.unsupported-syntax'
      );
      expect(blockingElement.length).toBeFalsy();
      app.hasUnrecoverableError = true;
      return Promise.resolve().then(() => {
        blockingElement = app.shadowRoot.querySelectorAll(
          '.unsupported-syntax'
        );
        expect(blockingElement.length).toBeTruthy();
      });
    });

    it('not block the query builder ui on recoverable error', async () => {
      document.body.appendChild(app);
      let blockingElement = app.shadowRoot.querySelectorAll(
        '.unsupported-syntax'
      );
      expect(blockingElement.length).toBeFalsy();
      messageService.messagesToUI.next(
        createSoqlEditorEvent('SELECT FROM Account')
      );
      return Promise.resolve().then(() => {
        blockingElement = app.shadowRoot.querySelectorAll(
          '.unsupported-syntax'
        );
        expect(blockingElement.length).toBeFalsy();
      });
    });

    it('block the query builder on unsupported syntax', async () => {
      let blockingElement = app.shadowRoot.querySelectorAll(
        '.unsupported-syntax'
      );
      expect(blockingElement.length).toBeFalsy();
      messageService.messagesToUI.next(
        createSoqlEditorEvent('SELECT Id FROM Account WHERE')
      );
      return Promise.resolve().then(() => {
        blockingElement = app.shadowRoot.querySelectorAll(
          '.unsupported-syntax'
        );
        expect(blockingElement.length).toBeTruthy();
      });
    });

    it('not process an incoming message if the soql statement has not changed', async () => {
      console.log('starting test');
      const soqlStatement = 'SELECT Id, Name FROM Account';
      return Promise.resolve().then(() => {
        messageService.messagesToUI.next(createSoqlEditorEvent(soqlStatement));
        expect(app.query.originalSoqlStatement).toEqual(soqlStatement);
        messageService.messagesToUI.next(createSoqlEditorEvent(soqlStatement));
        expect(app.query.originalSoqlStatement).toEqual(soqlStatement);
      });
    });
  });

  describe('WHERE', () => {
    it('should send message to vs code with SELECTION event', () => {
      const where = app.shadowRoot.querySelector('querybuilder-where');
      const postMessageSpy = jest.spyOn(messageService, 'sendMessage');
      const eventPayload = {
        detail: {
          fieldCompareExpr: {
            field: 'test',
            operator: 'EQ',
            criteria: { value: "'pass'" },
            index: 0
          },
          andOr: 'AND'
        }
      };

      where.dispatchEvent(
        new CustomEvent('modifierselectionwithandor', eventPayload)
      );
      expect(postMessageSpy).toHaveBeenCalled();
      expect((postMessageSpy.mock.calls[0][0] as SoqlEditorEvent).type).toEqual(
        MessageType.UI_SOQL_CHANGED
      );
      expect(
        (postMessageSpy.mock.calls[0][0] as SoqlEditorEvent).payload
      ).toContain(eventPayload.detail.fieldCompareExpr.field);
    });

    it('should send message to vs code with REMOVE CONDITION event', () => {
      const where = app.shadowRoot.querySelector('querybuilder-where');
      const postMessageSpy = jest.spyOn(messageService, 'sendMessage');
      const eventPayload = {
        detail: {
          fieldCompareExpr: {
            field: 'test',
            index: 0
          }
        }
      };

      where.dispatchEvent(
        new CustomEvent('where__conditionremoved', eventPayload)
      );
      expect(postMessageSpy).toHaveBeenCalled();
      expect((postMessageSpy.mock.calls[0][0] as SoqlEditorEvent).type).toEqual(
        MessageType.UI_SOQL_CHANGED
      );
      expect(
        (postMessageSpy.mock.calls[0][0] as SoqlEditorEvent).payload
      ).not.toContain(eventPayload.detail.fieldCompareExpr.field);
    });

    it('should send message to vs code with AND OR selection event', () => {
      const where = app.shadowRoot.querySelector('querybuilder-where');
      const postMessageSpy = jest.spyOn(messageService, 'sendMessage');
      const eventPayload = {
        detail: {
          andOr: 'AND'
        }
      };

      where.dispatchEvent(new CustomEvent('andorselection', eventPayload));
      expect(postMessageSpy).toHaveBeenCalled();
      expect((postMessageSpy.mock.calls[0][0] as SoqlEditorEvent).type).toEqual(
        MessageType.UI_SOQL_CHANGED
      );
    });
  });

  describe('ORDER BY', () => {
    it('send orderby message to vs code when orderby added', () => {
      const orderBy = app.shadowRoot.querySelector('querybuilder-order-by');
      const postMessageSpy = jest.spyOn(messageService, 'sendMessage');
      const eventPayload = {
        detail: {
          field: 'People are Strange'
        }
      };
      orderBy.dispatchEvent(new CustomEvent('orderbyselected', eventPayload));
      expect(postMessageSpy).toHaveBeenCalled();
      expect((postMessageSpy.mock.calls[0][0] as SoqlEditorEvent).type).toEqual(
        MessageType.UI_SOQL_CHANGED
      );
      expect(
        (postMessageSpy.mock.calls[0][0] as SoqlEditorEvent).payload
      ).toContain(eventPayload.detail.field);
    });

    it('send orderby message to vs code when orderby removed', () => {
      const orderBy = app.shadowRoot.querySelector('querybuilder-order-by');
      const postMessageSpy = jest.spyOn(messageService, 'sendMessage');
      const eventPayload = {
        detail: {
          field: 'People are Strange'
        }
      };
      orderBy.dispatchEvent(new CustomEvent('orderbyremoved', eventPayload));
      expect(postMessageSpy).toHaveBeenCalled();
      expect((postMessageSpy.mock.calls[0][0] as SoqlEditorEvent).type).toEqual(
        MessageType.UI_SOQL_CHANGED
      );
      expect(
        (postMessageSpy.mock.calls[0][0] as SoqlEditorEvent).payload
      ).not.toContain(eventPayload.detail.field);
    });
  });

  describe('LIMIT', () => {
    it('send limit in message to vs code when limit changed', () => {
      const limit = app.shadowRoot.querySelector('querybuilder-limit');
      const postMessageSpy = jest.spyOn(messageService, 'sendMessage');
      const eventPayload = {
        detail: {
          limit: '11'
        }
      };
      limit.dispatchEvent(new CustomEvent('limitchanged', eventPayload));
      expect(postMessageSpy).toHaveBeenCalled();
      expect((postMessageSpy.mock.calls[0][0] as SoqlEditorEvent).type).toEqual(
        MessageType.UI_SOQL_CHANGED
      );
      expect(
        (postMessageSpy.mock.calls[0][0] as SoqlEditorEvent).payload
      ).toContain(eventPayload.detail.limit);
    });
  });
});
