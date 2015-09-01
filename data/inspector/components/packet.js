/* See license.txt for terms of usage */

define(function(require, exports /*, module */) {

"use strict";

// ReactJS
const React = require("react");

// Firebug SDK
const { Reps } = require("reps/reps");
const { TreeView } = require("reps/tree-view");

// RDP Inspector
//const { TextWithTooltip } = require("./text-with-tooltip");

// Constants
const { DIV, SPAN, UL, LI, A } = Reps.DOM;

// RDP Window injected APIs
const { Locale, Str } = require("../rdp-inspector-window");

/**
 * @template This template is responsible for rendering a packet.
 * Packets are rendered within {@link PacketList} sorted by time.
 *
 * A packet displays basic information in the list and can also
 * display inline preview of all inner fields.
 */
var Packet = React.createClass({
/** @lends Packet */

  displayName: "Packet",

  /**
   * Packet needs to be re-rendered only if the selection or
   * 'show inline details' option changes. This is an optimization
   * the makes the packet-list rendering a lot faster.
   */
  shouldComponentUpdate: function(nextProps, nextState) {
    var { contextMenu: prevContextMenu } = this.state || {};
    var { contextMenu: nextContextMenu } = nextState || {};

    return (this.props.selected != nextProps.selected ||
      this.props.showInlineDetails != nextProps.showInlineDetails ||
      prevContextMenu != nextContextMenu);
  },

  render: function() {
    var data = this.props.data;
    var packet = data.packet;
    var type = packet.type ? packet.type : "";
    var mode = "tiny";
    var classNames = ["packetPanel", data.type];
    var size = Str.formatSize(data.size);
    var time = data.time;
    //var stack = data.stack;

    // Use String.formatTime, but how to access from the content?
    var timeText = time.toLocaleTimeString() + "." + time.getMilliseconds();
    var previewData = {
      packet: packet
    };

    // Error packets have its own styling
    if (packet.error) {
      classNames.push("error");
    }

    // Selected packets are highlighted
    if (this.props.selected) {
      classNames.push("selected");
    }

    /*var topFrame = stack.getTopFrame();
    var stackFrameUrl = topFrame ? topFrame.getUrl() : null;
    var stackFrame = topFrame ? topFrame.getLabel() : null;*/

    // Inline preview component
    var preview = this.props.showInlineDetails ? TreeView(
      {data: previewData, mode: mode}) : null;

    if (this.props.data.type == "send") {
      return (
        DIV({className: classNames.join(" "), onClick: this.onClick,
             onContextMenu: this.onContextMenu},
          DIV({className: "packetBox"},
            DIV({className: "packetContent"},
              DIV({className: "body"},
                SPAN({className: "text"},
                  Locale.$STR("rdpInspector.label.sent") + " "
                ),
                SPAN({className: "type"}, type),
                SPAN({className: "text"},
                    " " + Locale.$STR("rdpInspector.label.to") + " "
                ),
                SPAN({className: "to"}, packet.to),
                DIV({},
                  /*TextWithTooltip({
                    tooltip: stackFrameUrl, className: "stackFrameLabel",
                    onClick: this.onViewSource.bind(this, topFrame)},
                    stackFrame
                  ),*/
                  SPAN({className: "info"}, timeText + ", " + size)
                ),
                DIV({className: "preview"},
                  preview
                )
              ),
              DIV({className: "boxArrow"})
            )
          ),
          this.state && this.state.contextMenu &&
          UL({className: "dropdown-menu", role: "menu", ref: "contextMenu",
            onMouseLeave: this.onContextMenuMouseLeave,
            style: {
              display: "block",
              top: this.state.contextMenuTop,
              left: this.state.contextMenuLeft
            }},
            LI({role: "presentation"},
              A({ref: "editAndResendAction", onClick: this.onEditAndResendClick},
                "Edit and Resend"))
          )
        )
      );
    } else {
      return (
        DIV({className: classNames.join(" "), onClick: this.onClick},
          DIV({className: "packetBox"},
            DIV({className: "packetContent"},
              DIV({className: "boxArrow"}),
              DIV({className: "body"},
                DIV({className: "from"},
                  SPAN({className: "text"},
                    Locale.$STR("rdpInspector.label.received") + " "
                  ),
                  SPAN({}, type),
                  SPAN({className: "text"},
                    " " + Locale.$STR("rdpInspector.label.from") + " "),
                  SPAN({}, packet.from),
                  DIV({},
                    /*TextWithTooltip({
                      tooltip: stackFrameUrl, className: "stackFrameLabel",
                      onClick: this.onViewSource.bind(this, topFrame)},
                      stackFrame
                    ),*/
                    SPAN({className: "info"}, timeText + ", " + size)
                  )
                ),
                // NOTE: on issue #44, a long "consoleAPICall" received packet
                // was wrongly turned into a "div.errorMessage"
                packet.error ? DIV({className: "errorMessage"},
                  DIV({}, packet.error),
                  DIV({}, packet.message)
                ) : null,
                DIV({className: "preview"},
                  preview
                )
              )
            )
          )
        )
      );
    }
  },

  // Event Handlers
  onEditAndResendClick: function() {
    this.setState({
      contextMenu: false
    });
    this.props.actions.editPacket(this.props.data.packet);
  },

  onContextMenuMouseLeave: function() {
    this.setState({
      contextMenu: false
    });
  },

  onContextMenu: function(event) {
    event.stopPropagation();
    event.preventDefault();

    this.setState({
      contextMenu: true,
      contextMenuTop: event.clientY - 16,
      contextMenuLeft: event.clientX - 16
    });
    this.props.actions.selectPacket(this.props.data);
  },

  onClick: function(event) {
    var target = event.target;

    event.stopPropagation();
    event.preventDefault();

    // If a 'memberLabel' is clicked inside the inline preview
    // tree, let's process it by the tree, so expansion and
    // collapsing works. Otherwise just select the packet.
    if (!target.classList.contains("memberLabel")) {
      this.props.actions.selectPacket(this.props.data);
    }
  },

  onViewSource: function(topFrame, event) {
    event.stopPropagation();
    event.preventDefault();

    this.props.actions.onViewSource({
      url: topFrame.url,
      lineNumber: topFrame.lineNumber
    });
  }
});

// Exports from this module
exports.Packet = React.createFactory(Packet);
exports.PacketComponent = Packet;
});
