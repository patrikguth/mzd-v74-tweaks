/* Example data: omit gui_translations to keep the existing English texts. */
window.MzdGuiI18n.register("gui-hello-world", {
  "version": 1,
  "languages": {
    "en_US": {
      "gui.label": "Hello World",
      "heading": "Hello World",
      "intro": "A general GUI extension using shared support.",
      "inputHint": "Use the controller. Select increments the counter.",
      "counter": "Counter",
      "backHint": "Back returns to the previous menu.",
      "back": "Back",
      "input": "Input: {action} / {phase}"
    },
    "de_DE": {
      "gui.label": "Hallo Welt",
      "heading": "Hallo Welt",
      "intro": "Eine allgemeine GUI-Erweiterung mit gemeinsamem Helper.",
      "inputHint": "Controller verwenden. Drücken erhöht den Zähler.",
      "counter": "Zähler",
      "backHint": "Zurück führt zum vorherigen Menü.",
      "back": "Zurück",
      "input": "Eingabe: {action} / {phase}"
    }
  }
});
