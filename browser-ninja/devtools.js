
function isValidTabUrl(url) {
  return (
    url &&
    !url.startsWith('chrome://') &&
    !url.startsWith('chrome-error://') &&
    !url.startsWith('devtools://') &&
    !url.startsWith('chrome-extension://') &&
    !url.startsWith('edge://') &&
    !url.startsWith('about:') &&
    !url.startsWith('file://') &&
    !url.startsWith('data:')
  );
}

chrome.devtools.inspectedWindow.eval('window.location.href', function(url, isException) {
  if (isException || !isValidTabUrl(url)) {
    return;
  }

  const handleElementSelection = function () {
    
      // chrome.runtime.sendMessage({ type: 'logging', value: 's'+ testvar }, () => {
      //   if (chrome.runtime.lastError) {
      //   }
      // });
    
    // Inject the shared node info code and execute it on the selected element
    const getNodeInfoCode = `
      (function() {
        if (!$0) {
          return null;
        }
        const node = $0;
        ${window.buildNodeInfoCode}
        
        const selectorData = getCssSelectorChain(node);
        return {
          tagName: node.tagName ? node.tagName.toLowerCase() : null,
          innerText: truncateListOrString(node.innerText || ""),
          outerHTML: truncateListOrString(sanitizeOuterHTML(node)),
          siblingCount: truncateListOrString(getSiblingCount(node)),
          visibility: truncateListOrString(getComputedVisibility(node)),
          opacity: truncateListOrString(getOpacity(node)),
          inViewport: truncateListOrString(isInViewport(node)),
          selectorChain: selectorData.chain,
          timestamp: Date.now()
        };
      })();
    `;
    try {
      chrome.devtools.inspectedWindow.eval(getNodeInfoCode, function(result, isException) {
        if (isException) {
          return;
        }
        if (result) {
          try {
            chrome.runtime.sendMessage({ 
              action: 'devtools-selected-node', 
              nodeInfo: result 
            }, function(response) {
              // Safely ignore any connection errors for node selection updates
              if (chrome.runtime.lastError) {
                // Silently ignore - node selection is not critical
              }
            });
          } catch (e) {
            // Extension context may be invalidated, silently ignore
          }
        }
      });
    } catch (e) {
      // Fail gracefully if context is invalid
      // console.warn('Eval failed:', e);
    }
  };

  // Listen for selection changes
  chrome.devtools.panels.elements.onSelectionChanged.addListener(handleElementSelection);
  
  // Capture initial selection when DevTools first opens
  setTimeout(handleElementSelection, 100);
});















chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Check if the message is valid and intended for this type of listener.
  if (message?.type !== 'executeSnippetOnDevTools' || typeof message.value !== 'string') {
    return; // Not our message, don't respond.
  }

  // DevTools context is tab-specific. Check if the message is for this tab.
  // chrome.devtools.inspectedWindow.tabId is the ID of the tab this devtools instance is inspecting.
  // We compare it with the active tab ID sent from the background script.
  if (!message.tabId || message.tabId !== chrome.devtools.inspectedWindow.tabId) {
    return;
  }

  const safeSend = (() => {
    let responded = false;
    return (resp) => {
      if (!responded) {
        responded = true;
        try {
          sendResponse(resp);
        } catch (e) {
          // Connection may have been closed, ignore
        }
      }
    };
  })();

  try {
    if (!chrome.devtools || !chrome.devtools.inspectedWindow) {
      safeSend({
        success: false,
        result: 'DevTools is not available in this context.',
        method: 'devtools',
        errorType: 'devtools_not_available'
      });
      return true;
    }

    chrome.devtools.inspectedWindow.eval(message.value, (result, isException) => {
      if (isException) {
        safeSend({
          success: false,
          result: isException.value || isException.description || 'Error executing code in DevTools',
          method: 'devtools',
          errorType: 'execution_error',
          exception: isException
        });
      } else {
        safeSend({
          success: true,
          result: result !== undefined ? result : 'Code executed successfully',
          method: 'devtools'
        });
      }
    });
  } catch (e) {
    safeSend({
      success: false,
      result: e.message || 'Unknown error accessing DevTools',
      method: 'devtools',
      errorType: 'access_error'
    });
  }

  return true;
});
