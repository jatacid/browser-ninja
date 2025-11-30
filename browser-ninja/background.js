
// Open sidepanel when extension icon is clicked
if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener((tab) => {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: tab.id }).catch((error) => {
        console.log("Error opening side panel:", error);
      });
    }
  });
}


chrome.runtime.onInstalled.addListener(() => {
  // Extension installed, ready for devtools
});

// Only inject snippets when tab status is 'loading' (start of navigation)
let runOnce = false;
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (runOnce === false && changeInfo.status === 'loading' && tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-error://') && !tab.discarded) {
    injectSavedSnippets(tabId, tab.url);
    runOnce = true;
  }
  //clear it once the tab has finished loading.
  if (runOnce && changeInfo.status === 'complete' && tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-error://') && !tab.discarded) {
    runOnce = false;
  }
  
});

// Combined message listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const safeSend = (() => {
    let responded = false;
    return (resp) => {
      if (!responded) {
        responded = true;
        sendResponse(resp);
      }
    };
  })();

  if (msg.type === 'executeSnippet') {
    handleExecuteSnippet(msg.tabId, msg, safeSend);
  } else {
    // Handle other message types here if needed
    safeSend();
  }
  // Return true to indicate that we will send a response asynchronously.
  return true;
});



// Inject saved & locked snippets into the current tab if domain matches and not paused
function injectSavedSnippets(tabId, url) {
  chrome.storage.local.get("BN_STATE", (result) => {
    if (chrome.runtime.lastError) return;
    
    const appStateBackground = result.BN_STATE || {};
    const savedSnippets = appStateBackground.globalSavedSnippets || [];
    let injectedCount = 0;
    let toInject = [];
    
    savedSnippets.forEach((snippet) => {
      const snippetDomain = snippet.domain.replace(/^https?:\/\//, "");
      let msgUrl;
      try {
        if (typeof url === "string" && /^https?:\/\//.test(url)) {
          msgUrl = new URL(url);
        } else {
          return;
        }
      } catch (e) {
        return;
      }
      const thisCode = snippet.code;
      if (msgUrl.hostname === snippetDomain && !snippet.isPaused) {
        toInject.push(thisCode);
      }
    });
    
    if (toInject.length === 0) {
      chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});
      return;
    }
    
    toInject.forEach((code) => {
      handleExecuteSnippet(tabId, { value: code }, (response) => {
        if (response && response.success) injectedCount++;
        chrome.action.setBadgeText({ text: injectedCount > 0 ? injectedCount.toString() : '', tabId }).catch(() => {});
      });
    });
  });
}




function handleExecuteSnippet(tabId, message, sendResponse) {
  if (typeof message.value !== 'string') return;
  
  const safeSend = (() => {
    let responded = false;
    return (resp) => {
      if (!responded) {
        responded = true;
        sendResponse(resp);
      }
    };
  })();

  const safeLog = (value) => {
    try {
      chrome.runtime.sendMessage({ type: 'logging', value }, () => {
        if (chrome.runtime.lastError) {
          // Ignore logging errors silently
        }
      });
    } catch (e) {
      // Ignore logging errors silently
    }
  };

  const showUserError = (message) => {
    try {
      chrome.runtime.sendMessage({ type: 'showError', message }, () => {
        if (chrome.runtime.lastError) {
          // Ignore if sidepanel is not open
        }
      });
    } catch (e) {
      // Ignore errors silently
    }
  };

  const code = message.value.trim();
  
  const runWithTab = (tab) => {
    if (!tab || !tab.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-error://') || tab.discarded) {
      safeLog('No valid tab available');
      safeSend({ success: false, result: 'No valid tab available' });
      return;
    }

    // Try DevTools first, then content script worlds
    executeSnippetOnDevtools(tab.id, code, (devtoolsResponse) => {
      if (devtoolsResponse && devtoolsResponse.success) {
        let logVal = devtoolsResponse.result;
        if (typeof logVal === 'object') {
          try { logVal = JSON.stringify(logVal); } catch (e) { logVal = '[object Object]'; }
        }
        safeLog('devtools: ' + (logVal !== undefined ? logVal : 'success'));
        safeSend(devtoolsResponse);
        return;
      }

      // DevTools failed, try MAIN world
      safeLog('DevTools world failed, trying MAIN world...');

      executeSnippetOnContent(tab.id, code, 'MAIN', (mainResponse) => {
        if (mainResponse && mainResponse.success) {
          let logValue = 'success';
          if (mainResponse.result !== undefined && mainResponse.result !== 'undefined') {
            logValue = mainResponse.result;
            if (typeof logValue === 'object') {
              try { logValue = JSON.stringify(logValue); } catch (e) { logValue = '[object Object]'; }
            }
          }
          safeLog('main_content: ' + logValue);
          safeSend(mainResponse);
          return;
        }

        // MAIN world failed, try ISOLATED world
        const mainError = (mainResponse && mainResponse.result) || 'Unknown MAIN world error';
        safeLog('MAIN world failed, trying ISOLATED world...');
        
        // Check if it's a code syntax/initialization error that won't work in any context
        if (mainError.includes('before initialization') || mainError.includes('is not defined') || mainError.includes('Unexpected token')) {
          const codeError = 'Code execution failed due to JavaScript syntax or initialization error: ' + mainError;
          showUserError('Code error: ' + mainError);
          safeLog('Code Error: ' + codeError);
          safeSend({ success: false, result: codeError, method: 'Code Error' });
          return;
        }
        
        executeSnippetOnContent(tab.id, code, 'ISOLATED', (isolatedResponse) => {
          if (isolatedResponse && isolatedResponse.success) {
            safeLog('isolated: ' + (isolatedResponse.result !== undefined ? isolatedResponse.result : 'success'));
            safeSend(isolatedResponse);
          } else {
            const isolatedError = (isolatedResponse && isolatedResponse.result) || 'Unknown ISOLATED world error';
            const allError = 'All execution contexts failed. The site has strict script policy. Open DevTools and try again. MAIN: ' + mainError + '. ISOLATED: ' + isolatedError;
            // Show user-friendly error notification
            const userError = 'Script execution failed. This website has strict security policies that prevent code execution. Try opening the browser DevTools (F12) and running the code again.';
            showUserError(userError);
            safeLog('All Contexts Failed: ' + allError);
            
            
            safeSend({ success: false, result: allError, method: 'All Contexts Failed' });
          }
        });
      });
    });
  };

  if (tabId) {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        safeSend({ success: false, result: 'Tab not found: ' + chrome.runtime.lastError.message });
        return;
      }
      runWithTab(tab);
    });
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        safeSend({ success: false, result: 'Could not query tabs: ' + chrome.runtime.lastError.message });
        return;
      }
      runWithTab(tabs && tabs[0]);
    });
  }
}

