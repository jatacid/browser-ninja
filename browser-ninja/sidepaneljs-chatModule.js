const createChatModule = (container, config = {}) => {
  const MAX_CONTEXT_TOKENS = 32768;
  const CONTEXT_WARNING_THRESHOLD = 0.8;
  let contextWarningExpanded = false;


  let chatHistory = [];
  let isWaitingForResponse = false;
  const moduleId = config.moduleId || "default-chat";

  const ICONS = {
    plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    minus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12h14" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    trash: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 7.5V14.5C6.5 15.0523 6.94772 15.5 7.5 15.5H12.5C13.0523 15.5 13.5 15.0523 13.5 14.5V7.5" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4.5 5.5H15.5" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8.5 9.5V13.5" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M11.5 9.5V13.5" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M9 5.5V4.5C9 3.94772 9.44772 3.5 10 3.5C10.5523 3.5 11 3.94772 11 4.5V5.5" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    send: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>`,
    play: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff">
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
    save: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z"/>
      <path d="M17 3v4H7V3"/>
      <path d="M12 11a3 3 0 0 1 0 6"/>
    </svg>`,
    close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" stroke-width="2">
      <path d="M6 6L18 18M18 6L6 18"/>
    </svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2">
      <polyline points="20,6 9,17 4,12"/>
    </svg>`,
    refresh: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M5.99237 8.00763C5.99237 8.08679 5.99237 9.41504 5.99237 11.9924C5.99237 15.8584 9.12638 18.9924 12.9924 18.9924M9 10.9924L6 7.99237L3 10.9924M18.0076 14.9847C18.0076 14.9056 18.0076 13.5773 18.0076 11C18.0076 7.13401 14.8736 4 11.0076 4M15 11.9924L18 14.9924L21 11.9924" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

    `,
  };



  const generateSnippetId = () => {
    return `snippet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };


  const lockCodeSnippet = (code) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.log('Error querying tabs:', chrome.runtime.lastError.message);
        return;
      }
      
      if (
        !tabs[0] ||
        !tabs[0].url ||
        tabs[0].url.startsWith("chrome://") ||
        tabs[0].url.startsWith("chrome-extension://")
      ) {
        console.log('Invalid url to save snippet');
        return;
      } 
      
      const url = new URL(tabs[0].url);
      const now = new Date();
      const timestamp = now.toISOString();
      const domain = url.hostname;
      const snippet = {
        id: generateSnippetId(),
        code: code,
        domain: domain,
        title: domain,
        timestamp: timestamp,
        isPaused: true,
      };
      if (!Array.isArray(appState.globalSavedSnippets)) appState.globalSavedSnippets = [];
      appState.globalSavedSnippets.push(snippet);      
      saveAppState();
    });
  };

  const addMessageToChat = (role, content, contextData = null) => {
    const messageObj = {
      role: role,
      content: content,
      timestamp: Date.now(),
      contextData: contextData
    };

    chatHistory.push(messageObj);
    appState.moduleData[moduleId].chatHistory = chatHistory;
    saveAppState();
    renderChatMessages();
    scrollChatToBottom();
    const chatInput = container.querySelector(`#${moduleId}-chat-input`);
    if (chatInput) chatInput.focus();
  };

  const addThinkingIndicator = () => {
    const thinkingObj = {
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isThinking: true,
    };

    chatHistory.push(thinkingObj);
    renderChatMessages();
    scrollChatToBottom();
  };

  function scrollChatToBottom() {
    const chatMessages = container.querySelector(`#${moduleId}-chat-messages`);
    const bnContent = document.getElementById("bn-content");
    const bnOverlay = document.querySelector(".bn-overlay");
    [chatMessages, bnContent, bnOverlay].forEach((el) => {
      if (el) {
        el.scrollTop = el.scrollHeight;
        if (typeof el.scrollTo === "function") {
          el.scrollTo(0, el.scrollHeight);
        }
        setTimeout(() => {
          el.scrollTop = el.scrollHeight;
          if (typeof el.scrollTo === "function") {
            el.scrollTo(0, el.scrollHeight);
          }
        }, 0);
        setTimeout(() => {
          el.scrollTop = el.scrollHeight;
          if (typeof el.scrollTo === "function") {
            el.scrollTo(0, el.scrollHeight);
          }
        }, 50);
      }
    });
  }

  const removeThinkingIndicator = () => {
    const thinkingIndex = chatHistory.findIndex((msg) => msg.isThinking);
    if (thinkingIndex !== -1) {
      chatHistory.splice(thinkingIndex, 1);
    }
  };

  const clearChatHistory = () => {
    chatHistory = [];
    appState.moduleData[moduleId].chatHistory = chatHistory;
    saveAppState();
    renderChatMessages();
  };

  const createWelcomeMessage = () => {
    return `
      <div class="bn-chat-welcome">
        <div class="bn-chat-welcome-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h3>Assistant Ready</h3>
        <p>Use Chrome dev tools to add context.<br>
        Read the instructions for additional tips on how to interact with the Assistant<br>
        Start small and build incrementally.</p>
      </div>`;
  };

  const createMessageHTML = (msg, idx) => {
    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const isUser = msg.role === "user";

    if (msg.isThinking) {
      return `
        <div class="bn-chat-message assistant">
          <div class="bn-chat-message-header">
            <span class="bn-chat-role">Assistant</span>
            <span class="bn-chat-time">${timeStr}</span>
          </div>
          <div class="bn-chat-message-content">
            <div class="bn-thinking-message">
              <div class="bn-thinking-dots">
                <span></span><span></span><span></span>
              </div>
              <span>Thinking...</span>
            </div>
          </div>
        </div>`;
    }

    let messageContent = msg.content;
    let contextSection = "";
    // If this is a user message with context data, separate the original message from context
    if (isUser && msg.contextData && Array.isArray(msg.contextData)) {
      const contextStartIndex = messageContent.indexOf("[context attached by user]");
      if (contextStartIndex !== -1) {
        messageContent = messageContent.substring(0, contextStartIndex).trim();
        contextSection = createContextSection(msg.contextData);
      }
    }
    const hasCode = /\[JS_START\][\s\S]*?\[JS_END\]/.test(messageContent);
    const isSystemWithLink = msg.role === "system" && messageContent.includes("<a href");
    const isRawTextMessage =
      (msg.role === "system" && !isSystemWithLink) ||
      (msg.role === "user" &&
        messageContent.startsWith("Code execution result:"));

    let formattedContent;
    if (isSystemWithLink) {
      formattedContent = `<div style="color: #333;">${messageContent}</div>`;
    } else {
      formattedContent = isRawTextMessage
        ? '<div class="bn-raw-text-container bn-code-textarea" style="color: #333;"></div>'
        : formatMessageContent(messageContent);
    }

    let playButton = "";
    if (!isUser && msg.role !== "system") {
      if (hasCode) {
        playButton = createCodeActionButtons();
      } else {
        playButton = `
          <div class="bn-chat-code-actions">
            <button class="bn-chat-copy-btn-auto" title="Copy snippet to clipboard">
              ${ICONS.copy}
            </button>
          </div>`;
      }
    }
    let userActionButton = "";
    if (isUser) {
      userActionButton = createRefreshActionButton();
    }
function createRefreshActionButton() {
  return `
    <div class="bn-chat-code-actions">
      <button class="bn-chat-refresh-btn bn-chat-copy-btn-auto" title="Resubmit from here">
        ${ICONS.refresh}
      </button>
    </div>`;
}
    return `
      <div class="bn-chat-message ${
        isUser ? "user" : "assistant"
      }" data-chat-idx="${idx}" ${
      isRawTextMessage
        ? `data-raw-text="${encodeURIComponent(msg.content)}"`
        : ""
    }>
        <div class="bn-chat-message-header">
          <span class="bn-chat-role">${isUser ? "You" : (msg.role === "system" ? "Browser Ninja (System)" : "Browser Ninja")}</span>
          <span class="bn-chat-time">${timeStr}</span>
        </div>
        <div class="bn-chat-message-content bn-chat-message-hoverable">
          ${formattedContent}
          ${contextSection}
          ${playButton}
          ${userActionButton}
          <button class="bn-chat-message-delete-btn" title="Delete this message">${
            ICONS.close
          }</button>
        </div>
      </div>`;
  };

  const createContextSection = (contextData) => {
    if (!contextData || !Array.isArray(contextData) || contextData.length === 0) {
      return "";
    }

    function escapeHTML(str) {
      if (typeof str !== 'string') return str;
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }

    function getSelectorDisplay(event) {
      if (event.thisElementsSelectors) {
        if (typeof event.thisElementsSelectors === 'string' && event.thisElementsSelectors.trim() !== '') {
          return event.thisElementsSelectors;
        }
        if (Array.isArray(event.thisElementsSelectors) && event.thisElementsSelectors.length > 0) {
          return event.thisElementsSelectors.join(' ');
        }
      }
      if (event.selectorChain && Array.isArray(event.selectorChain) && event.selectorChain.length > 0) {
        const last = event.selectorChain[event.selectorChain.length - 1];
        if (Array.isArray(last) && last.length > 0) {
          return last.join(' ');
        }
      }
      if (typeof event.selectorChain === 'string') {
        const firstSelector = event.selectorChain.split(', ')[0];
        return firstSelector && firstSelector.trim() !== '' ? firstSelector : (event.tagName || 'element');
      }
      return event.tagName || 'element';
    }

    function createEventHTML(event) {
      return `<div class="bn-chat-entry-content">
             <div class="bn-chat-selector">${escapeHTML(event.tagName || "element")}</div>
             <div class="bn-chat-details">
               <div class="bn-chat-text">${escapeHTML(getSelectorDisplay(event))}${event.innerText ? ` — ${escapeHTML(event.innerText)}` : ''}</div>
             </div>
           </div>`;
    }

    let contextHTML = '<div class="bn-attached-context-section" style="margin-top: 12px; padding: 8px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #4CAF50;">';
    contextHTML += '<div style="font-size: 12px; color: #666; margin-bottom: 8px; font-weight: 500;">📎 Attached Context:</div>';
    
    contextData.forEach((event, idx) => {
      contextHTML += `<div class="bn-context-entry" style="margin-bottom: 4px; background: white; border: 1px solid #e0e0e0; border-radius: 3px; padding: 6px; position: relative;">`;
      contextHTML += createEventHTML(event);
      contextHTML += `<button class="bn-chat-context-info-btn" title="Show Details" data-idx="${idx}" tabindex="0" aria-label="Show details" style="position:absolute;top:6px;right:0px;background:white;border:none;cursor:pointer;font-size:16px;line-height:1;">&#9432;</button>`;
      contextHTML += `<div class="bn-chat-context-info-panel" style="display:none;">${escapeHTML(JSON.stringify(event, null, 2))}</div>`;
      contextHTML += '</div>';
    });
    
    contextHTML += '</div>';
    return contextHTML;
  };

  const createCodeActionButtons = () => {
    return `
      <div class="bn-chat-code-actions">
        <button class="bn-chat-play-btn-auto" title="Run the code in the current tab. Note you might need to refresh between each run.">
          ${ICONS.play} Run Code
        </button>
        <button class="bn-chat-copy-btn-auto" title="Copy snippet to clipboard">
          ${ICONS.copy}
        </button>
        <button class="bn-chat-save-btn-auto" title="Save this snippet">
          ${ICONS.save}
        </button>
      </div>`;
  };

  const formatMessageContent = (content) => {
    function escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    // Split content into code and non-code parts
    let result = "";
    let lastIndex = 0;
    const codeRegex = /\[JS_START\]([\s\S]*?)\[JS_END\]/g;
    let match;
    while ((match = codeRegex.exec(content)) !== null) {
      // Escape and format the text before the code block
      if (match.index > lastIndex) {
        const textPart = content.slice(lastIndex, match.index);
        result += escapeHtml(textPart)
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\n/g, "<br>");
      }
      // Insert code block
      const blockId = `code-block-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      result += `<div class="bn-code-block"><textarea class="bn-code-textarea" data-code-id="${blockId}" readonly></textarea></div>`;
      lastIndex = match.index + match[0].length;
    }
    // Escape and format any remaining text after the last code block
    if (lastIndex < content.length) {
      const textPart = content.slice(lastIndex);
      result += escapeHtml(textPart)
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");
    }
    return result;
  };

  const populateRawTextContent = (chatMessages) => {
    const rawTextMessages = chatMessages.querySelectorAll("[data-raw-text]");
    rawTextMessages.forEach((messageEl) => {
      const rawText = decodeURIComponent(
        messageEl.getAttribute("data-raw-text")
      );
      const containerEl = messageEl.querySelector(".bn-raw-text-container");
      if (containerEl) containerEl.textContent = rawText;
    });
  };

  const populateCodeTextareas = (chatMessages) => {
    const messageElements = chatMessages.querySelectorAll(".bn-chat-message");
    messageElements.forEach((messageEl, msgIndex) => {
      const correspondingMsg = chatHistory[msgIndex];
      if (
        !correspondingMsg ||
        correspondingMsg.isThinking ||
        !correspondingMsg.content
      )
        return;

      const hasCode = correspondingMsg.content.includes("[JS_START]");
      if (!hasCode) return;

      const textareas = messageEl.querySelectorAll(".bn-code-textarea");
      const jsStartMatches =
        correspondingMsg.content.match(/\[JS_START\]([\s\S]*?)\[JS_END\]/g) ||
        [];
      if (
        jsStartMatches.length > 0 &&
        textareas.length === jsStartMatches.length
      ) {
        jsStartMatches.forEach((match, index) => {
          const codeContent = match
            .replace(/\[JS_START\]|\[JS_END\]/g, "")
            .trim();
          if (textareas[index]) {
            textareas[index].value = codeContent;
          }
        });
      }
    });
  };

  const attachMessageEventListeners = (chatMessages) => {
    setTimeout(() => {
      populateRawTextContent(chatMessages);
      populateCodeTextareas(chatMessages);
      attachCodeActionListeners(chatMessages);
      // Attach info expand listeners for attached context entries
      const contextSections = chatMessages.querySelectorAll('.bn-attached-context-section');
      contextSections.forEach(section => {
        const infoBtns = section.querySelectorAll('.bn-chat-context-info-btn');
        infoBtns.forEach(btn => {
          btn.addEventListener('click', function(e) {
            const entry = btn.closest('.bn-context-entry');
            if (!entry) return;
            const panel = entry.querySelector('.bn-chat-context-info-panel');
            if (panel) {
              panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
            }
          });
        });
      });
      const deleteBtns = chatMessages.querySelectorAll(
        ".bn-chat-message-delete-btn"
      );
      deleteBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const msgEl = btn.closest(".bn-chat-message");
          if (!msgEl) return;
          const idx = parseInt(msgEl.getAttribute("data-chat-idx"), 10);
          if (!isNaN(idx)) {
            chatHistory.splice(idx, 1);
            appState.moduleData[moduleId].chatHistory = chatHistory;
            saveAppState();
            renderChatMessages();
          }
        });
      });
      const refreshBtns = chatMessages.querySelectorAll(".bn-chat-refresh-btn");
      refreshBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const msgEl = btn.closest(".bn-chat-message");
          if (!msgEl) return;
          const idx = parseInt(msgEl.getAttribute("data-chat-idx"), 10);
          if (isNaN(idx)) return;
          // Remove all messages after this index
          chatHistory = chatHistory.slice(0, idx + 1);
          appState.moduleData[moduleId].chatHistory = chatHistory;
          saveAppState();
          renderChatMessages();
          // Resubmit the user message to LLM
          const msg = chatHistory[idx];
          if (msg && msg.role === "user") {
            isWaitingForResponse = true;
            updateSendButtonState();
            addThinkingIndicator();
            sendMessageToLLM(msg.content);
          }
        });
      });
    }, 0);
  };

  const copyToClipboard = (code, button) => {
    navigator.clipboard
      .writeText(code)
      .then(() => showButtonFeedback(button, ICONS.check))
      .catch(() => console.error("Failed to copy code to clipboard"));
  };

  const showButtonFeedback = (button, icon) => {
    const originalIcon = button.innerHTML;
    button.innerHTML = icon;
    setTimeout(() => {
      button.innerHTML = originalIcon;
    }, 1000);
  };

  const attachCodeActionListeners = (chatMessages) => {
    const autoPlayButtons = chatMessages.querySelectorAll(
      ".bn-chat-play-btn-auto"
    );
    const autoCopyButtons = chatMessages.querySelectorAll(
      ".bn-chat-copy-btn-auto"
    );
    const autoLockButtons = chatMessages.querySelectorAll(
      ".bn-chat-save-btn-auto"
    );

    autoPlayButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const messageEl = button.closest(".bn-chat-message");
        const codeTextarea = messageEl.querySelector(".bn-code-textarea");
        if (codeTextarea) {
          const code = codeTextarea.value.trim();
          showButtonFeedback(button, ICONS.check);
          executeCodeSnippet(code,container,moduleId);
        }
      });
    });

    autoCopyButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const messageEl = button.closest(".bn-chat-message");
        let code = "";
        const codeTextarea = messageEl.querySelector(".bn-code-textarea");
        if (codeTextarea) {
          code = codeTextarea.value.trim();
        } else {
          // fallback: get all text content from .bn-chat-message-content, excluding the delete button
          const contentEl = messageEl.querySelector(
            ".bn-chat-message-content"
          );
          if (contentEl) {
            // Remove the delete button and code actions from the content
            const clone = contentEl.cloneNode(true);
            const btns = clone.querySelectorAll(
              "button, .bn-chat-code-actions"
            );
            btns.forEach((b) => b.remove());
            code = clone.innerText.trim();
          }
        }
        if (code) {
          copyToClipboard(code, button);
        }
      });
    });

    autoLockButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const messageEl = button.closest(".bn-chat-message");
        const codeTextarea = messageEl.querySelector(".bn-code-textarea");
        if (codeTextarea) {
          const code = codeTextarea.value.trim();
          lockCodeSnippet(code);
          showButtonFeedback(button, ICONS.check);
        }
      });
    });
  };

// Execute snippet function #1
  function executeCodeSnippet(code, container, moduleId) {
    const chatInput = container.querySelector(`#${moduleId}-chat-input`);
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        if (chatInput) {
          chatInput.value = `**Code execution failed**\n\nError: ${chrome.runtime.lastError.message}`;
          chatInput.focus();
        }
        return;
      }

      if (!tabs || !tabs[0] || !tabs[0].id) {
        if (chatInput) {
          chatInput.value = `**Code execution failed**\n\nError: No active tab found`;
          chatInput.focus();
        }
        return;
      }

      chrome.runtime.sendMessage(
        {
          type: "executeSnippet",
          value: code,
          tabId: tabs[0].id,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            if (chatInput) {
              chatInput.value = `**Code execution failed**\n\nError: ${chrome.runtime.lastError.message}`;
              chatInput.focus();
            }
            return;
          }

          if (response && response.success) {
            let result = response.result;
            
            // Ensure result is properly stringified if it's an object
            if (typeof result === 'object' && result !== null) {
              try {
                result = JSON.stringify(result, null, 2);
              } catch (e) {
                result = '[Unserializable Object]';
              }
            }
            
            const shouldPopulateInput =
              result &&
              result !== "undefined" &&
              String(result).trim() !== "" &&
              !String(result).includes("success");

            if (shouldPopulateInput && chatInput) {
              chatInput.value = `Code execution result:\n\n${result}`;
              chatInput.focus();
            }
          } else {
            if (chatInput) {
              chatInput.value = `**Code execution failed**\n\nError: ${
                response ? response.result : "Unknown error"
              }`;
              chatInput.focus();
            }
          }
        }
      );
    });
  }



  const renderChatMessages = () => {
    const chatMessages = container.querySelector(`#${moduleId}-chat-messages`);
    if (!chatMessages) return;

    if (chatHistory.length === 0) {
      chatMessages.innerHTML = createWelcomeMessage();
      window.scrollTo(0, document.body.scrollHeight);
      return;
    }

    chatMessages.innerHTML = chatHistory
      .map((msg, idx) => createMessageHTML(msg, idx))
      .join("");
    attachMessageEventListeners(chatMessages);
    scrollChatToBottom();
    updateContextWarning();
  };

