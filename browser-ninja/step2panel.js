function renderStep2(container) {
  container.innerHTML = `
    <div class="bn-settings-header">
      <h2>Saved Snippets</h2>
      <p>Manage and run your saved code snippets</p>
    </div>
    <div id="step2-saved-snippets-container" class="saved-snippets-container chat-container"></div>
    `;


  const savedSnippetsContainer = container.querySelector("#step2-saved-snippets-container");
    const savedSnippetsModule = createSavedSnippetsModule(savedSnippetsContainer, {
    hexColour: "#f8eaff",
    title: "Saved Snippets",
    subtitle: "Saved snippets will appear here. Toggle Auto-run to automatically run the snippet when you refresh your page. Click on the title to edit."
  });
  savedSnippetsModule.render();

}
