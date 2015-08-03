/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

// Add-on SDK
const self = require("sdk/self");
const options = require("@loader/options");
const { prefs } = require("sdk/simple-prefs");
const { Cu } = require("chrome");
const { getMostRecentBrowserWindow } = require("sdk/window/utils");
const { defer } = require("sdk/core/promise");
const { openTab } = require("sdk/tabs/utils");
const { getNodeView } = require("sdk/view/core");
const { Class } = require("sdk/core/heritage");

// Firebug.SDK
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { Locale } = require("firebug.sdk/lib/core/locale.js");
const { ToolbarButton } = require("firebug.sdk/lib/toolbar-button.js");
const { ToolboxChrome } = require("firebug.sdk/lib/toolbox-chrome.js");
const { Dispatcher } = require("firebug.sdk/lib/dispatcher.js");

// Platform
const { CustomizableUI } = Cu.import("resource:///modules/CustomizableUI.jsm", {});
const { AREA_PANEL, AREA_NAVBAR } = CustomizableUI;
const { AddonManager } = Cu.import("resource://gre/modules/AddonManager.jsm", {});

// DevTools
const { gDevTools } = Cu.import("resource:///modules/devtools/gDevTools.jsm", {});
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});

// RDP Inspector
const { ToolboxOverlay } = require("./toolbox-overlay");

const startButtonId = "rdp-inspector-start-button";

// Helpers

function showToolbox(toolId) {
  let browser = getMostRecentBrowserWindow();
  let tab = browser.gBrowser.mCurrentTab;
  let target = devtools.TargetFactory.forTab(tab);
  return gDevTools.showToolbox(target, toolId);
}

function getToolboxWhenReady(toolId) {
  let deferred = defer();
  showToolbox(toolId).then(toolbox => {
    return deferred.resolve(toolbox);
  });
  return deferred.promise;
}

function cancelEvent(event) {
  event.stopPropagation();
  event.preventDefault();
}

/**
 * This object represents a wrapper for start button node that is
 * used as an anchor for Notification Panel object (displayed when
 * the extension is installed for the first time).
 *
 * Note that passing directly a DOM node to Panel.show() method is
 * an unsupported feature that will be soon replaced.
 * See: https://bugzilla.mozilla.org/show_bug.cgi?id=878877
 */
var StartButtonAnchor = Class(
/** @lends StartButtonAnchor */
{
  initialize: function(button) {
    this.node = button;
  }
});

// getNodeView is used by the SDK panel to get the target anchor node.
getNodeView.define(StartButtonAnchor, anchor => {
  return anchor.node;
});

/**
 * This object represents a button that is automatically displayed
 * in the main Firefox toolbar after the extension is installed.
 * It serves as the entry point to the rest of the UI.
 */
