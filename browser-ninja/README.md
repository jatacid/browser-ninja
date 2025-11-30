# Browser Ninja Chrome Extension

A Chrome extension to make browser based changes and automations.

## Features

- **Capture Context Elements**: Indicate specific areas of your page you want to incorporate.
- **Code Ninja Assistant**: Discuss with the assistant to build your changes or automations.
- **Agent Mode**: The Dev Ninja can offer snippets of code to you to gather more context about your ask, helping it to understand what you're trying to achieve.
- **Save & Load Snippets**: Save working snippets so that they load automatically when you refresh your page. Ensuring you can properly test them.

## Installation

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable "Developer mode".
4. Click "Load unpacked" and select the extension folder.
5. The extension icon will appear in your Chrome toolbar.

## Usage

1. Click the Browser Ninja icon to open the side panel.
2. Follow the guided steps to select context elements.
3. Describe the selected context and explain what you'd like help to build.
4. Save or run snippets that the assistant provides.

## Privacy & Data

- **No backend servers**: Extension communicates directly with OpenAI's API using your own API key.
- **Local storage only**: All settings, snippets, and API keys are stored locally in your browser.
- **No tracking**: No analytics, no usage tracking, no data collection.
- **Open source**: Review the code yourself on [GitHub](https://github.com/jatacid/browser-ninja).

For detailed information, see our [Privacy Policy](https://jatacid.github.io/browser-ninja/privacy-policy.html).

## Technical Details

- Manifest Version: 3
- Permissions: activeTab, storage, scripting, tabs, sidePanel, host_permissions
- Framework: Vanilla JavaScript (no external dependencies)
- Storage: Chrome Local Storage API
- LLM: OpenAi API key required

## Support

For issues or questions, please open an issue on our [GitHub repository](https://github.com/jatacid/browser-ninja/issues).

## License

Browser Ninja is open source software licensed under the MIT License.

You are free to use, modify, and distribute this software for any purpose, including commercial use, as long as you include the original copyright notice and license terms.

See the [LICENSE](LICENSE) file for full details.

For documentation and more information, visit [jatacid.github.io/browser-ninja](https://jatacid.github.io/browser-ninja).