let hasValidKeys = false;
const updateSendButtonState = () => {
  const sendButton = container.querySelector(`#${moduleId}-send-button`);
  const chatInput = container.querySelector(`#${moduleId}-chat-input`);

  if (sendButton) {
    sendButton.disabled = isWaitingForResponse || !hasValidKeys;
    sendButton.innerHTML = isWaitingForResponse
      ? '<div class="bn-thinking-dots"><span></span><span></span><span></span></div>'
      : ICONS.send;

    if (isWaitingForResponse) {
      sendButton.classList.add("thinking");
    } else {
      sendButton.classList.remove("thinking");
    }
    if (sendButton.disabled) {
      sendButton.classList.add("bn-disabled");
      sendButton.style.background = "#bdbdbd";
      sendButton.style.color = "#fff";
      sendButton.style.cursor = "not-allowed";
    } else {
      sendButton.classList.remove("bn-disabled");
      sendButton.style.background = "";
      sendButton.style.color = "";
      sendButton.style.cursor = "";
    }
  }


  updateContextWarning();
};





  const sendMessageToLLM = (userMessage) => {
    const apiKey = appState.moduleData.global.apiKey || "";
    const systemPrompt = appState.moduleData.global.systemPrompt || "";

    if (!apiKey) {
      addMessageToChat("system", "Please enter your OpenAI API Key in the Settings.");
      isWaitingForResponse = false;
      updateSendButtonState();
      return;
    }

    let filteredHistory = chatHistory.filter(
      (msg) => !msg.isThinking && msg.role !== "system"
    );
    filteredHistory = filteredHistory.filter(
      (msg, idx, arr) => !(msg.role === "assistant" && msg.content === "")
    );
    if (
      !(
        filteredHistory.length &&
        filteredHistory[filteredHistory.length - 1].role === "user" &&
        filteredHistory[filteredHistory.length - 1].content === userMessage
      )
    ) {
      filteredHistory.push({ role: "user", content: userMessage });
    }
    
    const messages = filteredHistory.map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    // Prepend system prompt
    if (systemPrompt) {
      messages.unshift({ role: "system", content: systemPrompt });
    }

    // Add page URL to the system prompt context if available
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const pageUrl = tabs && tabs[0] ? tabs[0].url : "[Unknown]";
      if (messages[0].role === 'system') {
        messages[0].content += `\n\nUrl: ${pageUrl}`;
      } else {
        messages.unshift({ role: "system", content: `Url: ${pageUrl}` });
      }

      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o", // Using a capable model
          messages: messages,
          temperature: 0.7,
          response_format: { type: "json_object" }
        })
      })
        .then((response) => response.json())
        .then((data) => {
          isWaitingForResponse = false;
          updateSendButtonState();
          removeThinkingIndicator();
          
          if (data.error) {
             addMessageToChat(
              "system",
              `OpenAI API Error: ${data.error.message}`
            );
          } else if (
            data.choices &&
            data.choices[0] &&
            data.choices[0].message
          ) {
            let reply = data.choices[0].message.content;
            
            // Parse the JSON response and reformat if needed (matching original backend logic)
            try {
                const parsed = JSON.parse(reply);
                if (parsed && parsed.explanation && parsed.javascript_code) {
                    reply = parsed.explanation + "\n\n[JS_START]\n" + parsed.javascript_code + "\n[JS_END]";
                }
            } catch (e) {
                // If not JSON or other format, use as is
            }

            addMessageToChat("assistant", reply);
          } else {
             addMessageToChat(
              "system",
              "Error: Unexpected response format from OpenAI."
            );
          }
        })
        .catch((error) => {
          isWaitingForResponse = false;
          updateSendButtonState();
          removeThinkingIndicator();
          addMessageToChat(
            "system",
            `Network Error: ${error.message}`
          );
        });
    });
  };

  const handleSendMessage = () => {
    if (isWaitingForResponse) return;

    const chatInput = container.querySelector(`#${moduleId}-chat-input`);
    const message = chatInput ? chatInput.value.trim() : "";
    if (!message) return;

    const contextCaptureSelections = appState.moduleData[`${moduleId}-contextCapture`].events || [];
    
    let finalMessage = message;
    let contextData = null;

    if (contextCaptureSelections && contextCaptureSelections.length > 0) {
      contextData = contextCaptureSelections.map(selection => {
        const { selectorChain, enabledSelectors, thisElementsSelectors, ...filteredSelection } = selection;
        if (typeof thisElementsSelectors !== 'undefined' && thisElementsSelectors !== "") {
          filteredSelection.thisElementsSelectors = thisElementsSelectors;
        }
        return filteredSelection;
      });
      finalMessage = message + "\n\n[context attached by user]\n" + JSON.stringify(contextData, null, 2);
      appState.moduleData[`${moduleId}-contextCapture`].events = [];
      saveAppState().then(() => {
        const contextCaptureModuleContainer = container.querySelector(`#${moduleId}-contextCaptureModuleContainer`);
        if (typeof contextCaptureModule !== "undefined" && contextCaptureModule && typeof contextCaptureModule.render === "function") {
          contextCaptureModule.render();
        } else if (contextCaptureModuleContainer) {
          contextCaptureModuleContainer.innerHTML = "";
        }
      });
    }
    proceedWithMessage(finalMessage, contextData);

    function proceedWithMessage(messageToSend, attachedContext) {
      addMessageToChat("user", messageToSend, attachedContext);
      if (chatInput) {
        chatInput.value = "";
        appState.moduleData[moduleId].chatInputValue = "";
        saveAppState();
      }
      isWaitingForResponse = true;
      updateSendButtonState();
      addThinkingIndicator();
      sendMessageToLLM(messageToSend);
    }
  };





  // Utility: Estimate token count for context