var StartButton =
/** @lends StartButton */
{
  // Initialization

  initialize: function() {
    // Create customizable button in browser toolbar.
    // Read more:
    // https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/CustomizableUI.jsm
    // https://blog.mozilla.org/addons/2014/03/06/australis-for-add-on-developers-2/
    CustomizableUI.createWidget({
      id: startButtonId,
      type: "custom",
      defaultArea: AREA_NAVBAR,
      allowedAreas: [AREA_PANEL, AREA_NAVBAR],
      onBuild: this.onBuild.bind(this)
    });
  },

  shutdown: function(/*reason*/) {
    CustomizableUI.destroyWidget(startButtonId);
  },

  onBuild: function(doc) {
    Trace.sysout("startButton.onBuild;", doc);

    // Create a toolbar button with associated context menu.
    let button = new ToolbarButton({
      document: doc,
      id: startButtonId,
      label: "rdpInspector.startButton.title",
      tooltiptext: "rdpInspector.startButton.tip",
      type: "menu-button",
      "class": "toolbarbutton-1 chromeclass-toolbar-additional",
      image: "chrome://rdpinspector/skin/icon16.png",
      items: this.getMenuItems.bind(this, doc.defaultView),
      command: this.onToggleRdpInspector.bind(this)
    });

    return button.button;
  },

  getAnchor: function(doc) {
    let startButton = this.getButton(doc);
    return new StartButtonAnchor(startButton);
  },

  getButton: function(doc) {
    return doc.getElementById(startButtonId);
  },

  // Menu Actions

  getMenuItems: function(/*win*/) {
    let items = [];

    items.push({
      nol10n: true,
      label: Locale.$STR("rdpInspector.menu.options.label"),
      type: "menu",
      items: [
        {
          nol10n: true,
          label: Locale.$STR("rdpInspector.menu.webideConnectionsMonitor.label"),
          tooltiptext: Locale.$STR("rdpInspector.menu.webideConnectionsMonitor.tip"),
          type: "checkbox",
          checked: prefs.webideConnectionsMonitor,
          command: this.onToggleWebideConnectionsMonitor.bind(this)
        },
        {
          nol10n: true,
          label: Locale.$STR("rdpInspector.menu.packetCache.label"),
          tooltiptext: Locale.$STR("rdpInspector.menu.packetCache.tip"),
          type: "checkbox",
          checked: prefs.packetCacheEnabled,
          command: this.onTogglePacketCache.bind(this)
        },
        {
          nol10n: true,
          label: Locale.$STR("rdpInspector.menu.showInlineDetails.label"),
          tooltiptext: Locale.$STR("rdpInspector.menu.showInlineDetails.tip"),
          type: "checkbox",
          checked: prefs.showInlineDetails,
          command: this.onToggleInlineDetails.bind(this)
        }
      ]
    });

    items.push({
      nol10n: true,
      label: Locale.$STR("rdpInspector.menu.visitHomePage.label"),
      tooltiptext: Locale.$STR("rdpInspector.menu.visitHomePage.tip"),
      command: this.onVisitHomePage.bind(this)
    });

    items.push({
      nol10n: true,
      label: Locale.$STR("rdpInspector.menu.reportIssue.label"),
      tooltiptext: Locale.$STR("rdpInspector.menu.reportIssue.tip"),
      command: this.onReportIssue.bind(this)
    });

    items.push({
      nol10n: true,
      label: Locale.$STR("rdpInspector.menu.group.label"),
      tooltiptext: Locale.$STR("rdpInspector.menu.group.tip"),
      command: this.onDiscussionGroup.bind(this)
    });

    items.push("-");

    items.push({
      nol10n: true,
      label: Locale.$STR("rdpInspector.menu.about.label") + " " + self.version,
      tooltiptext: Locale.$STR("rdpInspector.menu.about.tip"),
      image: "chrome://rdpinspector/skin/logo_16x16.png",
      command: this.onAbout.bind(this)
    });

    return items;
  },

  onToggleRdpInspector: function() {
    Trace.sysout("startButton.onToggleRdpInspector;");

    return getToolboxWhenReady().then(toolbox => {
      let context = ToolboxChrome.getContext(toolbox);
      let overlayId = ToolboxOverlay.prototype.overlayId;
      let overlay = context.getOverlay(overlayId);
      if (!overlay) {
        TraceError.sysout("startButton.onToggleRdpInspector; ERROR " +
          " No overlay: " + overlayId, context);
        return null;
      }

      let win = overlay.toggleInspector();

      // xxxHonza: register listeners to update the UI button.
      // Or the toolbox overlay could update it.
      return win;
    });
  },

  // Commands
  onToggleWebideConnectionsMonitor: function(event) {
    cancelEvent(event);

    prefs.webideConnectionsMonitor = !prefs.webideConnectionsMonitor;
  },

  onTogglePacketCache: function(event) {
    cancelEvent(event);

    prefs.packetCacheEnabled = !prefs.packetCacheEnabled;
  },

  onToggleInlineDetails: function(event) {
    cancelEvent(event);

    prefs.showInlineDetails = !prefs.showInlineDetails;
  },

  onAbout: function(event) {
    cancelEvent(event);

    AddonManager.getAddonByID(self.id, function (addon) {
      let browser = getMostRecentBrowserWindow();
      browser.openDialog("chrome://mozapps/content/extensions/about.xul", "",
        "chrome,centerscreen,modal", addon);
    });
  },

  onVisitHomePage: function(event) {
    cancelEvent(event);

    let browser = getMostRecentBrowserWindow();
    openTab(browser, options.manifest.homepage);
  },

  onReportIssue: function(event) {
    cancelEvent(event);

    let browser = getMostRecentBrowserWindow();
    openTab(browser, options.manifest.bugs.url);
  },

  onDiscussionGroup: function(event) {
    cancelEvent(event);

    let browser = getMostRecentBrowserWindow();
    openTab(browser, options.manifest.forum);
  }
};

// Registration
Dispatcher.register(StartButton);

// Exports from this module
exports.StartButton = StartButton;
