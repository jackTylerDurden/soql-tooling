/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { api, LightningElement, track } from 'lwc';
import { JsonMap } from '@salesforce/ts-types';

interface ConditionTemplate {
  field: undefined;
  operator: undefined;
  criteria: { type: null; value: null };
  index: number;
}

export default class Where extends LightningElement {
  @api
  isLoading = false;
  @api
  whereFields: string[];
  _andOr;
  conditionTemplate: ConditionTemplate = {
    field: undefined,
    operator: undefined,
    criteria: { type: null, value: null },
    index: this.templateIndex
  };
  @track
  _conditionsStore: JsonMap[] = [];

  @api
  get whereExpr(): JsonMap {
    return { conditions: this._conditionsStore, andOr: this._andOr };
  }

  set whereExpr(where: JsonMap) {
    if (where.conditions && where.conditions.length) {
      this._conditionsStore = where.conditions;
    } else {
      this._conditionsStore = [this.conditionTemplate];
    }
    this._andOr = where.andOr;
  }

  get templateIndex(): number {
    if (this._conditionsStore) {
      const numberOfConditions = this._conditionsStore.length;
      return numberOfConditions;
    }
    return 0;
  }

  renderedCallback() {
    const andButton = this.template.querySelector("[name='and']");
    const orButton = this.template.querySelector("[name='or']");

    if (this._andOr === 'AND') {
      andButton.classList.add('header__btn--selected');
      orButton.classList.remove('header__btn--selected');
    }

    if (this._andOr === 'OR') {
      orButton.classList.add('header__btn--selected');
      andButton.classList.remove('header__btn--selected');
    }
  }

  handleModGroupSelection(e) {
    const whereSelectionEvent = new CustomEvent('whereselection', {
      detail: e.detail
    });
    this.dispatchEvent(whereSelectionEvent);
  }

  handleAddModGroup(e) {
    e.preventDefault();
    const newTemplate = {
      ...this.conditionTemplate,
      index: this.templateIndex
    };
    this._conditionsStore = [...this._conditionsStore, newTemplate];
  }

  handleSetAndOr(e) {
    e.preventDefault();
    const selectedValue = e.target.value;
    const isValidValue = selectedValue === 'AND' || selectedValue === 'OR';

    if (isValidValue && selectedValue !== this._andOr) {
      const andOrSelectionEvent = new CustomEvent('andorselection', {
        detail: selectedValue
      });
      this.dispatchEvent(andOrSelectionEvent);
    }
  }
}
