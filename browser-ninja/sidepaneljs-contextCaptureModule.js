const createContextCaptureModule = (container, config = {}) => {
  const moduleId = config.moduleId || "context-capture";


  appState.moduleData[moduleId] = appState.moduleData[moduleId] || {};
  appState.moduleData[moduleId].events = appState.moduleData[moduleId].events || [];
  let isLocked = false;
  let lockedInfo = null;
  let previewEvent = null;
  saveAppState();


  const isDuplicateEvent = (event, timestamp) =>
    appState.moduleData[moduleId].events.some(
      (existing) =>
        existing.xpath === event.xpath &&
        existing.timestamp &&
        timestamp &&
        Math.abs(existing.timestamp - timestamp) < 500
    );

  const isSelectorEnabled = (event, levelIdx, selectorIdx) => {
    if (!event.selectorChain || !Array.isArray(event.selectorChain) || 
        !event.selectorChain[levelIdx] || !Array.isArray(event.selectorChain[levelIdx])) {
      return false;
    }
    if (!event.enabledSelectors || !Array.isArray(event.enabledSelectors)) {
      return false;
    }
    return event.enabledSelectors[levelIdx] && event.enabledSelectors[levelIdx][selectorIdx];
  };

  const buildActiveSelectorPath = (event) => {
    if (!event.selectorChain || !Array.isArray(event.selectorChain)) {
      return '';
    }
    
    const activePath = [];
    event.selectorChain.forEach((levelSelectors, levelIdx) => {
      if (Array.isArray(levelSelectors) && levelSelectors.length > 0) {
        const activeSelectors = levelSelectors.filter((selector, selectorIdx) => 
          isSelectorEnabled(event, levelIdx, selectorIdx)
        );
        
        if (activeSelectors.length > 0) {
          activePath.push(activeSelectors.join(''));
        }
      }
    });
    
    // Update thisElementsSelector to match the current enabled state
    event.thisElementsSelector = activePath.join(' ');
    return activePath.join(' ');
  };

  const getSelectorDisplay = (eventOrInfo) => {
    // Build the selector display from the current enabled state
    const activePath = buildActiveSelectorPath(eventOrInfo);
    if (activePath && activePath.trim() !== '') {
      return activePath;
    }
    
    if (eventOrInfo.selectorChain && Array.isArray(eventOrInfo.selectorChain) && eventOrInfo.selectorChain.length > 0) {
      const targetSelector = eventOrInfo.selectorChain[eventOrInfo.selectorChain.length - 1]?.join('') || '';
      if (targetSelector && !targetSelector.includes('#') && !targetSelector.includes('.') && !targetSelector.includes('[')) {
        for (let i = eventOrInfo.selectorChain.length - 1; i >= Math.max(0, eventOrInfo.selectorChain.length - 3); i--) {
          const selector = eventOrInfo.selectorChain[i]?.join('') || '';
          if (selector.includes('#') || selector.includes('.') || selector.includes('[')) {
            return selector;
          }
        }
      }
      return targetSelector;
    }
    
    return eventOrInfo.tagName || "element";
  };

  const toggleSelector = (eventIdx, levelIdx, selectorIdx) => {
    if (eventIdx < 0 || eventIdx >= appState.moduleData[moduleId].events.length) return;
    const event = appState.moduleData[moduleId].events[eventIdx];
    if (!event.selectorChain || !event.selectorChain[levelIdx] || !event.selectorChain[levelIdx][selectorIdx]) return;
    
    // Initialize enabledSelectors if it doesn't exist
    if (!event.enabledSelectors || !Array.isArray(event.enabledSelectors)) {
      event.enabledSelectors = event.selectorChain.map(levelSelectors => 
        levelSelectors.map(() => false)
      );
    }
    
    // Ensure the specific level array exists
    if (!event.enabledSelectors[levelIdx]) {
      event.enabledSelectors[levelIdx] = event.selectorChain[levelIdx].map(() => false);
    }
    
    // Toggle the selector
    event.enabledSelectors[levelIdx][selectorIdx] = !event.enabledSelectors[levelIdx][selectorIdx];
    
    // Update thisElementsSelector based on the new enabled state
    buildActiveSelectorPath(event);
    
    updateSelectorButtonUI(eventIdx, levelIdx, selectorIdx);
    updateEventTextUI(eventIdx);
    updateOpenInfoPanels();
    saveAppState();
  };

  // =================================================================================================
  // 3. UI CREATION
  // =================================================================================================
  function escapeHTML(str) {
    return str.replace(/[&<>"]|'/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c));
  }

  const createSelectorChainHTML = (event, idx) => {
    if (!event.selectorChain || !Array.isArray(event.selectorChain)) {
      return '<div class="bn-selector-editor">No selector chain available</div>';
    }

    // Determine if all selectors are enabled
    let allEnabled = true;
    let anyEnabled = false;
    if (event.selectorChain && Array.isArray(event.selectorChain)) {
      event.selectorChain.forEach((levelSelectors, levelIdx) => {
        if (Array.isArray(levelSelectors)) {
          levelSelectors.forEach((selector, selectorIdx) => {
            if (isSelectorEnabled(event, levelIdx, selectorIdx)) {
              anyEnabled = true;
            } else {
              allEnabled = false;
            }
          });
        }
      });
    }
    const toggleLabel = allEnabled ? 'Select None' : 'Select All';
    let html = '<div class="bn-selector-editor" style="overflow: auto">';
    // Add Select None/All toggle button
    html += `<div style="margin: 4px 8px 8px 8px; text-align: left;">
      <button class="bn-select-toggle-btn" data-event-idx="${idx}" data-toggle="${allEnabled ? 'none' : 'all'}" style="font-size: 12px; color: #d32f2f; background: none; border: none; cursor: pointer; text-decoration: underline;">${toggleLabel}</button>
    </div>`;

    event.selectorChain.forEach((levelSelectors, levelIdx) => {
      if (Array.isArray(levelSelectors) && levelSelectors.length > 0) {
        html += '<div class="attributeRow" style="display: flex; margin: 4px 8px; flex-wrap: nowrap; gap: 4px;">';
        levelSelectors.forEach((selector, selectorIdx) => {
          const isActive = isSelectorEnabled(event, levelIdx, selectorIdx);
          const activeClass = isActive ? 'active' : 'disabled';
          html += `<div class="ahButtonWrapper">
            <button class="attributeButton ${activeClass}" 
                    data-level="${levelIdx}" 
                    data-selector="${selectorIdx}" 
                    data-event-idx="${idx}"
                    title="Click to toggle selector" 
                    style="background: ${isActive ? '#fff' : '#f0f0f0'}; color: ${isActive ? '#000' : '#999'};">
              ${escapeHTML(selector)}
            </button>
          </div>`;
        });
        html += '</div>';
      }
    });
    html += '</div>';
    return html;
  };

  const createEventHTML = (event, isPreview = false) => {
    const previewSuffix = isPreview ? (isLocked ? " (selected)" : "") : "";
    return `<div class="bn-capture-entry-content">
           <div class="bn-capture-selector">${event.tagName || "element"}${previewSuffix}</div>
           <div class="bn-capture-details">
             <div class="bn-capture-text">${getSelectorDisplay(event)}${event.innerText ? ` — ${event.innerText}` : ''}</div>
           </div>
         </div>`;
  };

  const createEventElement = (event, idx, isPreview = false) => {
    const elem = document.createElement("div");
    elem.className = `bn-context-entry${isPreview ? (isLocked ? ' locked-selection' : ' hovering') : ''}`;
    elem.setAttribute("data-idx", idx);
    if (isPreview) elem.setAttribute("data-preview", "true");

    elem.innerHTML = 
      `<div class="bn-context-entry-row">` +
      createEventHTML(event, isPreview) +
      (isPreview ? '' : 
        `<button class="bn-info-expand-btn" title="Show Details" data-idx="${idx}" tabindex="0" aria-label="Show details">&#9432;</button>` +
        `<button class="bn-edit-expand-btn" title="Edit Selectors" data-idx="${idx}" tabindex="0" aria-label="Edit selectors">&#9998;</button>` +
        `<button class="bn-remove-btn" title="Delete" data-idx="${idx}">×</button>`
      ) +
      `</div>` +
      (isPreview ? '' :
        `<div class="bn-info-expand-panel" style="display:none;">${escapeHTML(JSON.stringify(event, null, 2))}</div>` +
        `<div class="bn-selector-expand-panel" style="display:none;">${createSelectorChainHTML(event, idx)}</div>`
      );

    // Attach event listeners to the new element
    const removeBtn = elem.querySelector(".bn-remove-btn");
    if (removeBtn) removeBtn.addEventListener("click", handleRemoveEvent);

    const infoBtn = elem.querySelector(".bn-info-expand-btn");
    if (infoBtn) infoBtn.addEventListener("click", handleToggleInfoPanel);

    const editBtn = elem.querySelector(".bn-edit-expand-btn");
    if (editBtn) editBtn.addEventListener("click", handleToggleEditPanel);

    elem.addEventListener("click", handleAttributeButtonClick);

    return elem;
  };

  // =================================================================================================
  // 4. UI UPDATES
  // =================================================================================================
  const updateEventsUI = () => {
    const eventsDiv = container.querySelector(`#${moduleId}-captured-context`);
    const clearBtn = container.querySelector(`#${moduleId}-clear-context`);
    if (!eventsDiv) return;
    const existingPreview = eventsDiv.querySelector('[data-preview="true"]');
    if (existingPreview) existingPreview.remove();
    if (!appState.moduleData[moduleId].events.length && !previewEvent) {
      eventsDiv.innerHTML = '<div class="bn-captured-empty">Use DevTools to select context.</div>';
    } else {
      eventsDiv.innerHTML = "";
      appState.moduleData[moduleId].events.forEach((event, idx) =>
        eventsDiv.insertBefore(createEventElement(event, idx), eventsDiv.firstChild)
      );
      if (previewEvent) {
        const previewElement = createEventElement(previewEvent, -1, true);
        eventsDiv.insertBefore(previewElement, eventsDiv.firstChild);
      }
    }
    if (clearBtn) clearBtn.style.display = appState.moduleData[moduleId].events.length ? "inline-block" : "none";
  };

  const updateLockControls = () => {
    const approveBtn = container.querySelector(`#${moduleId}-approve-lock`);
    const clearBtn = container.querySelector(`#${moduleId}-clear-lock`);
    if (approveBtn && clearBtn) {
      const display = isLocked ? "inline-block" : "none";
      approveBtn.style.display = display;
      clearBtn.style.display = display;
    }
  };

  const updateSelectorButtonUI = (eventIdx, levelIdx, selectorIdx) => {
    const clickedButton = document.querySelector(`[data-level="${levelIdx}"][data-selector="${selectorIdx}"][data-event-idx="${eventIdx}"]`);
    if (clickedButton) {
      const event = appState.moduleData[moduleId].events[eventIdx];
      const isNowActive = isSelectorEnabled(event, levelIdx, selectorIdx);
      clickedButton.className = `attributeButton ${isNowActive ? 'active' : 'disabled'}`;
      clickedButton.style.background = isNowActive ? '#fff' : '#f0f0f0';
      clickedButton.style.color = isNowActive ? '#000' : '#999';
    }
  };

  const updateEventTextUI = (eventIdx) => {
    const eventsContainer = container.querySelector(`#${moduleId}-captured-context`);
    const eventElement = eventsContainer ? eventsContainer.querySelector(`[data-idx="${eventIdx}"]`) : null;
    if (eventElement) {
      const textElement = eventElement.querySelector('.bn-capture-text');
      if (textElement) {
        const event = appState.moduleData[moduleId].events[eventIdx];
        const selectorDisplay = getSelectorDisplay(event);
        const innerTextPart = event.innerText ? ` — ${event.innerText}` : '';
        textElement.textContent = selectorDisplay + innerTextPart;
      }
    }
  };

  const updateOpenInfoPanels = () => {
    const eventsContainer = container.querySelector(`#${moduleId}-captured-context`);
    if (!eventsContainer) return;
    const openInfoPanels = eventsContainer.querySelectorAll('.bn-info-expand-panel[style*="display: block"]');
    openInfoPanels.forEach(panel => {
      const eventElement = panel.closest('.bn-context-entry');
      if (eventElement) {
        const eventIndex = parseInt(eventElement.getAttribute("data-idx"));
        if (!isNaN(eventIndex) && eventIndex >= 0 && eventIndex < appState.moduleData[moduleId].events.length) {
          panel.innerHTML = escapeHTML(JSON.stringify(appState.moduleData[moduleId].events[eventIndex], null, 2));
        }
      }
    });
  };

  // =================================================================================================
  // 5. EVENT HANDLERS
  // =================================================================================================
  const messageListener = (msg, sender, sendResponse) => {
    if (msg.action === "devtools-selected-node" && msg.nodeInfo) {
      handleLockedPreview(msg.nodeInfo);
      sendResponse({ status: "devtools-selection-handled" });
      return true;
    }
  };

  const handleRemoveEvent = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const index = parseInt(e.target.getAttribute("data-idx"));
    if (!isNaN(index) && index >= 0 && index < appState.moduleData[moduleId].events.length) {
      appState.moduleData[moduleId].events.splice(index, 1);
      saveAppState();
      updateEventsUI();
    }
  };

  const handleToggleInfoPanel = function (e) {
    const elem = e.target.closest('.bn-context-entry');
    const panel = elem.querySelector('.bn-info-expand-panel');
    if (panel) {
      const isVisible = panel.style.display === 'block';
      if (isVisible) {
        panel.style.display = 'none';
      } else {
        const eventIndex = parseInt(elem.getAttribute("data-idx"));
        if (!isNaN(eventIndex) && eventIndex >= 0 && eventIndex < appState.moduleData[moduleId].events.length) {
          panel.innerHTML = escapeHTML(JSON.stringify(appState.moduleData[moduleId].events[eventIndex], null, 2));
        }
        panel.style.display = 'block';
      }
    }
  };

  const handleToggleEditPanel = function (e) {
    const panel = e.target.closest('.bn-context-entry').querySelector('.bn-selector-expand-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  };

  const handleAttributeButtonClick = (e) => {
    if (e.target.classList.contains("attributeButton")) {
      e.preventDefault();
      e.stopPropagation();
      const eventIdx = parseInt(e.target.getAttribute("data-event-idx"));
      const levelIdx = parseInt(e.target.getAttribute("data-level"));
      const selectorIdx = parseInt(e.target.getAttribute("data-selector"));
      if (!isNaN(eventIdx) && !isNaN(levelIdx) && !isNaN(selectorIdx)) {
        toggleSelector(eventIdx, levelIdx, selectorIdx);
      }
    }
    // Handle Select None/All toggle button
    if (e.target.classList.contains("bn-select-toggle-btn")) {
      e.preventDefault();
      e.stopPropagation();
      const eventIdx = parseInt(e.target.getAttribute("data-event-idx"));
      const toggleMode = e.target.getAttribute("data-toggle");
      if (!isNaN(eventIdx) && eventIdx >= 0 && eventIdx < appState.moduleData[moduleId].events.length) {
        const event = appState.moduleData[moduleId].events[eventIdx];
        
        // Initialize enabledSelectors if it doesn't exist
        if (!event.enabledSelectors || !Array.isArray(event.enabledSelectors)) {
          event.enabledSelectors = event.selectorChain.map(levelSelectors => 
            levelSelectors.map(() => false)
          );
        }
        
        // Toggle all selectors based on mode
        if (toggleMode === 'none') {
          event.enabledSelectors = event.selectorChain.map(levelSelectors => 
            levelSelectors.map(() => false)
          );
        } else {
          event.enabledSelectors = event.selectorChain.map(levelSelectors => 
            levelSelectors.map(() => true)
          );
        }
        
        // Update thisElementsSelector based on the new enabled state
        buildActiveSelectorPath(event);
        
        // Only update the selector chain panel, not the whole event list
        const entryElem = e.target.closest('.bn-context-entry');
        if (entryElem) {
          const selectorPanel = entryElem.querySelector('.bn-selector-expand-panel');
          if (selectorPanel) {
            selectorPanel.innerHTML = createSelectorChainHTML(event, eventIdx);
          }
          // Also update the selector display text in the event row
          const textElement = entryElem.querySelector('.bn-capture-text');
          if (textElement) {
            const innerTextPart = event.innerText ? ` — ${event.innerText}` : '';
            textElement.textContent = getSelectorDisplay(event) + innerTextPart;
          }
        }
        updateOpenInfoPanels();
        saveAppState();
      }
    }
  };

  const clearContext = () => {
    appState.moduleData[moduleId].events = [];
    saveAppState();
    updateEventsUI();
  };

  const approveLockSelection = () => {
    if (isLocked && lockedInfo) {
      const event = {
        ...lockedInfo,
        timestamp: lockedInfo.timestamp || Date.now()
      };
      if (!isDuplicateEvent(event, event.timestamp)) {
        if (event.selectorChain && Array.isArray(event.selectorChain)) {
          event.enabledSelectors = event.selectorChain.map(levelSelectors => 
            levelSelectors.map(() => true)
          );
        } else {
          event.enabledSelectors = [];
        }
        buildActiveSelectorPath(event);
        appState.moduleData[moduleId].events.push(event);
        saveAppState();
      }
      clearLockSelection();
    }
  };

  const clearLockSelection = () => {
    isLocked = false;
    lockedInfo = null;
    previewEvent = null;
    updateEventsUI();
    updateLockControls();
  };

  const handleLockedPreview = (lockedInfoParam) => {
    isLocked = true;
    lockedInfo = lockedInfoParam;
    previewEvent = lockedInfoParam;
    updateEventsUI();
    updateLockControls();
  };

  // =================================================================================================
  // 6. INITIALIZATION
  // =================================================================================================
  const render = () => {
    chrome.runtime.onMessage.addListener(messageListener);

    container.innerHTML = `
      <div>
        <div class="bn-flex-row align-center bn-margin-bottom-2 bn-gap-8">
          <span class="bn-section-label">Context:</span>
          <div class="bn-flex-row bn-gap-8">
            <button id="${moduleId}-approve-lock" class="bn-lock-btn" title="Attach selected context" style="display:none; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:#fff; border:1px solid #22c55e; padding:0;">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style="display:block; margin:auto;" xmlns="http://www.w3.org/2000/svg"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fill="#22c55e"/></svg>
            </button>
            <button id="${moduleId}-clear-lock" class="bn-lock-btn" title="Clear selected context" style="display:none; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:#fff; border:1px solid #ef4444; padding:0;">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style="display:block; margin:auto;" xmlns="http://www.w3.org/2000/svg"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" fill="#ef4444"/></svg>
            </button>
            <button id="${moduleId}-clear-context" class="bn-clear-btn" title="Clear all context">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 7.5V14.5C6.5 15.0523 6.94772 15.5 7.5 15.5H12.5C13.0523 15.5 13.5 15.0523 13.5 14.5V7.5" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 5.5H15.5" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round"/><path d="M8.5 9.5V13.5" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round"/><path d="M11.5 9.5V13.5" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round"/><path d="M9 5.5V4.5C9 3.94772 9.44772 3.5 10 3.5C10.5523 3.5 11 3.94772 11 4.5V5.5" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div id="${moduleId}-captured-context" class="bn-list-block" style="resize: vertical; overflow: auto;background:none;"></div>
      </div>
    `;

    const eventHandlers = {
      [`#${moduleId}-clear-context`]: clearContext,
      [`#${moduleId}-approve-lock`]: approveLockSelection,
      [`#${moduleId}-clear-lock`]: clearLockSelection,
    };

    for (const selector in eventHandlers) {
      const element = container.querySelector(selector);
      if (element) element.onclick = eventHandlers[selector];
    }

    loadAppState().then(() => {
      updateEventsUI();
      updateLockControls();
    })

  };

  const moduleInstance = {
    moduleId,
    render
  };

  return moduleInstance;
};