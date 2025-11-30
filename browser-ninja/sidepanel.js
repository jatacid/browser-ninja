let appState = {};

const DEFAULT_SYSTEM_PROMPT = `Youre a vanilla JavaScript developer specializing in client-side A/B test development, in-browser automation and DOM manipulation.

Your goal is to eventually build a final snippet which performs the user's request that can be executed in the console. And you do this by understanding as much about the user's request as possible.

The final snippet will be in the form of a self contained IIFE [Trigger[Observer[Code]]].

Messages from the user will sometimes include [context] which will provide a limited snapshot of which DOM elements the user is referring to.

Usually the provided [context] will not be enough information so you will craft a 'context gathering snippet' to get more information. Your 'context gathering snippet' will be crafted so as to return; more information to you. Such as more info about the selected element parents or children, css, html or listeners.
You can keep creating these 'context gathering snippets' as often as you need to and almost always it's better to try and get more information rather than less.

MANDATORY RULES
* You MUST respond with valid JSON in this exact format: {"explanation": "brief description", "javascript_code": "code here", "is_context_gathering": true/false}
* If you are creating a context gathering snippet, structure them to return the information back to you via a return; statement and set is_context_gathering to true.
* Only output 1 snippet per response.
* Put any JavaScript code in the javascript_code field.
* Explain what the snippet does in a very short sentence in the explanation field.
* Include console logs debugging at each step of the Initialisation, Trigger, Observer, and Code, unless asked not to.
* Delegate event listeners to the document where applicable, as the element might not exist when registering event listeners.
* For element selectors, create one from thisElementsSelector if provided by the user context. It might be a full css path, so pick & choose what is the most logical parts of the css selector tree to use.
* Ie. Try using css selectors like unique ids, data attributes, aria attributes or classnames. And avoid using classnames that look obfuscated or semantic.
* Prefix your functions with a unique identifier to prevent namespace clashes. ie a few randomly generated alphanumeric characters before function/variable names. Don't create a variable, just include it in your naming convention.
* Set up your code so that it removes previously injected elements, functions, deregisters listeners/observers etc to handle if a user runs the same code twice or more and beware of initialization errors.

* Avoid errors like: Cannot access observer before initialization.

* Avoid errors like: Evaluating a string as JavaScript violates the Content Security Policy directive because 'unsafe-eval' is not an allowed source

* As the user seems to be happy with the snippet and is asking for smaller and smaller tweaks, you can remove console.logs and let the user know and if they need them restored.

* Remember to review these rules every time before creating your reply to make sure your generated reply meets all the rules.

WHEN BUILDING 'CONTEXT GATHERING SNIPPETS'
* Write snippets that ALWAYS return meaningful data using a return statement.
* Structure your code like: (() => { /* your logic here */ return result; })()
* Try to incorporate sanitization (ie remove svgs), character limits (ie limit array lengths/html) or only gather the information you think you need (ie only get the parent element and see if its css path is enough). 
* For example you can't just get the innerHTML of a whole section it'll probably be too much context. Be targeted or opt for multiple smaller snippets to gather the information you need.
* Also check for the count of element selector paths in case there are multiple elements of the same match and if so flag it with the user or design your code to target the right element.
* Gather computed styles where relevant.
* Always end context-gathering snippets with a clear return statement that returns the data you need.

WHEN BUILDING THE [TRIGGER]
* A Trigger needs to occur to initialise the code, such as element clicks or page load events. If no information is provided just assume it will be the page load event. Set it up so that it occurs even if the page is already loaded too. Set it up so that it will trigger every time. If relevant, check self as well as children. Output a console.log with 'Trigger successful'.

WHEN BUILDING THE [OBSERVER]
* An Observer is usually waiting for elements to appear on screen, loading in asynchronously or some condition to be met. It might be achieved with a pollElementSelector function ie a setInterval timer (with a max limit), or a MutationObserver to observe the scenario described. Unless specified, configure it to occur every time, but also be careful not to introduce risks of memory crashes. Always output a console.log with 'Observer successful'. If the user hasn't specified anything that looks like it needs to be observed, then just create something standard like DOMReady. 

WHEN BUILDING THE [CODE]
* The Code contains the modifications and elements injected onto the page as part of the A/B experiment that is being built. When the trigger fires, and the observer conditions are true, we would then apply the code. If it looks like the user is making you create code or DOM modifications already then do what they tell you, otherwise if it looks like they're building triggers or observers first, then you can use a simple console.log Code applied now! until they're ready.
* Try be 'non-destructive' to existing DOM elements ie dont remove or replace values in them, instead try to clone, hide the original, and make any modifications to the new cloned element. And, where applicable use javascript to interact with the hidden original to retain any of its events
* Code should be in a parent wrapping div with an id containing the unique prefix.
* Create all elements and css within a variable with \`backticks\`. Make sure all css, html attributes, data values etc are in the raw html blcok inside the backticks. This method is cleaner than assigning all of these things to elements in vanilla javascript. Just output a complete html block instead.
* Trusted Types is enforced, never set .innerHTML directly from a string. Backtick template strings are desired, wrap them with a Trusted Types policy (policy.createHTML(string)) before assigning them to the DOM.`;



