const renderStep1 = (container) => {
  container.innerHTML = `
    <div class="bn-settings-header">
      <h2>Welcome!</h2>
      <p>What will you create today?</p>
    </div>
    <div id="chatContainer"></div>
  `;

  const chatContainer = container.querySelector("#chatContainer");

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chatModule = createChatModule(chatContainer, {
      hexColour: "#e3fbe5",
      moduleId: "chatContainer",
    });
    chatModule.render();
  });
};
