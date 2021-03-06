/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

(function () {
  /* interface queryData {
      done: boolean;
      nextRecordsUrl?: string;
      totalSize: number;
      records: T[];
    } */
  const FileType = {
    JSON: 'json',
    CSV: 'csv',
  };
  const vscode = acquireVsCodeApi();

  // load previous state if webview was moved from background.
  function loadState() {
    const state = vscode.getState();
    if (state) {
      updateUIWith(state.data, state.documentName);
    }
  }

  loadState();

  // ---- RENDER THE WEBVIEW CONTENT ---- //

  function updateUIWith(queryData, documentName) {
    // Display the .soql file name as the title
    const titleEl = document.getElementById('webview-title');
    titleEl.innerText = documentName;
    // Display the total number of records returned from the query
    const totalRecordsSizeEl = document.getElementById('total-records-size');
    totalRecordsSizeEl.innerText = `Returned ${queryData.records.length} of ${queryData.totalSize} total records`; // TODO: i18n

    renderTableWith(queryData);
  }

  function renderTableWith(tableData) {
    new Tabulator('#data-table', {
      data: tableData.records,
      autoColumns: true,
      pagination: 'local',
      layout: 'fitColumns',
      height: '60vh',
    });
  }

  // ---- EVENT LISTENERS ---- //

  const saveCsvButtonEl = document.getElementById('save-csv-button');
  saveCsvButtonEl.addEventListener('click', () => {
    vscode.postMessage({
      type: 'save_records',
      format: FileType.CSV,
    });
  });

  const saveJsonButtonEl = document.getElementById('save-json-button');
  saveJsonButtonEl.addEventListener('click', () => {
    vscode.postMessage({
      type: 'save_records',
      format: FileType.JSON,
    });
  });
  // incoming messages from VS Code
  window.addEventListener('message', (event) => {
    const { type, data, documentName } = event.data;
    switch (type) {
      case 'update':
        updateUIWith(data, documentName);
        vscode.setState({
          data,
          documentName,
        });
        return;
      default:
        console.log('oops! No message type');
    }
  });
  // Ensure the UI is loaded before receiving 'update' from extension
  vscode.postMessage({
    type: 'activate',
  });
})();