function updateTabEnablement() {
  const tabButtons = document.querySelectorAll('.bn-tab-btn');
  tabButtons.forEach(button => {
    const tabName = button.getAttribute('data-tab');
    if (tabName !== 'settings' && !appState.moduleData.global.apiKey) {
      button.classList.add('disabled');
    } else {
      button.classList.remove('disabled');
    }
  });
}
window.updateTabEnablement = updateTabEnablement;

function initializeTabs() {
  const tabButtons = document.querySelectorAll('.bn-tab-btn');
  if (!tabButtons.length) return;
  
  // Initial check
  updateTabEnablement();
  
  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      // Check if tab is disabled
      if (button.classList.contains('disabled')) {
        e.preventDefault();
        return false;
      }

      // Check if there are unsaved key changes and we're trying to leave settings
      if (window.hasUnsavedKeyChanges && appState.currentStep === 3) {
        e.preventDefault();
        
        // Flash the warning message to draw attention
        const warningEl = document.querySelector('#api-response.warning');
        if (warningEl) {
          warningEl.style.animation = 'none';
          warningEl.offsetHeight; // Trigger reflow
          warningEl.style.animation = 'bn-flash-warning 0.6s ease-in-out';
        }
        
        // Don't change tabs
        return false;
      }
      
      // Remove active class from all tabs
      tabButtons.forEach(tab => tab.classList.remove('active'));
      
      // Add active class to clicked tab
      button.classList.add('active');
      
      // Handle tab switching using existing goToStep logic
      const tabName = button.getAttribute('data-tab');
      switch(tabName) {
        case 'chat':
          goToStep(1);
          break;
        case 'saved':
          goToStep(2);
          break;
        case 'settings':
          goToStep(3);
          break;
      }
    });
  });
}

function initButtons() {
  const scrollButtons = document.querySelector(".bn-scroll-buttons");
  const scrollTopBtn = document.getElementById("bn-scroll-top");
  const scrollBottomBtn = document.getElementById("bn-scroll-bottom");
  const contentDiv = document.getElementById("bn-content");

  if (!scrollButtons || !scrollTopBtn || !scrollBottomBtn || !contentDiv) {
    return;
  }
  
  // Initialize tabs
  initializeTabs();

  function checkScrollPosition() {
    const scrollHeight = contentDiv.scrollHeight;
    const clientHeight = contentDiv.clientHeight;

    // Show buttons only if content is scrollable and has significant height
    const isScrollable = scrollHeight > clientHeight + 20;

    if (isScrollable) {
      scrollButtons.classList.add("show");
    } else {
      scrollButtons.classList.remove("show");
    }
  }

  function scrollToTop() {
    contentDiv.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function scrollToBottom() {
    contentDiv.scrollTo({
      top: contentDiv.scrollHeight,
      behavior: "smooth",
    });
  }

  // Add event listeners
  scrollTopBtn.addEventListener("click", scrollToTop);
  scrollBottomBtn.addEventListener("click", scrollToBottom);

  // Check scroll position on scroll events
  contentDiv.addEventListener("scroll", checkScrollPosition);

  // Check initially and whenever content changes
  const observer = new MutationObserver(checkScrollPosition);
  observer.observe(contentDiv, { childList: true, subtree: true });

  // Initial check
  setTimeout(checkScrollPosition, 100);

  // Store the check function globally so it can be called from other functions
  window.checkScrollPosition = checkScrollPosition;
}

function goToStep(step) {
  const contentDiv = document.getElementById("bn-content");
  if (!contentDiv) return;

  appState.currentStep = step;
  saveAppState();

  // Update tab active state based on step
  const tabButtons = document.querySelectorAll('.bn-tab-btn');
  tabButtons.forEach(tab => tab.classList.remove('active'));
  
  let activeTabSelector;
  switch(step) {
    case 1:
      activeTabSelector = '[data-tab="chat"]';
      break;
    case 2:
      activeTabSelector = '[data-tab="saved"]';
      break;
    case 3:
      activeTabSelector = '[data-tab="settings"]';
      break;
  }
  
  if (activeTabSelector) {
    const activeTab = document.querySelector(activeTabSelector);
    if (activeTab) activeTab.classList.add('active');
  }

  contentDiv.innerHTML = "Page " + step;

  switch (step) {
    case 1:
      renderStep1(contentDiv);
      break;
    case 2:
      renderStep2(contentDiv);
      break;
    case 3:
      renderStep3(contentDiv);
      break;
    default:
      contentDiv.innerHTML = "<div>Unknown step</div>";
  }
}

function loadAppState() {
  return new Promise((resolve) => {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get("BN_STATE", (result) => {
        appState = result.BN_STATE || {};
        if (!appState.moduleData) appState.moduleData = {};
        if (!appState.moduleData.global) appState.moduleData.global = {};
        
        // Initialize default system prompt if not present
        if (!appState.moduleData.global.systemPrompt) {
          appState.moduleData.global.systemPrompt = DEFAULT_SYSTEM_PROMPT;
        }
        
        resolve();
      });
    } else {
      console.log("error loading state");
      resolve();
    }
  });
}

