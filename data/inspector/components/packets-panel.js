/* See license.txt for terms of usage */

define(function(require, exports/*, module*/) {

"use strict";

// Dependencies
const React = require("react");

// Firebug SDK
const { Reps } = require("reps/repository");

// RDP Inspector
const { PacketList } = require("./packet-list");
const { PacketsSidebar } = require("./packets-sidebar");
const { PacketsToolbar } = require("./packets-toolbar");
const { Splitter } = require("./splitter");

// Shortcuts
const { DIV, SPAN } = Reps.DOM;

var PacketsDirectionsBar = React.createClass({
/** @lends PacketsDirectionsBar */

  displayName: "PacketsDirectionsBar",

  render: function() {
    return DIV({
      id: "packetsDirectionsBar",
      style: {
        position: "relative",
        height: "24px"
      }
    }, SPAN({ style: {
          position: "absolute",
          top: "0px",
          left: "10px",
          fontWeight: "bold",
          fontSize: "1.2em"
        }, key: "server"}, "Server"),
        SPAN({ style: {
          position: "absolute",
          top: "0px",
          right: "10px",
          fontWeight: "bold",
          fontSize: "1.2em"
        }, key: "client"}, "Client")
    );
  }
});

/**
 * @template This template renders 'Packets' tab body.
 */
var PacketsPanel = React.createClass({
/** @lends PacketPanel */

  displayName: "PacketsPanel",

  getInitialState: function() {
    return {
      packets: this.props.packets,
      selectedPacket: null
    };
  },

  render: function() {
    var leftPanel = DIV({className: "mainPanel"},
      PacketsToolbar({
        actions: this.props.actions,
        showInlineDetails: this.props.showInlineDetails,
        packetCacheEnabled: this.props.packetCacheEnabled,
        paused: this.props.paused
      }),
      React.createElement(PacketsDirectionsBar, {}),
      PacketList({
        data: this.props.packets,
        actions: this.props.actions,
        selectedPacket: this.props.selectedPacket,
        searchFilter: this.props.searchFilter,
        showInlineDetails: this.props.showInlineDetails,
        removedPackets: this.props.removedPackets
      })
    );

    var rightPanel = DIV({className: "sidePanel"},
      PacketsSidebar({
        selectedPacket: this.props.selectedPacket,
        editedPacket: this.props.editedPacket,
        actions: this.props.actions,
        actorIDs: this.props.actorIDs
      })
    );

    return (
      DIV({className: "packetsPanelBox"},
        Splitter({
          mode: "vertical",
          min: 200,
          leftPanel: leftPanel,
          rightPanel: rightPanel,
          innerBox: DIV({className: "innerBox"})
        })
      )
    );
  }
});

// Exports from this module
exports.PacketsPanel = React.createFactory(PacketsPanel);
exports.PacketsPanelComponent = PacketsPanel;

});