function estimateTokenCount(messages) {
  let total = 0;
  messages.forEach(function(msg) {
    if (msg.content) {
      total += Math.ceil(msg.content.length / 4);
    }
  });
  return total;
}

function updateContextWarning() {
  var warningEl = container.querySelector(`#${moduleId}-context-warning`);
  if (!warningEl) return;
  var tokens = estimateTokenCount(chatHistory);
  var threshold = Math.floor(MAX_CONTEXT_TOKENS * CONTEXT_WARNING_THRESHOLD);
  if (tokens >= threshold) {
    warningEl.style.display = "block";
    warningEl.style.background = "#ffeaea";
    warningEl.style.color = "#d32f2f";
    warningEl.style.border = "1px solid #d32f2f";
    warningEl.style.borderRadius = "4px";
    warningEl.style.padding = "8px";
    warningEl.style.fontWeight = "bold";
    warningEl.style.position = "relative";
    warningEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;cursor:pointer;" id="${moduleId}-context-warning-toggle">
        <span style="font-size:16px;">${tokens} / ${MAX_CONTEXT_TOKENS} tokens</span>
        <span style="font-size:18px;transform:rotate(${contextWarningExpanded ? 90 : 0}deg);transition:transform 0.2s;">&#8250;</span>
      </div>
      <div id="${moduleId}-context-warning-explanation" style="display:${contextWarningExpanded ? "block" : "none"};margin-top:6px;font-size:13px;font-weight:normal;color:#d32f2f;">
        Context limit - The assistant will start to ignore earlier tokens. Consider deleting some earlier messages, or copy pasting the latest snippets and starting a fresh thread.
      </div>
    `;
    var toggle = warningEl.querySelector(`#${moduleId}-context-warning-toggle`);
    if (toggle) {
      toggle.onclick = function() {
        contextWarningExpanded = !contextWarningExpanded;
        updateContextWarning();
      };
    }
  } else {
    warningEl.style.display = "none";
    contextWarningExpanded = false;
  }
}



  const render = () => {

    const hexColour = config.hexColour || "#c9c9ee";

    container.innerHTML = `
      <div class="chat-container module-container" style="background:${hexColour}; padding: 16px;">
      <div class="bn-chat-container bn-margin-bottom-10">
      <div class="bn-chat-header">
        <span class="bn-section-label">Browser Ninja</span>
        <button id="${moduleId}-clear-chat-btn" class="bn-clear-btn" title="Clear chat history">${ICONS.trash}</button>
      </div>
      <div id="${moduleId}-chat-messages" class="bn-chat-messages"></div>
      <div class="bn-chat-input-container">
        <div id="${moduleId}-attached-context-container" style="margin-bottom:8px; width: 100%;">
        <div id="${moduleId}-contextCaptureModuleContainer"></div>
        </div>
        <div style="display: flex;width: 100%;flex-direction: row;flex-wrap: nowrap;align-content: center;justify-content: flex-start;align-items: flex-end;gap: 9px;">
        <textarea id="${moduleId}-chat-input" class="bn-chat-input" placeholder="Ask the assistant to help with modifications..." rows="3"></textarea>
        <button id="${moduleId}-send-button" class="bn-chat-send-btn">${ICONS.send}</button>
        </div>
        <div id="${moduleId}-context-warning" style="display:none;margin-top:6px;"></div>
      </div>
      </div>
      </div>
    `;

    const clearChatBtn = container.querySelector(`#${moduleId}-clear-chat-btn`);
    const sendButton = container.querySelector(`#${moduleId}-send-button`);
    const chatInput = container.querySelector(`#${moduleId}-chat-input`);

    if (clearChatBtn) clearChatBtn.onclick = clearChatHistory;
    if (sendButton) sendButton.addEventListener("click", handleSendMessage);
    

  appState.moduleData = appState.moduleData ? appState.moduleData : {};
    appState.moduleData[moduleId] = appState.moduleData[moduleId] ? appState.moduleData[moduleId] : {};
    appState.moduleData[moduleId].chatInputValue = appState.moduleData[moduleId].chatInputValue ? appState.moduleData[moduleId].chatInputValue : "";
    chatInput.value = appState.moduleData[moduleId].chatInputValue ? appState.moduleData[moduleId].chatInputValue : "";
    chatHistory = Array.isArray(appState.moduleData[moduleId].chatHistory) ? appState.moduleData[moduleId].chatHistory : chatHistory;
    appState.moduleData[`${moduleId}-contextCapture`] = appState.moduleData[`${moduleId}-contextCapture`] ? appState.moduleData[`${moduleId}-contextCapture`] : {};


    if (appState.moduleData.global && appState.moduleData.global.apiKey) {
      hasValidKeys = true;
    } else {
      hasValidKeys = false;
    }
    saveAppState();


    const contextCaptureModuleContainer = container.querySelector(`#${moduleId}-contextCaptureModuleContainer`);
    if (contextCaptureModuleContainer && !contextCaptureModuleContainer.hasChildNodes()) {
      contextCaptureModule = createContextCaptureModule(contextCaptureModuleContainer, {
        moduleId: `${moduleId}-contextCapture`,
      });
      contextCaptureModule.render();
    }
    if (chatInput) {
      chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
        }
      });
      // Save chat input to state on input, namespaced by moduleId
      chatInput.addEventListener("input", () => {
        appState.moduleData[moduleId].chatInputValue = chatInput.value;
        saveAppState();
      });
    }

      updateSendButtonState();
      renderChatMessages();

  };

  const moduleInstance = {
    moduleId,
    render,
    lockCodeSnippet,
    addMessageToChat,
  };
  return moduleInstance;

};