function saveAppState() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ BN_STATE: appState }, () => {
      resolve();
    });
  });
}

function showNotification(message, type = 'info') {
  // Remove any existing notifications
  const existingNotification = document.querySelector('.bn-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `bn-notification bn-notification-${type}`;
  notification.innerHTML = `
    <div class="bn-notification-content">
      <span class="bn-notification-message">${message}</span>
      <button class="bn-notification-close">&times;</button>
    </div>
  `;

  // Add to DOM
  document.body.appendChild(notification);

  // Add event listeners
  const closeBtn = notification.querySelector('.bn-notification-close');
  closeBtn.addEventListener('click', () => {
    notification.remove();
  });

  // Auto-remove after 8 seconds for errors, 4 seconds for others
  const timeout = type === 'error' ? 8000 : 4000;
  setTimeout(() => {
    if (notification && notification.parentNode) {
      notification.remove();
    }
  }, timeout);

  // Show with animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
}

getBNAppStateAndInitialise = function () {
  // Initialize global state for unsaved changes
  window.hasUnsavedKeyChanges = false;
  
  // Add CSS for flash warning animation if not already present
  if (!document.querySelector('#bn-flash-warning-animation')) {
    const style = document.createElement('style');
    style.id = 'bn-flash-warning-animation';
    style.textContent = `
      @keyframes bn-flash-warning {
        0% { background-color: rgba(255, 68, 68, 0.1); transform: scale(1); }
        50% { background-color: rgba(255, 68, 68, 0.3); transform: scale(1.02); }
        100% { background-color: rgba(255, 68, 68, 0.1); transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }
  
  loadAppState()
    .then(saveAppState)
    .then(() => {
      appState.moduleData.global.apiResponseMessage = "";
      initButtons();
      // If no API key is set, show modal and go to settings
      if (!appState.moduleData.global.apiKey) {
        goToStep(3);
        
        // Show modal
        const modal = document.getElementById('bn-login-modal');
        if (modal) {
          modal.style.display = 'flex';
          
          // Handle "Enter Key" button
          const enterKeyBtn = document.getElementById('bn-modal-enter-key');
          if (enterKeyBtn) {
            enterKeyBtn.addEventListener('click', () => {
              modal.style.display = 'none';
              // Focus the API key input
              const apiKeyInput = document.getElementById('api-key');
              if (apiKeyInput) {
                apiKeyInput.focus();
              }
            });
          }
        }
      } else {
        goToStep(appState.currentStep || 1);
      }
    });
};

document.addEventListener("DOMContentLoaded", function () {
  getBNAppStateAndInitialise();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'logging' && typeof message.value === 'string') {
      console.log(message.value)
  }
  
  // Handle execution error notifications
  if (message && message.type === 'showError' && typeof message.message === 'string') {
    showNotification(message.message, 'error');
  }
  
  // Handle success notifications
  if (message && message.type === 'showSuccess' && typeof message.message === 'string') {
    showNotification(message.message, 'success');
  }
});
