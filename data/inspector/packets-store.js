/* See license.txt for terms of usage */
/* globals Options */

define(function(require, exports/*, module*/) {

"use strict";

// Constants
const refreshTimeout = 200;

/**
 * This object contains all collected packets. It's also responsible
 * for refreshing the UI if new packets appears.
 */
function PacketsStore(win, app) {
  this.win = win;
  this.app = app;

  this.win.addEventListener("init-options", this.onInitOptions.bind(this));
  this.win.addEventListener("init-packet-list", this.onInitialize.bind(this));
  this.win.addEventListener("send-packet", this.onSendPacket.bind(this));
  this.win.addEventListener("receive-packet", this.onReceivePacket.bind(this));
  this.win.addEventListener("loaded-packet-list-file", this.onLoadedPacketListFile.bind(this));

  this.clear();
}

const DUMP_FORMAT_VERSION = "rdp-inspector/packets-store/v1";
const DUMP_FORMAT_KEYS = [
  "packets", "summary",
  "uniqueId", "removedPackets"
];

PacketsStore.prototype =
/** @lends PacketsStore */
{
  onLoadedPacketListFile: function(event) {
    try {
      this.deserialize(event.data);
    } catch(e) {
      this.app.setState({
        error: {
          message: "Error loading packets from file",
          details: e
        }
      });
    }
  },
  onInitialize: function(event) {
    var cache = JSON.parse(event.data);

    // Get number of packets removed from the cache.
    this.removedPackets = cache.removedPackets || 0;

    // Get list of cached packets and render if any.
    var packets = cache.packets;
    if (!packets || !packets.length) {
      return;
    }

    for (var i = 0; i < packets.length; i++) {
      var packet = packets[i];
      this.appendPacket({
        type: packet.type,
        packet: packet.packet,
        size: JSON.stringify(packet.packet).length,
        time: new Date(packet.time)
      });
    }

    // Default summary info appended into the list.
    this.appendSummary();
  },

  onInitOptions: function(event) {
    var { showInlineDetails, packetCacheEnabled } = JSON.parse(event.data);

    this.app.setState({
      showInlineDetails: showInlineDetails,
      packetCacheEnabled: packetCacheEnabled
    });
  },

  onSendPacket: function(event) {
    this.appendPacket({
      type: "send",
      rawPacket: event.data,
      packet: JSON.parse(event.data),
      size: event.data.length,
      time: new Date()
    });
  },

  onReceivePacket: function(event) {
    this.appendPacket({
      type: "receive",
      rawPacket: event.data,
      packet: JSON.parse(event.data),
      size: event.data.length,
      time: new Date()
    });
  },

  appendPacket: function(packet, now) {
    this.packets.push(packet);

    packet.id = ++this.uniqueId;

    // Collect statistics data.
    if (packet.type === "send") {
      this.summary.data.sent += packet.size;
      this.summary.packets.sent += 1;
    } else if (packet.type === "receive") {
      this.summary.data.received += packet.size;
      this.summary.packets.received += 1;
    }

    var limit = Options.getPref("extensions.rdpinspector.packetLimit");
    while (this.packets.length > limit) {
      this.packets.shift();
      this.removedPackets++;
    }

    this.refreshPackets(now);
  },

  refreshPackets: function(now) {
    if (this.timeout) {
      this.win.clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (now) {
      this.doRefreshPackets();
      return;
    }

    // Refresh on timeout to avoid to many re-renderings.
    this.timeout = this.win.setTimeout(() => {
      this.doRefreshPackets();
      this.timeout = null;
    }, refreshTimeout);
  },

  doRefreshPackets: function() {
    var packets = this.doFilterPacketsList(this.packets);

    var newState = {
      packets: packets,
      removedPackets: this.removedPackets
    };

    // Default selection
    if (!this.app.state.selectedPacket) {
      var selection = packets.length ? packets[0].packet : null;
      newState.selectedPacket = selection;
    }

    // If there are no packets clear the details side panel.
    if (!packets.length) {
      newState.selectedPacket = null;
    }

    this.app.setState(newState);
  },

  doFilterPacketsList: function() {
    var filterFrom = {};

    return this.packets.filter((packet) => {
      var actorId = packet.packet ? (packet.packet.to || packet.packet.from) : null;

      // filter our all the RDPi actorInspector actor
      if (actorId && actorId.indexOf("actorInspector") > 0) {
        return false;
      }

      if (packet.type == "send") {
        // filter sent RDP packets needed to register the RDPi actorInspector actor
        if (packet.packet.rdpInspectorInternals == true) {
          filterFrom[packet.packet.to] = filterFrom[packet.packet.to] || 0;
          filterFrom[packet.packet.to] += 1;

          return false;
        }

        // filter sent RDP packets needed to register the RDPi actorInspector actor
        if (packet.packet.type == "registerActor" &&
            packet.packet.filename.indexOf("rdpinspector-at-getfirebug-dot-com") > 0) {
          filterFrom[packet.packet.to] = filterFrom[packet.packet.to] || 0;
          filterFrom[packet.packet.to] += 1;
          return false;
        }
      }

      // filter received RDP packets needed to register the RDPi actorInspector actor
      if (packet.type == "receive" && filterFrom[packet.packet.from] > 0) {
        filterFrom[packet.packet.from] -= 1;
        return false;
      }

      return true;
    });
  },

  clear: function() {
    this.packets = [];
    this.uniqueId = 0;

    // Number of removed packets that are out of limit.
    this.removedPackets = 0;

    this.summary = {
      data: {
        sent: 0,
        received: 0
      },
      packets: {
        sent: 0,
        received: 0
      }
    };

    this.refreshPackets(true);
  },

  appendSummary: function() {
    this.appendPacket({
      type: "summary",
      time: new Date(),
      data: {
        sent: this.summary.data.sent,
        received: this.summary.data.received
      },
      packets: {
        sent: this.summary.packets.sent,
        received: this.summary.packets.received
      }
    }, true);
  },

  appendMessage: function(message) {
    this.appendPacket({
      type: "message",
      time: new Date(),
      message: message
    }, true);
  },

  serialize: function() {
    var data = {
      "!format!": DUMP_FORMAT_VERSION
    };
    DUMP_FORMAT_KEYS.forEach((key) => {
      data[key] = this[key];
    });
    return JSON.stringify(data);
  },

  deserialize: function(rawdata) {
    var data = JSON.parse(rawdata, (k, v) => {
      switch (k) {
      case "time":
        return new Date(v);
      default:
        return v;
      }
    });

    if (data["!format!"] &&
        data["!format!"] === DUMP_FORMAT_VERSION) {
      DUMP_FORMAT_KEYS.forEach((key) => {
        this[key] = data[key];
      });
    } else {
      throw Error("Dump file format unrecognized");
    }

    this.refreshPackets(true);
  }
};

// Exports from this module
exports.PacketsStore = PacketsStore;
});