function executeSnippetOnContent(tabId, code, world, sendResponse) {
  if (!tabId) {
    sendResponse({ success: false, result: 'No tab context', method: world === 'MAIN' ? 'main_content' : 'isolated' });
    return;
  }

  const safeSend = (() => {
    let responded = false;
    return (resp) => {
      if (!responded) {
        responded = true;
        sendResponse(resp);
      }
    };
  })();

  chrome.scripting.executeScript({
    target: { tabId },
    world,
    func: async (code) => {
      try {
        let result = eval(code);
        if (result instanceof Promise) {
          result = await result;
        }
        let finalResult;
        if (typeof result === 'string') {
          finalResult = result;
        } else if (typeof result === 'object' && result !== null) {
          try {
            const replacer = (key, value) => {
              if (value && typeof value === 'object' && ('x' in value || 'left' in value) && ('width' in value || 'height' in value)) {
                return {
                  x: value.x,
                  y: value.y,
                  width: value.width,
                  height: value.height,
                  top: value.top,
                  right: value.right,
                  bottom: value.bottom,
                  left: value.left,
                };
              }
              return value;
            };
            finalResult = JSON.stringify(result, replacer, 2);
          } catch (e) {
            finalResult = '[Unserializable Object]';
          }
        } else {
          finalResult = String(result);
        }
        return { success: true, result: finalResult };
      } catch (e) {
        return { success: false, result: e.message };
      }
    },
    args: [code]
  }, (results) => {
    if (chrome.runtime.lastError) {
      safeSend({
        success: false,
        result: chrome.runtime.lastError.message,
        method: world === 'MAIN' ? 'main_content' : 'isolated'
      });
      return;
    }
    const res = results && results[0] && results[0].result;
    if (res && res.success) {
      safeSend({
        success: true,
        result: res.result !== undefined ? res.result : `Snippet executed successfully in ${world} world (page context).`,
        method: world === 'MAIN' ? 'main_content' : 'isolated'
      });
    } else {
      safeSend({
        success: false,
        result: (res && res.result) || 'Unknown error',
        method: world === 'MAIN' ? 'main_content' : 'isolated'
      });
    }
  });
}


function executeSnippetOnDevtools(tabId, code, sendResponse) {
  const safeSend = (() => {
    let responded = false;
    return (resp) => {
      if (!responded) {
        responded = true;
        sendResponse(resp);
      }
    };
  })();

  chrome.runtime.sendMessage({ type: 'executeSnippetOnDevTools', tabId, value: code }, (devtoolsResponse) => {
    if (chrome.runtime.lastError) {
      // DevTools is not available, return null to indicate fallback should be used
      safeSend(null);
      return;
    }
    
    if (devtoolsResponse && devtoolsResponse.success) {
      safeSend(devtoolsResponse);
    } else {
      // DevTools execution failed, return null to indicate fallback should be used
      safeSend(null);
    }
  });
}