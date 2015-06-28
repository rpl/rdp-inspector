/* See license.txt for terms of usage */

/* globals exports, module */
/* eslint global-strict: 0, dot-notation: 0, new-cap: 0, no-underscore-dangle: 0 */

"use strict";

module.metadata = {
  "stability": "experimental"
};

// Add-on SDK
const options = require("@loader/options");
const { Cu } = require("chrome");
const { defer, all } = require("sdk/core/promise");

// Firebug SDK
const { Dispatcher } = require("firebug.sdk/lib/dispatcher");
const { Trace/*, TraceError*/ } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { Rdp } = require("firebug.sdk/lib/core/rdp.js");

// DevTools
const { DebuggerClient } = Cu.import("resource://gre/modules/devtools/dbg-client.jsm", {});
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { on, off } = devtools["require"]("sdk/event/core");

// RDP Inspector
const { InspectorFront } = require("./inspector-front.js");

// URL of the {@InspectorActor} module. This module will be
// installed and loaded on the backend.
const actorModuleUrl = options.prefixURI + "lib/inspector-actor.js";

/**
 * @service This object represents 'RDP Inspector Service'.
 * This service is responsible for registering necessary back-end
 * actors and loading related UI (panels).
 *
 * This object is a singleton and there is only one instance created.
 */
const InspectorService =
/** @lends InspectorService */
{
  // Initialization

  initialize: function() {
    Trace.sysout("InspectorService.initialize;", arguments);

    // Transport listeners (key == debugger client instance)
    this.listeners = new Map();
    this.onDebuggerClientConnect = this.onDebuggerClientConnect.bind(this);

    on(DebuggerClient, "connect", this.onDebuggerClientConnect);
  },

  shutdown: function() {
    Trace.sysout("InspectorService.shutdown;");

    off(DebuggerClient, "connect", this.onDebuggerClientConnect);

    this.unregisterActors();
  },

  // Toolbox Events

  onToolboxCreated: function(/*eventId, toolbox*/) {
    Trace.sysout("InspectorService.onToolboxCreated;");
  },

  onToolboxReady: function(eventId, toolbox) {
    Trace.sysout("InspectorService.onToolboxReady;", toolbox);
  },

  onToolboxDestroy: function(/*eventId, toolbox*/) {
    Trace.sysout("InspectorService.onToolboxDestroy;");
  },

  // Connection Events

  onDebuggerClientConnect: function(client) {
    Trace.sysout("InspectorService.onDebuggerClientConnect;", client);
  },

  // Backend Actors

  registerInspectorActor: function(toolbox) {
    Trace.sysout("InspectorService.registerInspectorActor;");

    // Inspector actor registration options.
    let config = {
      prefix: "actorInspector",
      actorClass: "InspectorActor",
      frontClass: InspectorFront,
      moduleUrl: actorModuleUrl,
      // NOTE: the following option asks firebug.sdk to mark custom actors registering RDP packets
      // as rdpInspectorInternals (which helps to filter out them from the packet list)
      rdpInspectorInternals: true
    };

    let deferred = defer();
    let client = toolbox.target.client;

    // xxxHonza: the registration should be done in one step
    // using Rdp.registerActor() API

    // Register as global actor.
    let global = Rdp.registerGlobalActor(client, config).
      then(({registrar, front}) => {
        this.globalRegistrar = registrar;
        return front;
    });

    // Register as tab actor.
    let tab = Rdp.registerTabActor(client, config).
      then(({registrar, front}) => {
        this.tabRegistrar = registrar;
        return front;
    });

    // Wait till both registrations are done.
    all([global, tab]).then(results => {
      deferred.resolve({
        global: results[0],
        tab: results[1]
      });
    });

    return deferred.promise;
  },

  unregisterActors: function() {
    if (this.globalRegistrar) {
      this.globalRegistrar.unregister().then(() => {
        Trace.sysout("inspectoService.unregisterActors; global actor " +
          "unregistered", arguments);
      });
    }

    if (this.tabRegistrar) {
      this.tabRegistrar.unregister().then(() => {
        Trace.sysout("inspectoService.unregisterActors; tab actor " +
          "unregistered", arguments);
      });
    }
  },

  // Accessors

  /**
   * Returns client objects for both, global and tab inspector actors.
   *
   * @returns {Object} An object with two clients objects. The 'global'
   * property represents front to the global actor and the 'tab' property
   * represents front to the the tab (aka child) actor.
   */
  getInspectorClients: function(toolbox) {
    return this.registerInspectorActor(toolbox);
  }
};

// Registration
Dispatcher.register(InspectorService);

// Exports from this module
exports.InspectorService = InspectorService;
