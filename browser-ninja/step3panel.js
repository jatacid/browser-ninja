function renderStep3(container) {
  container.innerHTML = `
    <div class="bn-settings-container">
      <div class="bn-settings-header">
        <h2>Settings & Setup</h2>
        <p>Configure your API keys to get started with Browser Ninja</p>
      </div>

      <div class="bn-settings-section">
        <div class="bn-settings-field">
          <label class="bn-settings-label">
            OpenAI API Key
            <span class="bn-required">*</span>
          </label>
          <p class="bn-settings-help">
            Enter your OpenAI API Key (get one <a href="https://platform.openai.com/api-keys" target="_blank">here</a>)
          </p>
          <div class="bn-settings-input-group">
            <input type="password" id="api-key" placeholder="sk-..." class="bn-settings-input">
          </div>
        </div>

        <div class="bn-settings-field">
          <label class="bn-settings-label">
            System Prompt
          </label>
          <p class="bn-settings-help">
            Customize the instructions given to the AI.
          </p>
          <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 10px;">
            <button id="toggle-system-prompt" class="bn-btn-text" style="padding: 0; color: #4CAF50;">
              Show
            </button>
          </div>
          <div class="bn-settings-input-group" id="system-prompt-container" style="display: none;">
            <span style="color:red">Warning: Some instructins here help Browser Ninja work better, core functionality may be lost if not used correctly.</span>
            <a href="#" id="restore-default-prompt" class="bn-btn-text" style="padding: 0; color: #ff9800; font-size: 0.9em; margin-left: 10px;">
              Restore Default
            </a>
            <textarea id="system-prompt" class="bn-settings-textarea" rows="10" style="font-size: 8px;"></textarea>
          </div>
        </div>

        <div class="bn-settings-actions">
          <button id="save-settings" class="bn-settings-activate-btn">
            Save Settings
          </button>
          <div id="api-response" class="bn-settings-response"></div>
        </div>
      </div>

      <div class="bn-settings-footer">
        <div class="bn-settings-links">
          <a href="https://github.com/jatacid/browser-ninja/issues" target="_blank">✉️ Send Feedback</a>
          <a href="https://www.paypal.com/donate/?hosted_button_id=9VFG2KJ8HW6EW" target="_blank" style="color: #0070ba;">☕ Donate</a>
        </div>
      </div>
    </div>
  `;

  function setupInputFields(container) {
    const apiKeyInput = container.querySelector("#api-key");
    const systemPromptInput = container.querySelector("#system-prompt");
    const settingsResponseEl = container.querySelector("#api-response");
    const saveBtn = container.querySelector("#save-settings");
    const togglePromptBtn = container.querySelector("#toggle-system-prompt");
    const promptContainer = container.querySelector("#system-prompt-container");

    // Set initial values
    apiKeyInput.value = appState.moduleData.global.apiKey || "";
    systemPromptInput.value = appState.moduleData.global.systemPrompt || "";

    // Clear the unsaved changes flag on initial load
    clearKeyChangeWarning();

    function updateSaveBtnState() {
      const hasApiKey = apiKeyInput.value.trim();
      const canSave = hasApiKey;
      saveBtn.disabled = !canSave;
    }

    function showResponse(message, isError = false) {
      settingsResponseEl.textContent = message;
      settingsResponseEl.className = isError ? 'bn-settings-response error' : 'bn-settings-response success';
      
      // Clear message after 3 seconds
      setTimeout(() => {
        settingsResponseEl.textContent = "";
        settingsResponseEl.className = 'bn-settings-response';
      }, 3000);
    }

    function showKeyChangeWarning() {
      // Set global flag to prevent navigation
      window.hasUnsavedKeyChanges = true;
    }

    function clearKeyChangeWarning() {
      // Clear the global flag to allow navigation
      window.hasUnsavedKeyChanges = false;
    }

    // Initial setup
    updateSaveBtnState();
    
    apiKeyInput.addEventListener("input", () => {
      updateSaveBtnState();
      showKeyChangeWarning();
    });

    systemPromptInput.addEventListener("input", () => {
      showKeyChangeWarning();
    });

    // Existing toggle button listener
    togglePromptBtn.addEventListener("click", () => {
      const isHidden = promptContainer.style.display === "none";
      promptContainer.style.display = isHidden ? "block" : "none";
      togglePromptBtn.textContent = isHidden ? "Hide" : "Show";
    });

    // Restore Default link listener
    const restoreDefaultLink = container.querySelector("#restore-default-prompt");
    if (restoreDefaultLink) {
      restoreDefaultLink.addEventListener("click", (e) => {
        e.preventDefault();
        if (confirm("Are you sure you want to restore the default system prompt? This will overwrite any custom prompt.")) {
          systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
          showKeyChangeWarning();
        }
      });
    }

    saveBtn.addEventListener("click", () => {
      if (saveBtn.disabled) return;
      
      appState.moduleData.global.apiKey = apiKeyInput.value.trim();
      appState.moduleData.global.systemPrompt = systemPromptInput.value;
      
      saveAppState().then(() => {
        showResponse("Settings saved! 🎉", false);
        clearKeyChangeWarning();
        if (window.updateTabEnablement) window.updateTabEnablement(); // Re-enable tabs
      });
    });
  }

  setupInputFields(container);
}
