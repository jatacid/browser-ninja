const createSavedSnippetsModule = (container, config = {}) => {
  const state = {
    savedSnippets: []
  };

  const ICONS = {
    trash: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 7.5V14.5C6.5 15.0523 6.94772 15.5 7.5 15.5H12.5C13.0523 15.5 13.5 15.0523 13.5 14.5V7.5" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4.5 5.5H15.5" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8.5 9.5V13.5" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M11.5 9.5V13.5" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M9 5.5V4.5C9 3.94772 9.44772 3.5 10 3.5C10.5523 3.5 11 3.94772 11 4.5V5.5" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    play: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#FFFFFF">
      <path d="M8 5v14l11-7z"/>
    </svg>`,
    playGreen: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#16a34a">
      <path d="M8 5v14l11-7z"/>
    </svg>`,
    pause: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b">
      <rect x="6" y="4" width="4" height="16"/>
      <rect x="14" y="4" width="4" height="16"/>
    </svg>`,
    copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>`,
    close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" stroke-width="2">
      <path d="M6 6L18 18M18 6L6 18"/>
    </svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2">
      <polyline points="20,6 9,17 4,12"/>
    </svg>`,
    edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>`
  };



  const saveSavedSnippets = (snippets) => {
    appState.globalSavedSnippets = snippets;
    saveAppState();
  };


  const normalizeSnippet = (snippet) => {
    if (snippet.timestamp && !snippet.domain) {
      snippet.domain = "unknown";
      snippet.isPaused = true;
      delete snippet.timestamp;
    }
    if (snippet.isPaused === undefined) {
      snippet.isPaused = true;
    }
    return snippet;
  };

  const removeSnippet = (snippetId) => {
    state.savedSnippets = state.savedSnippets.filter(
      (snippet) => snippet.id !== snippetId
    );
    saveSavedSnippets(state.savedSnippets);
    renderSavedSnippets();
  };

  const clearAllSnippets = () => {
    state.savedSnippets = [];
    saveSavedSnippets(state.savedSnippets);
    renderSavedSnippets();
  };

  const toggleSnippetPause = (snippetId) => {
    const snippet = state.savedSnippets.find((s) => s.id === snippetId);
    if (snippet) {
      snippet.isPaused = !snippet.isPaused;
      saveSavedSnippets(state.savedSnippets);
      renderSavedSnippets();
    }
  };



  const copyToClipboard = (code, button) => {
    navigator.clipboard.writeText(code)
      .then(() => showButtonFeedback(button, ICONS.check))
  };
  
  const showButtonFeedback = (button, icon) => {
    const originalIcon = button.innerHTML;
    button.innerHTML = icon;
    setTimeout(() => {
      button.innerHTML = originalIcon;
    }, 1000);
  };

 
  const createSnippetHTML = (snippet) => {
    const playPauseIcon = snippet.isPaused ? ICONS.playGreen : ICONS.pause;
    const playPauseTitle = snippet.isPaused ? "Enable auto-run when your page refreshes" : "Pause auto-run";

    // Format timestamp if present
    let timestampHTML = '';
    if (snippet.timestamp) {
      let dateObj;
      try {
        dateObj = new Date(snippet.timestamp);
      } catch (e) {
        dateObj = null;
      }
      if (dateObj && !isNaN(dateObj.getTime())) {
        const dateStr = dateObj.toLocaleDateString();
        const timeStr = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        timestampHTML = `<div class="bn-saved-snippet-timestamp" style="font-size:11px;color:#888;margin-top:2px;">${dateStr} ${timeStr}</div>`;
      } else {
        timestampHTML = `<div class="bn-saved-snippet-timestamp" style="font-size:11px;color:#888;margin-top:2px;">${snippet.timestamp}</div>`;
      }
    }

    // Use title as main heading, domain and timestamp as small text
    const title = snippet.title || snippet.domain || '';
    const domainHTML = snippet.domain ? `<span class="bn-saved-snippet-domain" style="font-size:11px;color:#888;">${snippet.domain} ${ICONS.edit}</span>` : '';
    return `
      <div class="bn-saved-snippet" data-snippet-id="${snippet.id}">
        <div class="bn-saved-snippet-header">
          <div class="bn-snippet-title" style="font-weight:600;font-size:15px;line-height:1.2;cursor:pointer;" title="Title: Click to edit" tabindex="0" data-snippet-id="${snippet.id}">${title} ${ICONS.edit}</div>
          <div style="display:flex;gap:8px;align-items:center;margin-top:2px;">
            ${domainHTML}
            ${timestampHTML}
          </div>
        </div>
        <div class="bn-code-block">
          <textarea class="bn-code-textarea" readonly>${snippet.code}</textarea>
          <div class="bn-chat-code-actions">
            <button class="bn-chat-btn bn-chat-play-btn-auto bn-snippet-run-btn" data-snippet-id="${snippet.id}" title="Run this code" style="cursor:pointer;">${ICONS.play} Run Code</button>
            <button class="bn-chat-btn bn-snippet-toggle-btn" data-snippet-id="${snippet.id}" title="${playPauseTitle}" style="cursor:pointer;">
              ${playPauseIcon}
            </button>
            <button class="bn-chat-btn bn-snippet-copy-btn" data-snippet-id="${snippet.id}" title="Copy to clipboard" style="cursor:pointer;">
              ${ICONS.copy}
            </button>
            <button class="bn-chat-btn bn-snippet-delete-btn" data-snippet-id="${snippet.id}" title="Remove from saved snippets" style="cursor:pointer;">
              ${ICONS.close}
            </button>
          </div>
        </div>
      </div>`;
  };


  const attachSnippetEventListeners = (snippetContainer) => {
    const runButtons = snippetContainer.querySelectorAll(".bn-snippet-run-btn");
    const toggleButtons = snippetContainer.querySelectorAll(".bn-snippet-toggle-btn");
    const deleteButtons = snippetContainer.querySelectorAll(".bn-snippet-delete-btn");
    const copyButtons = snippetContainer.querySelectorAll(".bn-snippet-copy-btn");
    const titleDivs = snippetContainer.querySelectorAll(".bn-snippet-title");

    runButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const snippetId = button.getAttribute("data-snippet-id");
        const snippet = state.savedSnippets.find((s) => s.id === snippetId);
        if (snippet) {
          executeCodeSnippet(snippet.code, snippet.id, snippet.domain);
          showButtonFeedback(button, ICONS.check);
        }
      });
    });

    toggleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const snippetId = button.getAttribute("data-snippet-id");
        toggleSnippetPause(snippetId);
      });
    });

    deleteButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const snippetId = button.getAttribute("data-snippet-id");
        removeSnippet(snippetId);
      });
    });

    copyButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const snippetId = button.getAttribute("data-snippet-id");
        const snippet = state.savedSnippets.find((s) => s.id === snippetId);
        if (snippet) {
          copyToClipboard(snippet.code, button);
        }
      });
    });

    // Editable title logic
    titleDivs.forEach((div) => {
      div.addEventListener("click", (e) => {
        const snippetId = div.getAttribute("data-snippet-id");
        const snippet = state.savedSnippets.find((s) => s.id === snippetId);
        if (!snippet) return;
        if (div.querySelector('input')) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = snippet.title || snippet.domain || '';
        input.style.fontWeight = '600';
        input.style.fontSize = '15px';
        input.style.lineHeight = '1.2';
        input.style.width = '90%';
        input.style.margin = '0';
        input.style.padding = '0 2px';
        input.style.border = '1px solid #bbb';
        input.style.borderRadius = '3px';
        input.style.background = '#fff';
        input.setAttribute('aria-label', 'Edit snippet title');
        div.innerHTML = '';
        div.appendChild(input);
        input.focus();
        input.select();

        function saveTitle() {
          const newTitle = input.value.trim() || snippet.domain || '';
          if (newTitle !== snippet.title) {
            snippet.title = newTitle;
            saveSavedSnippets(state.savedSnippets);
          }
          div.innerHTML = `${newTitle} ${ICONS.edit}`;
        }

        input.addEventListener('blur', saveTitle);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            input.blur();
          } else if (ev.key === 'Escape') {
            div.innerHTML = `${snippet.title || snippet.domain || ''} ${ICONS.edit}`;
          }
        });
      });
    });

    // Editable domain logic
    const domainSpans = snippetContainer.querySelectorAll('.bn-saved-snippet-domain');
    domainSpans.forEach((span) => {
      span.style.cursor = 'pointer';
      span.title = 'Domain: Click to edit';
      span.tabIndex = 0;
      span.addEventListener('click', (e) => {
        const parentSnippet = span.closest('.bn-saved-snippet');
        if (!parentSnippet) return;
        const snippetId = parentSnippet.getAttribute('data-snippet-id');
        const snippet = state.savedSnippets.find((s) => s.id === snippetId);
        if (!snippet) return;
        if (span.querySelector('input')) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = snippet.domain || '';
        input.style.fontSize = '11px';
        input.style.color = '#888';
        input.style.width = '90%';
        input.style.margin = '0';
        input.style.padding = '0 2px';
        input.style.border = '1px solid #bbb';
        input.style.borderRadius = '3px';
        input.style.background = '#fff';
        input.setAttribute('aria-label', 'Edit snippet domain');
        span.innerHTML = '';
        span.appendChild(input);
        input.focus();
        input.select();

        function saveDomain() {
          const newDomain = input.value.trim() || '';
          if (newDomain !== snippet.domain) {
            snippet.domain = newDomain;
            saveSavedSnippets(state.savedSnippets);
          }
          span.innerHTML = `${newDomain} ${ICONS.edit}`;
        }

        input.addEventListener('blur', saveDomain);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            input.blur();
          } else if (ev.key === 'Escape') {
            span.innerHTML = `${snippet.domain || ''} ${ICONS.edit}`;
          }
        });
      });
    });

    const clearSavedSnippetsBtn = container.querySelector(".bn-clear-saved-snippets-btn");
    if (clearSavedSnippetsBtn) {
      clearSavedSnippetsBtn.addEventListener("click", clearAllSnippets);
    }
  };

  const renderSavedSnippets = () => {
    const snippetContainer = container.querySelector(".bn-saved-snippets");
    if (!snippetContainer) return;

    if (state.savedSnippets.length === 0) {
      snippetContainer.innerHTML = '<div class="bn-captured-empty" style="padding:16px;">No saved snippets yet. Use the save button next to code snippets to save them here.</div>';
      return;
    }

    snippetContainer.innerHTML = state.savedSnippets.map(createSnippetHTML).join("");
    attachSnippetEventListeners(snippetContainer);
  };

  const refreshSnippets = () => {
    if (appState && Array.isArray(appState.globalSavedSnippets)) {
      state.savedSnippets = appState.globalSavedSnippets.map(normalizeSnippet);
    } else {
      state.savedSnippets = [];
    }
    renderSavedSnippets();
  };


  const executeCodeSnippet = (code, snippetId = null, snippetDomain = null) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || !tabs[0].id || tabs[0].url.startsWith("chrome://") || tabs[0].url.startsWith("chrome-extension://") || tabs[0].discarded) {
        return;
      }

      let proceed = true;
      if (snippetDomain && snippetDomain !== "unknown") {
        try {
          const urlObj = new URL(tabs[0].url);
          const tabHost = urlObj.hostname;
          if (!tabHost.endsWith(snippetDomain)) {
            proceed = window.confirm("The URL you're trying to execute on is different. Do you want to Run the code anyway?");
          }
        } catch (e) {
          proceed = window.confirm("Unable to verify the current URL. Do you want to Run the code anyway?");
        }
      }
      if (!proceed) return;

      try {
        chrome.runtime.sendMessage(
          {
            type: "executeSnippet",
            value: code,
            tabId: tabs[0].id,
          },
          (response) => {
            // if (chrome.runtime.lastError) {
            //   console.log("Code execution failed:", chrome.runtime.lastError.message);
            //   return;
            // }
            // if (response && !response.success) {
            //   console.log("Code execution failed:", response.result);
            // }
          }
        );
      } catch (error) {
        // console.log("Code execution failed:", error.message);
      }
    });
  };


  const render = () => {
    const hexColour = config.hexColour || "#c9c9ee";
    const title = config.title || "Saved & Loaded Snippets";
    const subtitle = config.subtitle || "Saved snippets will appear here and if enabled, will execute automatically when you refresh your tab.";

    container.innerHTML = `
      <div class="module-container" style="background:${hexColour}">
        <h2>${title}</h2>
        <div class="bn-section-subtitle">${subtitle}</div>
        <div class="bn-flex-row align-center bn-margin-bottom-2 bn-gap-8">
          <button class="bn-clear-saved-snippets-btn bn-clear-btn" title="Clear all saved snippets">${ICONS.trash}</button>
        </div>
        <div class="bn-saved-snippets bn-list-block" style="resize: vertical; overflow: auto; min-height: 80px;"></div>
      </div>
    `;
    refreshSnippets();

  };



  const instance = {
    render,
    removeSnippet,
    clearAllSnippets,
    executeCodeSnippet,
    refreshSnippets
  };
  return instance;
};
